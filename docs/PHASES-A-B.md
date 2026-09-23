# Phases A and B: guests and Invitation Studio

Approved by the owner with “Go ahead with A &B”.

## Admin workflow

Open an event and select **Manage guests & bulk import** or **Invitation Studio**.

Guest import accepts CSV or XLSX up to 4 MB and 5,000 invitation rows. The 4 MB limit keeps requests below the hosting platform's request envelope. Select a sheet, map columns, explicitly choose Uganda phone normalization when needed, review validation and duplicates, select valid rows and confirm. One row is one invitation group; people allowed is its total allowance. A missing phone/email is permitted during preparation. No import sends messages. Jobs and rows persist in the database and can be resumed from Import history if the browser closes or the connection fails. Processing uses bounded 40-row requests; resume is user-driven rather than an unattended background worker. Selected known duplicates explicitly become separate invitations; newly detected duplicates at commit are skipped. Export the review report before committing if you need its original row details.

Search and category filtering apply to the guest table and CSV export. Edit a guest without replacing their token; optimistic versions prevent overwriting concurrent admission/edit state. Capacity cannot fall below admissions. Spreadsheet exports neutralize formula-like values. Unnamed party capacity remains the existing model; named household member RSVP is Phase C.

Invitation Studio provides six original layouts, palette presets and custom colours, two font families, host/couple text, photo or finished-artwork upload, crop/pan/zoom/rotation, sample or real-guest preview, undo/redo, draft autosave, explicit publication and restoration of published versions to a draft. Template switching preserves content/photo. Uploaded finished artwork remains an image, with a separate credential panel. Text within artwork is not editable.

Uploads accept JPEG, PNG and WebP up to 4 MB; the server validates and decodes them, rejects animated images, constrains dimensions/pixel count and stores a metadata-stripped WebP derivative in a private bucket. Reset crop uses that derivative; the original full-resolution upload is not retained. No client photograph is sent to a third-party design service. Low resolution is flagged. Event date/venue may be edited separately; those changes update live event details immediately.

Save/publish are version-checked. Drafts are available only to event Admins. Published assets can be retrieved only with a valid invitation for that event or authenticated Admin access. The public invitation adapter returns only the published design. Changes preserve all QR tokens and attendance records. The existing token key fallback remains supported.

Download one guest's PNG or 5×7-inch PDF from the studio. Downloads render locally in the browser; bulk ZIP/queued export, commercial print bleed/CMYK output and organization-wide reusable template libraries are not included in this increment. The PDF preserves aspect ratio and warns if a long layout would make a guest QR too small. Downloaded/printed cards do not update automatically after publication. Keep them private.

## Security and implementation

`yingira_planning` is a second focused authenticated command boundary, owned by the existing restricted non-login/non-bypass-RLS executor. Every action rechecks active organization membership and live Auth identity. Five new private tables use forced RLS: import jobs/rows and design drafts/versions/assets. There are no browser grants to these tables. The intentional SECURITY DEFINER advisory applies to this RPC as well as the original command RPC.

The private Storage bucket has no browser policies. The server-only fixed upload/download adapter uses the server secret only after event Admin authorization or valid token-to-published-asset validation. Object paths are generated from validated UUIDs; there is no arbitrary path input. Existing published and draft assets are immutable. Unreferenced uploads are currently retained; retention/cleanup is future operational work.

Dependencies are pinned. ExcelJS's UUID dependency is overridden to patched 11.1.1; the code path uses its compatible v4 export. XLSX parsing rejects formulas and checks declared ZIP expansion before parsing. Import API payloads and image bodies are size-bounded. Actual guest data is never uploaded to third-party design tools by these workflows.

## Verification

- 22 unit tests including CSV quoting/BOM, mappings, phone confirmation, duplicates, export safety and design validation.
- 12 planning integration checks including tenant isolation, confirmed-job idempotency, concurrent batches, stale guest/design writes, draft privacy, published design token preservation and a 1,000-row import.
- Existing 19 admission and 15 staff-access integration checks retained.
- Browser journey: XLSX upload, duplicate/invalid review, confirmed import, guest edit, image upload, draft save, publication, PNG/PDF download and public invitation display.
- Downloaded PNG QR decoded automatically; mobile guest page checked for horizontal overflow. Physical phone camera and printed-card rehearsal still require a real-device pilot.
- Lint, typecheck, formatting, build and dependency/security checks are run before release.

The broader plan's RSVP, automatic guest messaging, named households, seating entities, budgets, suppliers, offline admission, billing, bulk export jobs and embedded Adobe/Canva editor remain separate scope.

## Production release

Deployed to https://yingira-platform.vercel.app with migration `20260923204651_guest_import_invitation_studio`. The signed-in Admin's live guest-management page and six-layout studio were verified, including the existing guest's QR preview. No production guest data was replaced or test-imported.

Supabase reports the intentional [authenticated SECURITY DEFINER command boundaries](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable); authorization and isolation are tested. The existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled and is a separate account-security follow-up.
