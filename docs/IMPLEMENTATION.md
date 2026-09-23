# Implementation status

The owner authorized implementation with “Start implementation.” This supersedes the initial design-review hold. The first delivery implements engineering foundation and the M1 online slice; it is not the entire MVP.

## Delivered

- Pinned Next.js 16 / React 19 / strict TypeScript application, responsive organizer workspace and guest invitation design.
- Supabase verified email/password registration/login, SSR session refresh and sign-out; confirmation required in local config.
- Organization tenancy, event creation/lifecycle, default main gate, confirmed-account staff assignment and immediate online disable.
- One guest/invitation record with capacity 1–100, phone suffix verification and table/direction text.
- 256-bit random QR tokens, SHA-256 lookup, AES-256-GCM encrypted token recovery, revocation and reissue without attendance reset.
- Browser camera QR scanner plus secure-link fallback; scan → verify → quantity → confirm → table/receipt. No implicit admission on scan.
- Transactional admission, live authorization checks, per-invitation locks, version checks and idempotency receipts. Pending browser requests survive reload and are scoped to event and signed-in actor.
- Append-only attendance/audit, denied scan records, five-second dashboard refresh and synthetic demo seed.
- Versioned database migrations, CI, token/request unit tests, real database integration tests and browser journey tests.

## Implementation decisions refining the proposed architecture

The M1 private schema is named `yingira`. All data tables use forced RLS and deny browser-role access. A non-login, non-bypass-RLS command role owns the only authenticated command RPC. Its policies allow the command role access; explicit tenant/event/gate authorization occurs inside the fixed command routine. There is no unrestricted authenticated table policy. Narrow private postgres-owned helpers read only necessary Auth identity/session fields because Supabase owns the auth schema permissions. These helpers are not callable by browser roles.

For the first slice, guest contact and the rebuildable attendance counters are stored with the invitation row, keeping the locking boundary simple. Capacity, consumed admissions and estimated presence are separate columns with database invariants; movement/override expansion will split normalized guest/state components as needed through migrations. Categories, multiple named recipients and a general custom-field model have not been falsely scaffolded as completed features. Tables/directions are currently a text label, not the eventual seating entity.

The minimal public-invitation projection uses a deliberately isolated server-only Supabase secret-key adapter with one fixed RPC. That key is never used for ordinary authenticated commands or shipped to the browser. Before production, replace it with a dedicated narrowly privileged token-resolver capability, or formally review retaining this broader credential boundary. Public URLs use no-store/no-referrer; application request logging is disabled to avoid token-path exposure. Hosting/CDN logs must also be configured before deployment.

The initial HTTP surface is `/api/command` with a discriminated, validated action schema, rather than every future REST resource in API.md. It rejects foreign-origin writes. Auth uses server actions and a fixed-origin confirmation redirect. Platform rate limits and auth-provider controls require production configuration; the database enforces a per-actor authenticated command limit. Production-grade public token-resolution throttling remains a hardening task.

Staff onboarding currently requires registration and confirmed email before an organizer assigns that email. Sending staff invitation emails is not implemented. Guest links are shared manually. Supervisors currently have the same initial-entry capability as ushers; exception actions arrive in M2.

UI uses scoped semantic CSS and Lucide icons without a component-library dependency. No third-party fonts, analytics or scripts load on guest invitation pages. Tailwind/Radix can be introduced where they provide a concrete accessibility or maintenance benefit.

## Verification evidence

- Token entropy construction, encrypted envelope tampering/wrong-key rejection, trusted-origin QR parsing and integer/request validation.
- Actual local database checks for cross-tenant reads, direct browser-role denial, forbidden usher writes, composite tenant foreign keys, revoked/invalid/wrong-event tokens and removed staff.
- Two different authenticated ushers contend for the last slot: one accepted command, one ledger entry. Identical-key retries converge on one receipt. Group 3+1 consumes exactly four slots.
- Browser loss of an admission response followed by page reload/recovery returns the existing admission, without increasing its count.
- A clean local reset rebuilds the database from migration files. The hosted security advisor flags the intentional authenticated SECURITY DEFINER command boundary; see [the reviewed advisory](HOSTED-SUPABASE.md#reviewed-security-advisory).

Final local result: **10 unit tests, 19 database integration checks and 6 browser tests passed**. Lint, strict typecheck, formatting, production build and dependency audit also passed (no reported production dependency vulnerabilities). Registration/email confirmation and the QR decoder were exercised; camera input used a simulated video stream. No CI run on GitHub or physical camera/device test is implied by these local checks.

## M2 team access increment

- Operator-authorized Admin onboarding; verified ordinary users cannot create an organization to self-promote. Existing organization administrators retain access.
- Pending staff invitations by email, automatic verified-email acceptance, cancellation, role/gate reassignment and immediate disable. Admin shares the registration link manually; no invitation email is sent automatically.
- Role-directed staff workspace, usher scanner and supervisor live arrival overview. Admin has explicit Work as supervisor / Work as usher buttons without impersonation.
- Account-wide Auth-session-bound shifts, atomic acquisition, 20-second heartbeat and 90-second expiry, explicit end and scoped Admin release. Every admission rechecks the shift. Different staff can operate the same event concurrently. Database audit preserves Admin support role and real actor.
- Supervisor guest search, exception overrides, invitation designer and bulk import are still pending.

Verification: 15 staff-access integration checks, 19 admission integration checks, 10 unit tests and 8 browser scenarios passed (the final invitation scenario passed after its accessible-label correction). Lint, typecheck, format check, production build and local security advisor passed. Production rollout approved on 23 September 2026. The hosted staff migration is applied and Admin onboarding is enabled; the application deploys from main.

## Next delivery: M2

CSV/XLSX import and duplicate review; normalized tables/categories/custom fields; richer invitation templates and RSVP; extra gates and invitation-based team onboarding; exit/re-entry; supervisor search/manual entry/overrides/corrections. Then M3 adds controlled offline reconciliation, reporting and platform account administration.

Before production: complete the full permission/retention/export/offline model, MFA for privileged users, shared public-rate limits, privacy-safe hosting logs, CSP and other deployment hardening, validated email delivery, accessibility audit, actual Android/iPhone camera rehearsal, load tests at the documented pilot envelope, and backup/restore evidence. These are release tasks, not claims of completed work.

## Phases A and B

The owner approved guest import and Invitation Studio. See [Phases A and B](PHASES-A-B.md) for workflows, security boundaries, verification and remaining roadmap scope. CSV/XLSX import, guest search/edit/export, six card layouts, themes, photo upload, versioned publication and individual PNG/PDF downloads are implemented.
