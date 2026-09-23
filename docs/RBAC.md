# Authorization matrix

Every authenticated action also requires an active account, organization and applicable membership. Event roles apply only to their assigned event. Gate actions additionally require assignment to the submitted gate. Organization admins can administer their organization's events; platform administration grants no implicit organizer authority.

| Capability                            | Platform admin          | Org/event admin      | Supervisor                      | Entry usher     | Movement usher   | Guest token    |
| ------------------------------------- | ----------------------- | -------------------- | ------------------------------- | --------------- | ---------------- | -------------- |
| Accounts/plans/suspend organizations  | Yes                     | Own org profile only | No                              | No              | No               | No             |
| Events/designs/import/guest edit      | No by default           | Scoped               | No                              | No              | No               | No             |
| Invite/disable staff and assign gates | No by default           | Scoped               | No                              | No              | No               | No             |
| Scan verification projection          | No by default           | Scoped               | Assigned                        | Assigned        | Minimal assigned | No             |
| Initial entry                         | No                      | Scoped gate          | Assigned gate                   | Assigned gate   | Optional grant   | No             |
| Exit/re-entry                         | No                      | Scoped gate          | Assigned gate                   | Optional grant  | Assigned gate    | No             |
| Search by name/phone/reference        | No                      | Scoped               | Assigned                        | No              | No               | No             |
| Full guest phone                      | No                      | When needed          | Explicit extra grant only       | Never           | Never            | Never          |
| Manual entry, correction, override    | No                      | Reason required      | Reason required                 | No              | No               | No             |
| Dashboard/reports/export              | Aggregate platform only | Scoped               | Assigned exception history only | Own receipt     | Own receipt      | No             |
| Own invitation view/RSVP              | No implicit grant       | Preview permission   | No                              | No              | No               | Own projection |
| Offline snapshot/lease                | No                      | Enable policy        | Assigned opt-in                 | Assigned opt-in | Assigned opt-in  | No             |

Use allowlisted action keys: events.manage, guests.manage, invitations.manage, team.manage, attendance.validate, attendance.enter, attendance.exit, attendance.reenter, attendance.override, guests.search, guests.contact.read, reports.export. Admins may combine entry and movement actions for an individual. They cannot grant cross-tenant rights or expose full phones to ordinary ushers.

Store grants in the database; evaluate live at command execution, not only login. Do not use user_metadata for authorization. Revocation blocks subsequent online commits; an already committed request remains historical truth. Offline revocation takes effect on lease expiry or reconnection, which is an explicit limitation. Field projections omit invisible attributes server-side, including custom fields and private notes. Do not merely hide fields in CSS.

Platform support access, if later necessary, must be time-bound, explicitly authorized and audited. Do not implement a casual tenant impersonation switch.
