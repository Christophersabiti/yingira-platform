# Phases C and D — responses, communication and event operations

## Admin workflow

Open an event and select **Responses, seating & email**.

**Household responses:** enable RSVP, optionally set a deadline, and share the existing private invitation. Guests name up to the invitation allowance, respond for each person, and optionally add meal preferences/dietary requirements. No guest login is required. The Admin can record telephone responses, including after the guest deadline. Revision checks prevent silent overwrites; response history records guest/Admin source and Admin identity. RSVP never changes admission counts. Legacy events start with RSVP disabled until the host enables it.

**Tables & seating:** create named tables and their capacities, then assign each household. The full invitation allowance is reserved so later RSVP changes cannot overbook seating. Concurrent assignments and capacity edits are checked in the database. Legacy free-text table labels remain until a managed table is assigned; managed table names override free-text changes in the guest editor. Unassign before moving guests away from a table. Table names are immutable in this release; create another table to rename and move households. Export seating/meal CSV or print the seating list. Exports include names and preferences, not phone numbers or email addresses.

**Email invitations:** filter households by response, select recipients, choose invitation or reminder, write a subject/message, and preview before confirming a queued batch. Each recipient gets a separate personalized text email linking to their private invitation. The guest card/photo is available through that link, not attached to the email. Reminders target households with no response; eligibility is checked again when a message is claimed. Invalid/missing addresses, revoked invitations and suppressed recipients are skipped. Queue up to 500 invitations per campaign. Send queued messages in bounded batches of up to 10 with **Send queued emails**; repeat for remaining messages. Queued campaigns can be cancelled. Scheduling/unattended campaigns are not enabled: reminders are sent by an Admin.

Accepted means the provider accepted a request, not that the email arrived. **Refresh delivery tracking** checks up to 20 provider records per call and records delivered, bounced, complained or failed status. Tracking is polled on demand; no open/read analytics or webhook subscriptions are claimed. Bounces/complaints suppress future sends. A frozen payload and stable provider idempotency key protect uncertain retries. After two minutes an interrupted claim can be retried. Uncertain attempts older than 23 hours move to `unknown` for human review instead of being resent outside the provider's idempotency window.

## Email activation

Email transport targets Resend's official send and retrieve APIs. Configure `RESEND_API_KEY` and `EMAIL_FROM` as server-only Vercel production environment variables, using a sender/domain verified in the provider account, then redeploy. The API key needs sending and email retrieval permissions for delivery polling. Do not add either value to Git or expose it through `NEXT_PUBLIC_` variables. No new email-provider account, domain purchase, paid plan or guest campaign is created automatically by this implementation.

Until configuration is present, the communication page permits preparation/preview and clearly disables sending. Actual sender/domain ownership and delivery require a real provider test after configuration; mocked provider tests are not evidence of external delivery. Provider pricing and quotas apply to the connected account. Use a controlled recipient list for the first live test.

Primary references: [Resend send API](https://resend.com/docs/api-reference/emails/send-email), [retrieve email and last-event status](https://resend.com/docs/api-reference/emails/retrieve-email), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Staff workflow

Start the existing assigned usher/supervisor shift. The **Guest lookup & movements** panel searches by name, last four phone digits or private invitation link. Results are limited to the active event and assigned gate context, show masked phone suffixes and the current table, and do not expose email or dietary details. Verify the guest's identity before any assisted action.

Ushers can record an exit or re-entry and submit an exception request with a reason. Supervisors refresh the request queue, record an approval/rejection reason, and may record a verified first entry without scanning a QR. Approval records the first entry atomically; it is not a reusable permission to admit again. These actions cannot bypass invitation revocation, event closure or capacity. The Admin must explicitly correct allowance or reissue credentials where required.

Exit lowers current occupancy. Re-entry is bounded by recorded exits and does not create new first-entry allowance. This release tracks household quantities, not the identity of each departing/re-entering person; staff must verify the person/party. Movement history is immutable and distinguishes first entry, exit and re-entry. Existing scanner admission behaviour remains intact. Active session/role checks apply to every staff action, including Admin support mode. Pending operations are retained in the browser session for recovery with the same request key; ending a shift is blocked until a pending operation is resolved.

## Database and release verification

Seven new private tables use forced RLS and no browser grants. `yingira_operations` is a narrowly authorized authenticated boundary owned by the existing restricted executor. Public RSVP and mail workers are service-only RPCs reached through bounded, fixed adapters. Public RSVP resolves only the invitation token's household; no public guest-name directory is introduced. New attendance kinds preserve existing counts and ledger entries. No production guests or table assignments are seeded/reset.

Validation includes tenant/role isolation; household allowance, deadlines and revision conflicts; immutable response history; concurrent table capacity; active-session lookup; supervisor exceptions; exit/re-entry races and idempotency; revoked invitations; email claim isolation, frozen payloads, suppression and uncertainty beyond the idempotency window; a browser RSVP/seating/assisted-movement journey; and the existing scanner, staff and export regressions.

Supabase's intentional [authenticated SECURITY DEFINER warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) applies to this command boundary as well. Its internal authorization and RLS ownership are part of the regression tests.

The hosted project's existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) also remains; this release does not change Auth settings.
