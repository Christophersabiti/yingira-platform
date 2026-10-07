# Shared invitation experience

## Reference research — 7 October 2026

Reference: https://felixandcindy.com/invite/hulsr2/ and the ten supplied screenshots. Inspected the rendered page, its DOM configuration, computed typography, asset/script URLs, opening panels, scroll progression, and links. No RSVP or guest action was submitted to the reference site.

Observed implementation:

- WordPress with Hello Elementor, Elementor/Elementor Pro, Dynamic Content for Elementor and a Motion.page SDK bundle. Loaded dependencies include Rellax, reveal, scrolling, anime.js and sticky scripts; loading alone does not prove each library drives a particular animation.
- Two identified envelope elements (`top-envelope` and `bottom-envelope`) translate vertically in opposite directions as the page scrolls. At one inspected position, computed transforms were approximately −681px and +649px. A central wax seal and layered dark panels expose the stationery underneath.
- Elementor data settings declare fadeIn, fadeInUp, fadeInLeft/Right, zoomIn, slideInUp and fadeInDown, with staggered delays ranging from 200ms to 2200ms. Some containers are sticky-bottom within their parent. Mobile uses specific animation overrides. This creates staged reveals rather than simply displaying one long image.
- Typography combines Hatton display names/date, Montserrat labels and light serif body copy. Inspected computed names were 64px, guest heading 24px, and envelope label 14px. These are observations at the inspected viewport, not universal breakpoints.
- Portraits use arched masks and fine gold borders. Transparent floral layers sit outside image and venue boundaries. Large vertical whitespace separates invitation moments.
- Sequence: sealed envelope → personalized salutation → first couple portrait → couple names → date → ceremony/reception → map links → conditional RSVP acknowledgment → live countdown → calendar → note → guest-specific admission QR and capacity → offline download → second portrait, quotation and floral footer.
- Map buttons are external Google Maps links. The calendar link downloads an `.ics` file despite its Google Calendar wording. The download link is a WordPress query endpoint with a post ID. Server-side validation, the database schema, QR encoding, and gate logic cannot be established from frontend inspection.

## Yingira implementation

`InvitationExperienceView` is a native React client component using CSS and IntersectionObserver; no WordPress runtime or animation library is required. It provides tap/keyboard opening plus downward wheel/upward swipe opening, native scrolling, one-time section reveals, arched portraits, decorative flowers, a live countdown, calendar download, RSVP, entrance shortcut, offline card download and closing section.

A native `details` envelope remains operable without JavaScript. Content is visible by default; reveal hiding is added only after IntersectionObserver initializes. Motion preferences are respected, and “none” disables the animations. QR admission is never reveal-hidden and its black/dark-on-white image is independent of ornamental colors.

The original floral arrangement is a generated, self-hosted transparent WebP (`public/invitation/ivory-garden.webp`, generated with the built-in image tool). Botanical and minimal designs use original SVG artwork and exact editable flower/foliage colors. Ivory garden keeps its painted ivory flowers and adds configurable botanical accents. No reference-site assets, guest identity, branding or portraits were copied.

Image-generation prompt: “Create one exquisite photorealistic watercolor wedding floral arrangement isolated on transparent background. Wide horizontal crescent swag, ivory white garden roses and white magnolia flowers with delicate gold baby's breath sprigs and muted silver sage eucalyptus foliage. Flowers concentrated at center bottom, airy tapered stems reaching to left and right, slight upward crescent. Luxurious fine art botanical wedding stationery, realistic translucent soft petals and subtle natural shadows. Absolutely no text, no frame, no paper, no people, no background. Entire composition contained with transparent margins. 3:2 landscape image. Asset for web invitation.”

## Studio and persistence

The existing studio edits `design.experience` inside the existing versioned JSON design. New fields cover shared-card format, envelope title/subtitle/seal/button/color, motion, flower style/colors, three additional photo IDs, ceremony/reception venue/time/HTTPS map links, optional guest note, closing message, and countdown/calendar visibility. Main couple photo retains its existing crop controls. Portrait uploads reuse the existing validated JPEG/PNG/WebP → WebP pipeline and 4 MB limit.

Legacy JSON receives defaults through Zod parsing, including when reopening a draft or restoring a version. Draft changes remain private until Publish design. Published versions preserve the full experience. Single-card format remains available; printable/ZIP exports continue using the established card renderer rather than capturing a multi-screen scrolling page.

The calendar uses the authoritative event start/timezone and event ID, with an estimated three-hour end. Ceremony/reception display times are host-entered text; they do not modify the main calendar time. RSVP settings and deadlines remain controlled by event operations, and the actual RSVP component is embedded only when enabled.

## Database and access

Migration `20261007154217_shared_invitation_experience.sql` adds an invoker trigger on both drafts and published versions. It verifies that all four referenced photo IDs belong to that event and preserves the existing 12 KB JSON limit. There are no new public tables, credentials, grants, or storage buckets. The function uses an empty search path and has no public execution grant.

Guest image requests still validate the current invitation token and event. Only IDs in the current published design can be fetched with that token. Draft-only and unrelated-event assets remain unavailable. Organizer reads still require event administrator access.

Existing QR URLs (`/i/<43-character token>`), capacity, table assignment, revocation, reissue, attendance accounting, concurrency and scan authorization are untouched. Downloaded invitations contain that same guest token; their design does not update after downloading.

## Release

Apply the committed migration to the target database before releasing the application changes. Do not publish a customer's draft merely to deploy the feature. Existing published designs acquire safe experience defaults; hosts can select Single printable card to retain the older public presentation.

Validation details are recorded in the task completion report. Tests cover legacy parsing, unsafe links/colors, portrait ownership, published projection, local guest access, QR decoding, offline exports and existing admission invariants.

## Verification completed

- 41 unit tests pass, including legacy design upgrades and unsafe setting rejection.
- 15 planning database checks pass, including each new photo slot, cross-event rejection, and publish-without-token-change.
- 19 admission/database checks pass, including concurrent gate admission, revoked/reissued links, scoped access and immutable attendance history.
- Four browser checks pass: complete customized mobile invitation with three separate portraits; organizer front-page editing/photo upload/publish; token-scoped image reads; calendar and offline QR decoding; 320/390/1280px overflow checks; no-JavaScript keyboard opening; scroll opening/reveals; existing guest import and PNG/PDF/ZIP export workflow.
- Production build, ESLint, TypeScript and whitespace checks pass. Supabase's local security advisor reports no issues. The migration is applied and recorded on the local database.
- Deployment is separate: no hosted migration or production publish was performed by this task.

## Readable guest URLs

Each token generation now owns a unique, stable `share_slug`, created in PostgreSQL when a token is issued (including bulk import). Existing tokens are backfilled without changing token hashes, encrypted tokens, guest IDs, or attendance. The address is `/<name-prefix>-<random-suffix>`: a lowercase ASCII name prefix capped at 24 characters, followed by 16 URL-safe random characters (96 random bits). Names that cannot form an ASCII prefix use `guest`. A unique index prevents duplicate addresses. Renaming a guest leaves the URL unchanged; reissue generates a new URL and the old one stays invalid.

The root `[slug]` route resolves aliases through a service-role-only RPC and renders the existing invitation in place. It validates the entire alias, not just the name. A bare `/florence` does not grant access. Closed events, inactive organizations and revoked tokens cannot resolve. Browser roles cannot exchange a slug for token ciphertext or list another event's URLs. Original `/i/<token>` links and all generated entrance QR codes stay valid and use the existing scanner/RSVP/admission workflow.

The studio now provides **Copy URL**, a selectable URL field for clipboard fallback, **Copy selected URLs**, and **Download selected URLs (CSV)**. CSV contains Guest name and Invitation URL, with spreadsheet-formula escaping. The server rechecks selected IDs immediately before copy/export; unavailable/revoked selections fail rather than silently exporting stale URLs. Up to 5,000 selected URLs can be exported without rendering images or applying the 100-image ZIP limit. Clear the search and choose Select matching guests to export all available guest URLs. The event guest list's existing copy/open actions use these addresses too.

New invitation and reminder email payloads include the readable URL. Previously frozen in-flight payloads remain unchanged so provider idempotency and uncertain-send recovery stay safe; their older links remain valid. No email is sent as part of verification.

Apply `20261007195143_guest_share_urls.sql` before deploying this application version. It adds a column/index and constrained RPCs to the existing private token architecture, with no direct browser table grants. It has been applied and recorded locally; hosted migration and deployment are separate.

Verification: 20 planning/database checks cover name stability, unique bulk aliases, admin isolation, service-only resolution and revocation/reissue. Unit tests verify short links in email payloads and escaped CSV formatting. Browser verification exercises clipboard copy, selected-only CSV/text export, anonymous opening at the readable address, and decodes its QR back to the original token.
