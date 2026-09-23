# End-to-end journeys

## Organizer

Register → verify email → create organization → create event and timezone → configure admission window, gates and visibility → choose template and customize sections → preview → add guest or upload CSV/XLSX → map columns → review invalid rows/duplicates → confirm batch → set capacity/category/table/custom fields → issue invitations → copy/share links through existing WhatsApp/SMS/email apps → invite staff → staff accepts authenticated event assignment → assign gates → rehearse → activate event → monitor and resolve conflicts → close event → export filtered reports → archive/retention.

Duplicate phone policy is explicit per import (allow, skip or review); do not merge automatically. Template fields cover title/names/photos/logo/colors/background/message, schedule/programme, venue/map, dress code, RSVP/contact, gift/contribution/payment instructions, table/section/category/group and custom instructions. Payment instructions are content, not a payment processing feature.

## Guest

Open secure link → view personalized mobile page → RSVP confirmed/declined/maybe and expected quantity → review allowed count/venue/directions → show QR at gate → verify name/phone suffix → enter with party. Later party members can use the same QR for remaining slots. Exit is optional but enables recorded re-entry. A revoked link gives a neutral contact-organizer path; no other invitation or guest list is exposed.

## Entrance usher

Open web link → sign in → choose only assigned event → choose only assigned gate → permission prompt for camera → scan → validate → verify masked details → choose quantity → admit → read success, people/table/section → scan next. Capacity 4: first group of 3 leaves one slot; fourth arrival consumes it. Remaining slots are displayed separately from current presence. A second scan alone is never an admission.

## Movement usher

Select EXIT or RE-ENTRY before committing → scan → verify → choose quantity bounded by inside/outside count → confirm → show timestamp and remaining presence. Exit never restores initial slots. Same QR is quantity tracking; staff cannot infer which anonymous person is returning.

## Supervisor

For forgotten/dead phone, search within assigned event by name, normalized phone or reference → masked candidate list → verify with guest → choose manual entry → quantity and reason → confirm under normal capacity rules. For capacity exception, explicitly authorize additional allowance before/with admission. For missed exit, review current inside count → choose affected quantity → reason → atomic inferred exit plus return → preserve earlier history. For corrections, preview count deltas and reference original records; do not delete transactions.

## Revoked and wrong-event QR

Validation and commit both check active token version. Authorized staff receive REVOKED for an in-scope token. Cross-tenant tokens get generic INVALID; WRONG EVENT can be shown only when the staff member is authorized for the token's other event, without exposing its guests. Reissue preserves attendance.

## Offline and synchronization

Before event, authorized staff obtain an opt-in short-lived scoped snapshot → network fails → visible OFFLINE banner → provisional action records locally → pending badge persists → reconnect → sync ordered device commands → display accepted receipts and conflicts → supervisor reviews discrepancies → audited resolution, never silent overwrite. See [Offline](OFFLINE-SYNC.md).

## Reporting

Admin selects event, report, date/time/gate/category/table/group filters → sees people/invitation units → requests export → authorized job generates private file → authenticated download rechecks membership → export logged → link/file expires. Pending offline activity is disclosed; reports never imply unrecorded exits were observed.
