import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  suggestMapping,
  reviewRows,
} from '../../src/lib/guest-import';
import {
  csvText,
  defaultDesign,
  designSchema,
  contrast,
  guestSchema,
} from '../../src/lib/planning';
describe('guest import', () => {
  it('reads quoted CSV, commas, newlines and escaped quotes', () => {
    expect(
      parseCsv('\uFEFFName,Note\r\n"Family, A","Line 1\nLine ""2"""'),
    ).toEqual([
      ['Name', 'Note'],
      ['Family, A', 'Line 1\nLine "2"'],
    ]);
  });
  it('rejects unfinished quoted cells', () =>
    expect(() => parseCsv('"oops')).toThrow());
  it('maps common column names without requiring a vendor template', () =>
    expect(suggestMapping(['Full Name', 'Mobile', 'Pax']).name).toBe(0));
  it('does not invent a country without confirmation', () => {
    const m = suggestMapping(['Name', 'Phone', 'Pax']);
    expect(
      reviewRows([['Household', '0700000001', '2']], m, '', [])[0].error,
    ).toContain('phone');
    expect(
      reviewRows([['Household', '0700000001', '2']], m, 'UG', [])[0].guest
        .phone,
    ).toBe('+256700000001');
  });
  it('permits missing contact data and rejects fractional capacity', () => {
    expect(
      guestSchema.safeParse({
        name: 'Family',
        phone: '',
        email: '',
        capacity: 2,
        tableLabel: '',
        category: '',
        note: '',
      }).success,
    ).toBe(true);
    const m = suggestMapping(['Name', 'Pax']);
    expect(reviewRows([['Family', '1.5']], m, '', [])[0].error).toContain(
      'capacity',
    );
  });
  it('flags identical groups but not different households sharing a phone', () => {
    const r = reviewRows(
      [
        ['Alpha', '+256700000001', '2'],
        ['Beta', '+256700000001', '2'],
        ['Alpha', '+256700000001', '2'],
      ],
      suggestMapping(['Name', 'Phone', 'Pax']),
      '',
      [],
    );
    expect(r.map((x) => x.duplicate)).toEqual([false, false, true]);
  });
  it('neutralizes spreadsheet formulas and preserves quoted data in exports', () =>
    expect(csvText([['=HYPERLINK("bad")', '+256700000001']])).toContain(
      '"\'=HYPERLINK',
    ));
});
describe('invitation design', () => {
  it('validates all supported design fields', () =>
    expect(designSchema.safeParse(defaultDesign).success).toBe(true));
  it('rejects arbitrary URLs as assets and unsafe colours', () => {
    expect(
      designSchema.safeParse({ ...defaultDesign, assetId: 'https://evil.test' })
        .success,
    ).toBe(false);
    expect(
      designSchema.safeParse({ ...defaultDesign, ink: 'url(javascript:bad)' })
        .success,
    ).toBe(false);
  });
  it('measures text contrast independently from ornamental colour', () => {
    expect(contrast('#ffffff', '#000000')).toBe(21);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
  });
});
