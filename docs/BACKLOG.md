# First implementation backlog

Implementation authorized. YNG-001–010 have an initial M1 implementation; see IMPLEMENTATION.md for evidence and remaining device/production gates. Ordered dependencies are preserved below. Every ticket includes tests appropriate to its risk. Do not provision production services as part of a local scaffold.

| ID      | Work                                                                                                            | Depends on      | Acceptance evidence                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| YNG-001 | Pin supported runtime/package manager and Next.js/TS dependencies; scaffold strict app, lint, formatting and CI | Design approval | Clean checkout installs, lints, typechecks and builds                                            |
| YNG-002 | Local Supabase config; migrations/test harness; verified SSR auth and env example                               | 001             | Register/login/logout; unauthenticated mutation denied; no secret in browser bundle              |
| YNG-003 | Organization membership, disabled-account checks, deny-by-default RLS/grants and audit                          | 002             | Two tenants cannot read/write each other's data; direct API checks                               |
| YNG-004 | Event/settings/gates and team assignment UI/API                                                                 | 003             | Event admin scopes staff; wrong gate/event and removed staff denied                              |
| YNG-005 | Guest and invitation creation with integer capacity                                                             | 004             | Capacity 1/4 fixtures; composite FK rejects cross-event guest                                    |
| YNG-006 | Token generation/digest/encryption, issue/revoke/reissue, minimal guest template and QR                         | 005             | No PII in QR; old token invalid after reissue; guest page safe projection                        |
| YNG-007 | Protected attendance command, state/ledger, locking, idempotency and audit                                      | 005, 006        | Parallel capacity-1 requests accept one; replay same key returns one receipt; ledger/state match |
| YNG-008 | Mobile camera scanner, minimal validation projection, quantity/confirmation/error UI                            | 004, 006, 007   | Android/iPhone scan; permission denial; no duplicate submission; no raw guest table access       |
| YNG-009 | Organizer dashboard recent admissions and aggregate counts                                                      | 007             | Receipt timestamp appears; invitations and people separated                                      |
| YNG-010 | Synthetic fixture, browser journey and adversarial integration suite                                            | 003–009         | M1 demo plus tenant/token/concurrency/retry tests pass                                           |

M1 fixture can use one invitation for demonstration; full seeded 30-invitation/50-person dataset is required by M3. Subsequent tickets expand M2/M3 only after M1 evidence is recorded.

## Proposed migration order

1. Identity projections, organizations/memberships and audit foundations.
2. Events/settings, teams/gates and composite tenant constraints.
3. Guests/invitations/design/token records and private storage policy.
4. State/ledger/attempts/idempotency/device records and protected command functions.
5. Tables/categories/custom fields/import jobs and expanded permissions.
6. RSVP/templates and invitation design versions.
7. Overrides/corrections and quantity-based movement commands.
8. Offline leases, sync evidence and reconciliation commands.
9. Reporting indexes/exports and platform plan administration.

Each migration includes its explicit grants/RLS and tests. Generate migration files with the supported Supabase CLI after implementation begins; the above is a dependency plan, not an executable schema.

## Review decisions

Proposed defaults ready for owner review: Supabase-only auth; one capacity pool per event invitation; quantity-based anonymous movement; reasoned missed-exit pair; online-first with offline disabled until explicitly enabled; manual invitation sharing; draft 90-day PII retention; staged M1→M4 delivery. No further product question prevents preparation. Deployment ownership, region, domain and sender are required later.
