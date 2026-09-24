import { describe, expect, it } from 'vitest';
import { parseMoney, moneyInput } from '@/lib/commerce';
import { programmeCalendar } from '@/lib/calendar';
describe('exact event money', () => {
  it('uses whole UGX and exact decimal minor units for supported currencies', () => {
    expect(parseMoney('250000', 'UGX')).toBe(250000);
    expect(parseMoney('123.45', 'USD')).toBe(12345);
    expect(parseMoney('0.1', 'KES')).toBe(10);
    expect(moneyInput(12345, 'USD')).toBe('123.45');
  });
  it('rejects rounding, negative, overflow and scientific-notation amounts', () => {
    for (const s of ['1.1', '-1', '1e5', '1000000000001', 'Infinity', '1,000'])
      expect(() => parseMoney(s, 'UGX')).toThrow();
    expect(() => parseMoney('1.001', 'USD')).toThrow();
  });
});
describe('calendar export', () => {
  it('escapes content, preserves UTC times and folds Unicode to RFC line lengths', () => {
    const value = programmeCalendar(
      'event',
      'Wedding, reception',
      [
        {
          id: 'item',
          title: 'Hello, guests; ' + '🎉'.repeat(40) + '\nBEGIN:VEVENT',
          startsAt: '2027-01-01T13:00:00+03:00',
          endsAt: '2027-01-01T14:00:00+03:00',
          owner: 'Planner',
          location: 'Garden',
          supplierId: null,
          notes: 'Private supplier note',
          version: 2,
        },
      ],
      '2026-09-24T10:00:00Z',
    );
    expect(value).toContain('DTSTART:20270101T100000Z');
    expect(value).toContain('SEQUENCE:2');
    expect(value).not.toContain('Private supplier note');
    expect(value).toContain('\\nBEGIN:VEVENT');
    expect(
      value
        .split('\r\n')
        .every((l) => new TextEncoder().encode(l).length <= 75),
    ).toBe(true);
    expect(value.match(/\r\nBEGIN:VEVENT/g)).toHaveLength(1);
  });
});
