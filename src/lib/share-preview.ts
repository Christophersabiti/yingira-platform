import type { Design } from './planning';

// Link previews (WhatsApp, Facebook, iMessage…) for a guest's invitation.
// Pure helpers so the wording and photo choice stay testable.

export function shareTitle(design: Design | null, eventTitle: string) {
  const bride = design?.bride.trim() ?? '';
  const groom = design?.groom.trim() ?? '';
  if (bride && groom) return `${bride} & ${groom}`;
  return bride || groom || eventTitle.trim() || 'You are invited';
}

export function shareDescription(
  details: { startsAt: string; timezone: string; venue: string },
  design: Design | null,
) {
  const couple = !!(design?.bride.trim() && design?.groom.trim());
  let when = '';
  try {
    when = new Date(details.startsAt).toLocaleDateString('en-GB', {
      dateStyle: 'long',
      timeZone: details.timezone,
    });
  } catch {
    /* Leave the date out rather than fail the preview. */
  }
  const parts = [when, details.venue.trim()].filter(Boolean).join(' · ');
  const lead = couple
    ? 'You are warmly invited to celebrate with us.'
    : 'You are warmly invited.';
  return parts ? `${lead} ${parts}` : lead;
}

// The uploaded artwork or main photo comes first, then the other photos.
export function sharePhotoId(design: Design | null): string | null {
  if (!design) return null;
  return (
    design.assetId ??
    design.experience.closingAssetId ??
    design.experience.brideAssetId ??
    design.experience.groomAssetId ??
    null
  );
}
