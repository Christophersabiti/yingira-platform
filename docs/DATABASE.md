# Database specification

Proposed logical schema, not an executed migration. UUID primary keys; timestamptz in UTC; normalized E.164 contacts; database-generated committed timestamps. All event-owned records carry organization_id and event_id. Define unique parent tuples and composite foreign keys so a child cannot reference a guest, gate, table, token, actor assignment or invitation from another event/tenant.

## Table catalog

| Tables                                            | Important attributes / constraints                                                                                           | Delivery            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| profiles                                          | id references auth.users; display_name; disabled_at; no client-writable role                                                 | Foundation          |
| organizations, organization_members               | status; unique organization/user; role; active status                                                                        | Foundation          |
| platform_admins, subscriptions                    | restricted platform membership; manual plan/status/limits, no card data                                                      | Full MVP            |
| events, event_settings                            | organization; title; timezone; UTC start/end/admission window; lifecycle; offline/visibility policy                          | Slice then expand   |
| event_team_members, event_team_permissions        | unique event/user; active; built-in role plus controlled action grants                                                       | Slice then expand   |
| event_gates, event_gate_assignments               | event-scoped gate; unique member/gate                                                                                        | Slice               |
| guest_records                                     | event; name; protected full phone; suffix; category/table; optional future photo reference                                   | Slice then expand   |
| event_tables, guest_categories                    | unique event/name; section; optional table capacity                                                                          | Expansion           |
| custom_field_definitions, custom_field_values     | unique event/key; typed definition; audience flags; unique guest/definition; same-event FK                                   | Expansion           |
| invitations                                       | primary_guest_id; type; base_capacity > 0; status; display reference unique in event                                         | Slice               |
| invitation_tokens                                 | invitation; digest unique; encrypted token; key version; issued/revoked timestamps; one active token per invitation          | Slice               |
| invitation_templates, invitation_designs          | sanitized structured content; template version; event design; publish version; private asset references                      | Slice then expand   |
| rsvps                                             | unique invitation; status; expected_quantity; responded_at; change audited                                                   | Expansion           |
| attendance_state                                  | unique invitation; initial_count; inside_count; override_allowance; version; invariants below                                | Slice               |
| attendance_transactions                           | immutable command/type/quantity/deltas; actor/gate; accepted_at; device_occurred_at; source; override/correction references  | Slice then expand   |
| scan_attempts                                     | valid/denied result; optional resolved invitation; actor/event/gate/time; no raw token                                       | Slice               |
| supervisor_overrides                              | actor; type; reason; quantity; related command and target; immutable                                                         | Expansion           |
| idempotency_requests                              | unique tenant/actor/key; canonical request hash; committed result; retry expiry policy                                       | Slice               |
| device_sessions                                   | user; opaque registered device; session reference; revoked_at; last_seen                                                     | Slice               |
| offline_leases, offline_sync_items                | event/device/gate scope; expiry; snapshot version; unique device/client command; pending/accepted/conflict/rejected/resolved | Offline             |
| audit_logs                                        | actor/action/entity; redacted before/after; event/tenant; timestamp; request ID                                              | Slice               |
| import_jobs, notification_records, report_exports | ownership, source checksum/status, batch ID; delivery metadata; private export path, filters, expiry                         | Expansion/reporting |

Invitation recipients are not separate named attendees in MVP: the primary guest record owns delivery contact. Add a recipients join table only if multi-recipient delivery becomes necessary. Roles use fixed action definitions and controlled per-member grants; a user-authored role designer is deferred. Event tables are named event_tables to avoid ambiguous SQL names.

## Attendance state and invariants

C is invitations.base_capacity. O is attendance_state.override_allowance. A is initial_count (net consumed initial slots). P is inside_count. X = A − P is recorded outside. Constraints: C > 0; O ≥ 0; 0 ≤ P ≤ A ≤ C + O. Changing base capacity below A − O is rejected. Counter-changing commands serialize on the invitation/state row. The state is a rebuildable projection of append-only deltas; never independently edit it.

| Command                               | Preconditions                                                  | Delta A  | Delta P   |
| ------------------------------------- | -------------------------------------------------------------- | -------- | --------- |
| INITIAL_ENTRY / MANUAL_ENTRY q        | q>0, A+q≤C+O; manual requires supervisor reason                | +q       | +q        |
| EXIT q                                | q>0, q≤P                                                       | 0        | −q        |
| RE_ENTRY q                            | q>0, q≤X                                                       | 0        | +q        |
| SUPERVISOR_RE_ENTRY q for missed exit | q>0, q≤P; supervisor and reason                                | 0        | 0         |
| CAPACITY_OVERRIDE k                   | supervisor; explicit extra allowance; reason                   | 0        | 0; O += k |
| CORRECTION                            | supervisor; references original records; valid resulting state | explicit | explicit  |

Missed-exit command writes linked EXIT (inferred) and SUPERVISOR_RE_ENTRY movements atomically, documenting that the physical absence was not observed. It does not create spare first-entry capacity. Corrections specify signed initial/presence/allowance deltas, cannot reverse more than an original record's remaining uncorrected amount, and must preserve all constraints. Count original entry quantities, net admissions and corrections separately in reports.

Derived labels: NOT_ARRIVED when A=0; INSIDE when P=A>0; PARTLY_OUTSIDE when 0<P<A; OUTSIDE when P=0<A. Remaining first-entry slots = C+O−A, independent of these labels. Revoked status and offline uncertainty are overlays, not movement states.

## Atomic command sequence

1. Authenticate and check active session. Begin transaction; acquire membership/event authorization locks consistently so disabling access and admission have an explicit serialization order.
2. Claim idempotency key. Existing same hash returns prior receipt; different payload rejects. Concurrent same-key calls converge on one result.
3. Lock invitation then state; revalidate active tenant/event, actor permission/gate and active token version under the lock. Token reissue and capacity edits use the same lock order.
4. Validate quantity, available capacity or outside pool and permitted override. Append command transaction, state update, scan outcome and audit record in one commit.
5. Return receipt including transaction ID, server timestamp, new version, remaining count and directions. A rolled-back request makes no partial admission.

Denied scans live in scan_attempts, not the attendance ledger, because they do not change attendance. Unknown/cross-tenant attempts do not store another tenant's invitation reference. Index tenant/event/time for reporting; token digest for lookup; invitation/time for history; membership user/event; and event/normalized phone for supervised search. Define indexes with actual query plans during implementation.

Protect ledger/audit from UPDATE/DELETE by application roles and guard triggers; use correction records. This is application-level immutability, not protection against the database owner. Scheduled retention/pseudonymization is privileged, documented and audited. Avoid cascades that erase attendance evidence.
