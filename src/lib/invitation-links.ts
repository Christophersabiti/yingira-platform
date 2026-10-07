import { csvText } from './planning';
export const shareSlugPattern = /^[a-z0-9][a-z0-9-]{0,23}-[A-Za-z0-9_-]{16}$/;
export type GuestUrlRow = { id: string; name: string; url: string };
export function guestUrlsCsv(rows: GuestUrlRow[]) {
  return csvText([
    ['Guest name', 'Invitation URL'],
    ...rows.map((row) => [row.name, row.url]),
  ]);
}
export function guestUrlsText(rows: GuestUrlRow[]) {
  return rows
    .map((row) => `${row.name.replace(/[\r\n\t]+/g, ' ')}\t${row.url}`)
    .join('\n');
}
