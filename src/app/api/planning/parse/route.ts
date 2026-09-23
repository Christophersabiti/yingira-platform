import ExcelJS from 'exceljs';
import { z } from 'zod';
import { boundedBody, planningDb, requireOrigin } from '@/server/planning';
import { parseCsv } from '@/lib/guest-import';
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const p = new URL(request.url).searchParams;
    await planningDb(z.string().uuid().parse(p.get('eventId')));
    const buffer = await boundedBody(request, 4_000_000);
    const kind = p.get('kind');
    let sheets: { name: string; rows: string[][] }[];
    if (kind === 'csv')
      sheets = [{ name: 'CSV', rows: parseCsv(buffer.toString('utf8')) }];
    else if (kind === 'xlsx') {
      // Bound ZIP expansion before the workbook parser allocates cell data.
      let expanded = 0,
        entries = 0;
      for (let i = 0; i + 46 <= buffer.length; i++) {
        if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
        expanded += buffer.readUInt32LE(i + 24);
        entries++;
        if (expanded > 25_000_000 || entries > 500)
          throw Error(
            'Workbook expands beyond the safe limit. Save a smaller file or CSV.',
          );
      }
      if (!entries) throw Error('Invalid XLSX workbook.');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as never);
      if (workbook.worksheets.length > 20)
        throw Error('Use a workbook with at most 20 sheets.');
      sheets = workbook.worksheets.map((sheet) => {
        if (sheet.rowCount > 5001 || sheet.columnCount > 100)
          throw Error('Use at most 5,000 guests and 100 columns.');
        const rows: string[][] = [];
        sheet.eachRow((r) => {
          const values: string[] = [];
          for (let i = 1; i <= sheet.columnCount; i++) {
            const cell = r.getCell(i);
            if (cell.type === ExcelJS.ValueType.Formula)
              throw Error(
                'Replace spreadsheet formulas with values before upload.',
              );
            const v = cell.text;
            if (v.length > 10000) throw Error('Cell too long.');
            values.push(v);
          }
          rows.push(values);
        });
        return { name: sheet.name, rows };
      });
    } else throw Error('Choose a CSV or XLSX file.');
    if (sheets.some((s) => s.rows.length > 5001))
      throw Error('Use at most 5,000 guest rows.');
    return Response.json({ sheets });
  } catch (e) {
    return Response.json(
      { message: e instanceof Error ? e.message : 'Cannot read file' },
      { status: 400 },
    );
  }
}
