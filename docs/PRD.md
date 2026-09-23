# Product requirements

Status: proposed; owner approval pending. Source: the supplied Yingira product brief, 22 September 2026.

## Problem, vision and users

Organizers need attractive invitations and reliable gate operations without spreadsheets becoming admission authority. Yingira should make event admission easy to learn, accountable and safe across independent organizers.

| Persona         | Job to be done                             | Primary outcome                                          |
| --------------- | ------------------------------------------ | -------------------------------------------------------- |
| Organizer/admin | Prepare and run multiple events            | Accurate invitation allocation, visibility and reporting |
| Entrance usher  | Admit the right quantity quickly           | Clear verification and seating instructions              |
| Movement usher  | Record temporary departures/returns        | Correct quantity-based movement                          |
| Supervisor      | Resolve exceptional cases                  | Reasoned, attributable decisions                         |
| Guest           | View, RSVP and attend without registration | Simple invitation and QR experience                      |
| Platform admin  | Operate SaaS accounts                      | Organization health without routine guest PII exposure   |

## Goals and non-goals

Deliver the full MVP listed in [Design Review C](DESIGN-REVIEW.md). First prove one complete online admission journey. Preserve tenant isolation, capacity enforcement and evidence of every accepted movement. Non-goals: named plus-one identity, automated payments/billing, automatic WhatsApp/SMS, facial recognition, public ticket sales, independent gate/sub-event entitlements and guaranteed global capacity while disconnected.

## Assumptions and business rules

- One primary guest record per invitation; multiple invitations for the same person are explicit organizer choices, never inferred from phone matching.
- Quantities are positive integers for movements; capacity is positive. RSVP expected count may be zero for decline and cannot exceed capacity. RSVP never silently changes hard capacity.
- Lifecycle: event draft → active → closed → archived; only active events admit. Scheduled admission window is configured separately from displayed ceremony time.
- Invitation active/revoked/cancelled status is separate from attendance. Closing an event blocks normal gate commands; historical correction remains a restricted audited operation.
- Pending means no submitted RSVP; “no response” is a derived filter after the configured deadline, not a competing stored state. Persist confirmed/declined/maybe/pending.
- Ordinary ushers never receive full phones, private notes or bulk guest exports. Custom-field visibility cannot relax core privacy restrictions.
- Proposed pilot envelope: 10,000 invitations/event, 20 simultaneous scanning devices/event, 10 concurrent events. These are test targets, not measured capacity promises.
- Default draft retention proposal: guest PII 90 days after event close, operational audit 12 months with minimized identity. Final retention, deletion and backup policy require owner review before production.

## Functional stories and acceptance criteria

| ID    | Story                          | Acceptance criterion                                                                                                                      |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Organizer creates tenant/event | Another organization's users cannot read or modify its rows through UI, API or direct database API                                        |
| FR-02 | Organizer adds/imports guests  | CSV/XLSX preview reports row errors, duplicate phones and capacity errors before an atomic confirmed batch; retry cannot duplicate batch  |
| FR-03 | Organizer designs invitation   | Versioned template supports all content fields from the brief, optional sections, mobile preview and per-audience custom-field visibility |
| FR-04 | Organizer issues/reissues QR   | Token resolves to exactly one invitation; reissue invalidates old token without resetting state                                           |
| FR-05 | Guest views and RSVPs          | No account needed; only invitation projection returned; expected count cannot exceed allowed count                                        |
| FR-06 | Admin assigns staff/gates      | Event membership and gate assignment checked on every command; disabling staff blocks the next online command                             |
| FR-07 | Usher admits group             | Capacity 4: admit 3 then 1; further initial admission denied unless supervisor explicitly extends allowance                               |
| FR-08 | Ushers scan concurrently       | Capacity 1 and two distinct simultaneous requests produce exactly one accepted initial entry                                              |
| FR-09 | Usher records movement         | Exit leaves admission usage unchanged; re-entry bounded by recorded outside quantity                                                      |
| FR-10 | Supervisor resolves exception  | Reason, actor, quantities, target records and timestamp required; history append-only                                                     |
| FR-11 | Offline continuity             | Opt-in, visible provisional status, restricted cache, safe idempotent sync and reviewable conflict                                        |
| FR-12 | Organizer monitors/exports     | People and invitations differentiated; filters respected; authorization rechecked at file download                                        |
| FR-13 | Platform admin operates SaaS   | Account suspension blocks tenant operations; no routine guest-data access                                                                 |
| FR-14 | Organizer configures fields    | Typed values scoped to same event; table is first-class; each audience receives only permitted fields                                     |

## Non-functional requirements and success metrics

Targets to measure during pilot: online validate/commit p95 ≤ 1.5 seconds each under the pilot load; scan-to-confirm median ≤ 8 seconds excluding human conversation; dashboard freshness ≤ 5 seconds; trained usher completes normal flow after ≤ 5 minutes orientation. Release requires zero cross-tenant disclosures in the test matrix and zero over-capacity online admissions in concurrency tests. Collect latency/error counts and aggregate completion rates without QR tokens or guest PII. Accessibility target WCAG 2.2 AA, keyboard operation and large mobile controls; validate actual flows rather than claiming certification.

Dependencies: managed auth, database, HTTPS camera access, host-compatible export runtime, email delivery for staff onboarding. Risks and edge cases are tracked in [Security](SECURITY.md), [Offline](OFFLINE-SYNC.md) and [Testing](TESTING.md). Phase 2 product features remain as enumerated in Design Review C; delivery phase numbers are engineering stages, not product releases.
