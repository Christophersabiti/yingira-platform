import { describe, it, expect } from 'vitest';
import { defaultDesign, type Design } from '../../src/lib/planning';
import {
  shareDescription,
  sharePhotoId,
  shareTitle,
} from '../../src/lib/share-preview';
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const design = (over: Partial<Design> = {}): Design => ({
  ...defaultDesign,
  ...over,
});
describe('share preview', () => {
  it('names the couple when both names are set', () =>
    expect(
      shareTitle(design({ bride: 'Dora', groom: 'Kisembo' }), 'Wedding'),
    ).toBe('Dora & Kisembo'));
  it('falls back to the event name', () => {
    expect(shareTitle(design(), 'Annual Gala')).toBe('Annual Gala');
    expect(shareTitle(null, 'Annual Gala')).toBe('Annual Gala');
  });
  it('prefers the main artwork, then other photos, else none', () => {
    expect(sharePhotoId(design())).toBeNull();
    expect(sharePhotoId(design({ assetId: id(1) }))).toBe(id(1));
    expect(
      sharePhotoId(
        design({
          experience: { ...defaultDesign.experience, brideAssetId: id(2) },
        }),
      ),
    ).toBe(id(2));
  });
  it('describes the date and venue', () =>
    expect(
      shareDescription(
        {
          startsAt: '2026-12-12T10:00:00Z',
          timezone: 'Africa/Kampala',
          venue: 'Speke Resort',
        },
        null,
      ),
    ).toBe('You are warmly invited. 12 December 2026 · Speke Resort'));
});
