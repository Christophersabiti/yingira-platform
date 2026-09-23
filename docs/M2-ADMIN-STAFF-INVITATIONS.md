# M2: Admin, event teams and invitation studio

Status: Admin/team access and operational shifts are live. The owner approved Phases A and B; bulk guest import and Invitation Studio are implemented and under release verification. See PHASES-A-B.md for the delivered scope. The owner approved one active event/session per staff account, allowing different staff to work together.

## Delivery order

1. Admin workspace, staff onboarding, event/gate assignments and role-specific navigation.
2. Staff session controls after the owner confirms the concurrency rule.
3. Invitation studio with photo upload, templates, colour themes, preview and publishing.
4. Bulk guest import with validation, duplicate review and idempotent commit.

## Identity and access

Admin means an organization administrator, with authority over that organization's events and staff. It does not imply platform-wide access. Existing organization creators already have organization administration rights; identify the owner's existing account before provisioning or promoting an account. Never use shared passwords or allow staff to choose their own privileges.

Use one sign-in page and individual verified accounts. Admin records an invitation by email and assigns event, gate and supervisor/usher role. Admin shares the registration link manually; email sending is not yet implemented. Staff register with that email, set their own password and verify it; pending access is then claimed on login. Unassigned staff see an assignment-pending screen. Roles and assignments determine the destination after login, and all operations enforce those permissions server-side.

An account has one staff role per event; existing database uniqueness already prevents duplicate supervisor/usher rows for the same account and event. Admin can assign a person to several events, subject to the confirmed active-session rule. Disable/reassignment must take effect on the next online command, including existing sessions.

Approved rule: different assigned staff can operate concurrently; each account has one active event/session. Staff end their shift before switching. Admin can release a stuck staff shift. An abandoned shift expires after 90 seconds without heartbeat. The assigned role is taken from the database, never from the staff member's request. Admin may explicitly work as supervisor or usher, retaining their actual identity and audited support role.

For account-session exclusivity, use server-validated leases bound to Auth session and event, with atomic acquisition, heartbeat, expiry, release and audited takeover. Browser storage alone cannot enforce exclusivity. Session takeover must preserve admission idempotency receipts and never reverse committed attendance.

## Role-specific UI

| Role       | Home screen                                                      | Main actions                                                                                                                    |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Admin      | Events, Team, Guests, Invitation Studio, Reports, Settings       | Create/edit events; invite/disable staff; assign roles and gates; import guests; publish invitation designs; review activity    |
| Supervisor | Assigned events, event overview, gate activity, assistance queue | Monitor assigned event; search minimal guest records; assist ushers; record authorized exceptions with a reason and audit trail |
| Usher      | Assigned event cards, then a full-screen scanner                 | Scan, verify guest, select allowed quantity, confirm admission, see table/directions, scan next guest                           |

Every staff screen clearly displays event name/date, gate, role, connection state and an End shift action. No guest export, invitation editing or team administration for ordinary staff. If exceptions are delivered later, do not show nonfunctional supervisor buttons. Scope exception types explicitly before implementing them.

## Invitation studio

Admin edits event invitation content: hosts/title, message, date/time, venue, directions, dress code, contact information and optional schedule. Start with Elegant, Modern and Traditional templates. Offer preset palettes plus validated colour controls and an optional event/host photo, with mobile preview and sample guest personalization.

Upload JPEG, PNG or WebP with a documented size limit; verify actual content, resize and remove metadata. Organization-scoped storage permissions must prevent cross-tenant reads/writes. Deliver only intentionally published design assets to token holders; keep drafts private. Exclude arbitrary HTML/SVG uploads in this phase. Keep the QR's contrast and quiet zone independent of the selected palette.

Use draft and published design versions. Publishing updates existing online invitation pages without changing their tokens, capacity or attendance. Already downloaded/printed cards do not update automatically. Guest-specific fields override the shared design only where explicitly supported.

## Bulk guest upload

Support CSV and XLSX via a downloadable template. Initial columns: guest name, international phone, number allowed, table/directions; category and invitation message only when their corresponding fields are implemented. One row represents one invitation, which may cover multiple people.

Flow: upload → map columns → preview → review errors/duplicates → confirm import → results. Preserve phone strings and leading plus signs. Reject invalid capacities, missing required fields, unsupported/oversized files and malformed rows. Do not evaluate spreadsheet formulas. Flag likely duplicates within the file and against the selected event; never merge different guests automatically because they share a phone number.

Preview shows invitations to create and total people allowed separately. Admin confirms which valid rows to import. Use an organization/event-scoped import job and stable row keys so retries cannot create duplicate invitations. Report created, skipped and rejected rows, with a downloadable error file protected against spreadsheet formula injection. Apply documented file, row and batch limits before accepting uploads.

## Implementation boundaries and acceptance

Affected areas: Auth onboarding, dashboard/shell, event/team UI, scanner commands, guest invitation rendering, upload/import routes, Supabase migrations/storage policies and focused tests. New tables cover invitations to staff, session leases if selected, versioned designs/assets and import jobs/rows. Keep the current private-schema command boundary and tenant constraints.

Verify Admin isolation; staff assignment and revocation; role-specific routing; concurrent session acquisition/takeover if selected; unauthorized file access; invalid images; draft versus published designs; unchanged QR/attendance after design edits; import validation and duplicate/retry behavior. Run local database tests, unit tests, browser journeys, lint, typecheck and build. Apply reviewed migrations and production configuration only after verification. Existing production guest data must not be reset or reseeded.
