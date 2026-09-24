import type { ProgrammeItem } from './commerce';
function escape(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
function fold(line: string) {
  const output: string[] = [];
  let current = '';
  let size = 0;
  for (const c of line) {
    const n = new TextEncoder().encode(c).length;
    if (size + n > 75) {
      output.push(current);
      current = ' ';
      size = 1;
    }
    current += c;
    size += n;
  }
  output.push(current);
  return output.join('\r\n');
}
function stamp(value: string) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}
export function programmeCalendar(
  eventId: string,
  title: string,
  items: ProgrammeItem[],
  now = new Date().toISOString(),
) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yingira//Event programme//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escape(title)}`,
  ];
  for (const p of items)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${p.id}.${eventId}@yingira`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(p.startsAt)}`,
      `DTEND:${stamp(p.endsAt)}`,
      `SUMMARY:${escape(p.title)}`,
      `LOCATION:${escape(p.location)}`,
      `DESCRIPTION:${escape(p.owner ? `Responsible: ${p.owner}` : '')}`,
      `SEQUENCE:${p.version}`,
      'END:VEVENT',
    );
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
}
