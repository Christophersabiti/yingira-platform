# Initial design review: A–T

Status: reviewed for implementation; the owner authorized work with “Start implementation.” This document preserves the original A–T proposal. Current delivered scope and refinements are recorded in [Implementation status](IMPLEMENTATION.md).

## A. Executive summary

Yingira combines personalized mobile invitations with controlled event admission. Organizations own events; event teams operate assigned gates; guests need no account. The server decides admission using a secure invitation identifier, capacity and movement history. Prove the complete online journey first, then deliver the full MVP in bounded phases.

## B. Product assumptions

Start with Uganda-oriented examples, international E.164 phone support, English UI and Africa/Kampala as the default event timezone. Store timestamps in UTC. Anonymous plus-ones are quantities, not identified people. One invitation has one primary guest and one capacity pool per event. Multiple gates share that pool; gates are not separately ticketed sub-events. Sharing links manually through WhatsApp, SMS or email satisfies initial delivery; automated provider integrations are deferred. Paid billing automation is deferred, while organizations have explicit status and plan entitlements. See [PRD](PRD.md) for proposed operating limits.

## C. Recommended MVP scope

The full MVP includes the brief's tenancy, auth, events, CSV/XLSX import, guest fields, templates, secure QR, RSVP, team/gates, scanner, group admission, exit/re-entry, supervisor exceptions, audit, limited offline continuity, dashboards and CSV/XLSX/PDF reports. The first milestone is deliberately smaller and is not the completed MVP. Photographs, rotating QR, automated WhatsApp/SMS, payments, custom domains, seating designers and marketplaces follow later.

## D. System architecture

Responsive Next.js application → authenticated server routes → PostgreSQL command functions and RLS-protected queries. Supabase supplies Auth, PostgreSQL and private object storage. Guest token routes expose only an invitation-specific projection. Attendance commands commit authorization, counters, transaction records and audit records atomically. No browser may write attendance counters directly.

## E. Stack recommendation

Next.js App Router and strict TypeScript provide one frontend/backend codebase. Tailwind and accessible Radix-based components support mobile scanner controls. Choose Supabase Auth over Clerk for this MVP to avoid a second identity system and use PostgreSQL identity-aware policies. Business roles remain in membership tables, not editable user metadata. PostgreSQL handles locking and constraints. Candidate QR libraries are `qrcode` and `qr-scanner`; validate camera behavior on real Android and iPhone devices before pinning versions. IndexedDB holds a tightly scoped offline queue. Use server-side CSV, XLSX and PDF generation; select and verify export dependencies in the reporting phase. Vercel plus managed Supabase is the proposed hosting combination; costs and region are deployment decisions. See [architecture sources](ARCHITECTURE.md#sources-checked).

## F. High-level ERD

Organization → events → guests → invitations → token versions, RSVP, attendance state and immutable transactions. Events also own team assignments, gates, tables, categories and field definitions. Actor identities connect memberships, movements, exceptions and audit. See the [diagram](ERD.md).

## G. Proposed database tables

Identity/tenancy: profiles, organizations, organization_members, platform_admins, subscriptions. Event setup: events, event_settings, event_team_members, event_team_permissions, event_gates, event_gate_assignments. Guests/design: guest_records, event_tables, guest_categories, custom_field_definitions, custom_field_values, invitations, invitation_tokens, invitation_templates, invitation_designs, rsvps. Operations: attendance_state, attendance_transactions, scan_attempts, supervisor_overrides, idempotency_requests, device_sessions, offline_leases, offline_sync_items, audit_logs, import_jobs, notification_records, report_exports. Not all tables ship in the first slice. [Database specification](DATABASE.md) defines boundaries and constraints.

## H. Attendance state model

Let C = configured capacity, O = auditable extra capacity, A = net initial admissions, P = estimated present, X = recorded outside. Maintain X = A − P, 0 ≤ P ≤ A ≤ C + O. Initial entry increments A and P. Exit reduces P, never A. Re-entry increments P only up to X. A missed-exit exception records a linked inferred exit and re-entry with zero net presence change. Corrections append explicit deltas and references; they never edit earlier transactions. Ordinary entry totals remain visible separately from corrections. Group identity cannot be proved by these counters.

## I. QR/security model

Generate 32 random bytes per token; QR holds only the HTTPS invitation URL and opaque token. Store a unique SHA-256 digest for lookup, never raw tokens in logs. Reissuing locks the invitation, revokes the old version and creates one active version atomically. Reissuing does not reset admissions. Token possession permits limited invitation viewing/RSVP, never staff actions. Repeated organizer download requires an encrypted token copy protected by a server-only key; losing that key requires reissue. Use no-store responses, no-referrer policy, log redaction and no third-party analytics on token pages.

## J. Online/offline strategy

Online is the default. Offline mode requires organizer opt-in, short-lived device authorization and a restricted snapshot; never cache the full guest database or full phones. Display offline actions as provisional. Synchronization is idempotent, validates current permissions and tokens, and records conflicts without deleting evidence or overwriting server counters. A copied QR can be provisionally accepted by two disconnected devices; no global capacity guarantee is possible in this mode. High-control events disable offline admissions. [Offline specification](OFFLINE-SYNC.md).

## K. Permissions

Organization admins manage their tenant. Supervisors handle assigned-event searches and reasoned overrides. Entry ushers validate and admit; movement ushers exit/re-enter. Permissions can combine for one staff member. Platform admins see account/usage summaries without ordinary guest access. Guest tokens access only their own invitation view and RSVP. [Complete matrix](RBAC.md).

## L. Organizer journey

Register/verify → create organization → create event/timezone/gates → customize invitation → import or add guests → resolve import errors → assign capacities/tables/categories → preview guest and usher visibility → issue/share links → invite staff and assign gates → rehearse scans → activate event → monitor attendance/exceptions → export reports → archive and apply retention policy.

## M. Guest journey

Receive link → view personalized invitation → review date/venue/directions and allowed count → RSVP with expected quantity → present QR → staff verifies name/phone suffix → enter → optionally scan out → present same QR for quantity-based re-entry. Revoked/expired links show a neutral organizer-contact message.

## N. Usher journey

Accept staff invitation → authenticate → choose assigned event and gate → allow camera → scan → server validation → verify masked information → select quantity within remaining slots → confirm → server revalidates and commits → see table/section and success → scan next. A timeout triggers receipt lookup/retry with the same idempotency key, never a new admission intent.

## O. Supervisor exceptions

Open assigned event → scan or search → verify identity → choose forgotten-phone manual entry, missed-exit re-entry, capacity override or correction → enter mandatory reason → see proposed count effects → confirm atomically → immutable record with actor/gate/time → organizer can review. Overrides cannot bypass a suspended tenant, disabled actor or wrong event.

## P. Major edge cases

Partial groups; concurrent scans; revoked tokens between preview and confirmation; reissued tokens; duplicate phone numbers; returning groups without exit scans; repeated network retries; event closure; wrong event; removed staff; stale permissions; camera denial; two disconnected devices; stale snapshots; report download after access removal; import formula injection; daylight-saving event times; corrections affecting already-returned groups.

## Q. Major risks

Highest: tenant leakage, simultaneous over-admission, missed-exit abuse, offline duplication and stolen staff sessions. Mitigate with composite tenant keys, database authorization, locked commands, constrained corrections, short offline leases and runtime membership checks. Shared QR and anonymous groups do not establish individual identity. Presence is an estimate because exit scanning is optional. Full risk register: [Security](SECURITY.md).

## R. Repository structure

Use one application with `src/app`, `src/features`, `src/lib`, `src/server`, `supabase/migrations`, `supabase/tests`, `tests`, `public`, `docs` and `.github/workflows`. Keep domain rules separate from UI; keep privileged adapters server-only. Do not scaffold empty services prematurely.

## S. Development phases

0 discovery → 1 product definition → 2 architecture → 3 UX → 4 foundation → 5–7 first online vertical slice → 5–7 remaining event/invitation/access features → 8 offline → 9 dashboards/reports → 10 security/QA → 11 deployment. [Roadmap](ROADMAP.md) supplies scope, files, schema changes, risks and exit gates for each phase.

## T. Questions that genuinely block implementation

No unanswered product detail blocks preparation. The owner has now authorized application coding. Before cloud deployment, provide/choose Supabase and Vercel projects, production domain, email provider, hosting region and retention policy. These do not block a local foundation after architecture approval. Pricing and advanced features can remain deferred.
