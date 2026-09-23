import { guestSchema, type GuestInput, type PlanningGuest } from './planning';
export const fields = [
  'name',
  'phone',
  'email',
  'capacity',
  'tableLabel',
  'category',
  'note',
] as const;
export type GuestField = (typeof fields)[number];
export const fieldLabels: Record<GuestField, string> = {
  name: 'Guest / household name',
  phone: 'Phone',
  email: 'Email',
  capacity: 'Total people allowed',
  tableLabel: 'Table / directions',
  category: 'Category',
  note: 'Internal note',
};
export function suggestMapping(headers: string[]) {
  const aliases: Record<GuestField, string[]> = {
    name: ['name', 'guest', 'guestname', 'fullname', 'household'],
    phone: ['phone', 'telephone', 'mobile', 'phonenumber'],
    email: ['email', 'emailaddress'],
    capacity: [
      'capacity',
      'numberallowed',
      'people',
      'totalpeopleallowed',
      'pax',
    ],
    tableLabel: ['table', 'tablelabel', 'tabledirections'],
    category: ['category', 'tag', 'group'],
    note: ['note', 'notes', 'internalnote'],
  };
  return Object.fromEntries(
    fields.map((f) => [
      f,
      headers.findIndex((h) =>
        aliases[f].includes(h.toLowerCase().replace(/[^a-z]/g, '')),
      ),
    ]),
  ) as Record<GuestField, number>;
}
export function reviewRows(
  rows: string[][],
  mapping: Record<GuestField, number>,
  country: string,
  existing: PlanningGuest[],
) {
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const raw = Object.fromEntries(
      fields.map((f) => [f, (row[mapping[f]] || '').trim()]),
    );
    let phone = raw.phone.replace(/[ ()-]/g, '');
    if (phone.startsWith("'+")) phone = phone.slice(1);
    if (country === 'UG' && /^0\d{9}$/.test(phone))
      phone = '+256' + phone.slice(1);
    const candidate = { ...raw, phone, capacity: Number(raw.capacity) };
    const parsed = guestSchema.safeParse(candidate);
    const sig = raw.name.toLocaleLowerCase() + '|' + phone;
    const duplicate =
      seen.has(sig) ||
      existing.some(
        (g) =>
          g.name.toLocaleLowerCase() === raw.name.toLocaleLowerCase() &&
          (g.phone === phone ||
            (raw.email && g.email.toLowerCase() === raw.email.toLowerCase())),
      );
    seen.add(sig);
    return {
      rowKey: i + 2,
      guest: parsed.success ? parsed.data : (candidate as GuestInput),
      error: parsed.success
        ? ''
        : parsed.error.issues
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; '),
      duplicate,
      original: row,
    };
  });
}
// Quoted cells, embedded newlines, escaped quotes and UTF-8 BOM are supported.
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
    if (rows.length > 5001 || cell.length > 10000 || row.length > 100)
      throw Error('File exceeds row, column or cell limits.');
  }
  if (quoted) throw Error('Unclosed quote in CSV.');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}
