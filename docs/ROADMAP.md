# Delivery roadmap

Status: implementation authorized; foundation and the first online slice are implemented. See [Implementation status](IMPLEMENTATION.md) for delivered behavior and validation limits. Product “MVP/Phase 1” includes engineering phases 0–11; product Phase 2 is later enhancements. Do not confuse completion of the first slice with full MVP delivery.

## Phase gates

Before each phase, restate scope, files, schema changes, risks and definition of done. After coding, run relevant tests plus lint/typecheck/build where configured; fix failures before advancing. No calendar estimates are committed until foundation and device/concurrency spikes establish velocity.

| Phase                   | Deliverable / files affected                                  | Database changes                                                      | Primary risk                               | Definition of done                                                                                         |
| ----------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 0 Discovery             | docs/PRD, DESIGN-REVIEW                                       | None                                                                  | Ambiguous group/offline semantics          | Assumptions, risks and blocking questions recorded; drafted                                                |
| 1 Product definition    | docs/PRD, RBAC, USER-JOURNEYS                                 | None                                                                  | Scope expansion                            | Stories and acceptance criteria reviewed; drafted                                                          |
| 2 Architecture          | docs/ARCHITECTURE, DATABASE, ERD, SECURITY, API, OFFLINE-SYNC | Logical design only                                                   | Tenant/concurrency flaws                   | Owner approves design, especially command authorization and offline tradeoffs; approved for implementation |
| 3 UX                    | docs/UX and future design prototypes                          | None                                                                  | Slow/ambiguous gate flow                   | Scanner/error states and organizer/guest wireframes reviewed; touch/device spike validated                 |
| 4 Foundation            | package files, src/app, src/server/auth, CI, tests, supabase  | Profiles, organizations, memberships, core audit; RLS/grants          | Auth bypass and unsafe defaults            | Clean install/build, login, tenant isolation and CI pass                                                   |
| 5A Core slice           | src/features/events, guests, team                             | Events/settings/gates/team, guests/invitations                        | Wrong-event references                     | Organizer creates event/guest, assigns authenticated usher to gate                                         |
| 6A Invitation slice     | src/features/invitations, src/app/i, token adapter            | Tokens and minimal structured design                                  | Token disclosure/reissue race              | Secure invitation opens, QR renders, revoked token fails                                                   |
| 7A Admission slice      | scanner, attendance routes/domain, dashboard                  | State, transactions, attempts, devices, idempotency                   | Double admission                           | End-to-end demo and real concurrency/replay tests pass                                                     |
| 5B Event expansion      | Guests/imports/team/admin UI                                  | Tables/categories/custom fields/import jobs, permissions, plan status | PII leakage/import corruption              | CSV/XLSX preview/commit and scoped field visibility verified                                               |
| 6B Invitation expansion | Designer, RSVP, share flows                                   | Templates/design versions, RSVP, notification metadata                | Unsafe content and confusing RSVP/capacity | All required invitation sections, RSVP and share/reissue workflows pass                                    |
| 7B Access expansion     | Movement/supervisor UI and commands                           | Overrides/corrections and expanded ledger types                       | Presence and admission mixed               | Partial groups, exit/re-entry, missed-exit, search and corrections tested                                  |
| 8 Offline               | Service worker, IndexedDB, lease/sync routes                  | Offline leases/sync evidence                                          | Unavoidable disconnected duplication       | Provisional UX, idempotent sync and reviewed conflict resolution proven on devices                         |
| 9 Dashboard/reports     | Metrics/export adapters and report UI                         | Report exports and indexes                                            | Incorrect people totals or public exports  | Full report catalog, filters, private downloads and units verified                                         |
| 10 Security/QA          | tests, security fixes, operational docs                       | Only reviewed hardening migrations                                    | Undetected tenant/device failure           | Full permission matrix, load/device/accessibility/security checks pass                                     |
| 11 Deployment           | CI/deployment config, docs/DEPLOYMENT                         | Production migrations/retention jobs                                  | Data loss or unsafe production config      | Staging rehearsal, restore evidence, observability and launch checklist complete                           |

Phases 5A–7A form milestone M1. Complete M1 before expanding 5B–7B. Build backend capacity invariants for arbitrary positive quantities in M1 even if its initial user demo uses one person; avoid a boolean checked-in schema that must be replaced.

## Milestones

- M0 — Reviewable product/architecture package: this preparation pass. Owner authorized implementation.
- M1 — Trusted online vertical slice: organizer event → one guest → secure QR → guest view → assigned usher scans → atomic admission → dashboard timestamp. Include wrong-tenant, revoked-token, duplicate-request and simultaneous-capacity tests.
- M2 — Complete online workflows: group counts, table/category/custom fields, import, invitation content/templates, RSVP, staff management, exit/re-entry and supervisor exceptions.
- M3 — Full MVP operations: offline continuity, full dashboard/report catalog, basic platform account/plan administration, synthetic demo data.
- M4 — Pilot and production readiness: security, device, load and restore gates; deployment.

## Deferred product Phase 2

Guest photos; rotating QR; WhatsApp Business/SMS automation; template marketplace; seating-plan editor and transfers; NFC/wallet; advanced analytics; custom branding/domains; public API/webhooks; vendor/meal management; contribution tracking; kiosks. Facial verification requires a separate product/privacy decision. No payment collection or individual biometric model is implied by MVP fields.
