import { describe, expect, it } from 'vitest';
import { venueDirections } from '../../src/components/invitation-card';

describe('printed venue directions', () => {
  it('uses the destination and place ID while leaving origin to the guest', () => {
    const result = new URL(
      venueDirections(
        'Church',
        'https://www.google.com/maps/dir/?api=1&origin=Old+location&destination=Namirembe&destination_place_id=abc',
      ),
    );
    expect(result.searchParams.get('destination')).toBe('Namirembe');
    expect(result.searchParams.get('destination_place_id')).toBe('abc');
    expect(result.searchParams.has('origin')).toBe(false);
  });
  it('converts search coordinates into a directions destination', () => {
    const result = new URL(
      venueDirections('Reception', 'https://maps.google.com/?q=0.313,32.582'),
    );
    expect(result.searchParams.get('destination')).toBe('0.313,32.582');
  });
  it('uses the configured venue for missing or shortened map links', () => {
    for (const map of ['', 'https://maps.app.goo.gl/example']) {
      expect(
        new URL(venueDirections('Serena Hotel, Kampala', map)).searchParams.get(
          'destination',
        ),
      ).toBe('Serena Hotel, Kampala');
    }
  });
});
