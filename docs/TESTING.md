# Verification and release gates

The repository now includes unit, database integration and browser tests for M1, with lint/typecheck/build scripts and CI. See README.md for commands and IMPLEMENTATION.md for coverage. The full-MVP matrix below remains the expansion/release target; exit/re-entry, overrides, offline and reports are not yet implemented.

## Required automated coverage

| Layer          | Cases and assertions                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit           | Positive integer quantities, RSVP bounds, masking, state transitions, report units, field projections, input sanitization                                                          |
| DB permissions | Every tenant table and command: anon, wrong tenant, same tenant/wrong event, disabled member, insufficient action, wrong gate, platform-only admin; direct API/RPC bypass attempts |
| Invitations    | Valid/invalid/revoked token, wrong event without disclosure, reissue leaves admissions intact, one active token, token generation uses CSPRNG                                      |
| Admission      | Capacity 1/4, partial 3+1, overcapacity denied, zero/negative/fractional quantity denied, duplicate request returns same receipt                                                   |
| Concurrency    | Two connections race capacity 1 with distinct keys; one succeeds; race same key yields one movement; race reissue/disable with commit follows documented locking order             |
| Movement       | Exit leaves A unchanged, re-entry ≤ outside, partial groups, missed-exit pair net zero, invalid correction rejected, repeated correction cannot over-reverse                       |
| Supervisor     | Search scoped and masked, manual reason required, capacity override audit, unauthorized override denied                                                                            |
| Offline        | Local queue, lease expiry, revoked permissions/token, duplicate batches, lost sync response, dependent ordering, clock skew, conflicting devices and explicit resolution           |
| Reporting      | Filter correctness, units, unauthorized download, revoke between generation/download, formula injection, expired file, privacy fields                                              |
| E2E            | Organizer creates event/guest/QR → guest view → usher login/scan/admit → dashboard timestamp; full expansion journeys                                                              |

Use Vitest for pure TypeScript, database SQL/pgTAP plus integration clients for actual PostgreSQL behavior, and Playwright for browser flows. Camera simulation alone is insufficient: test real Android Chrome and iPhone Safari over HTTPS, camera denial/recovery, glare/low light, scan loop and foreground offline sync. Evaluate libraries on devices before committing scanner design.

Concurrency tests use actual independent connections and a synchronized start barrier, not sequential requests or mocked counters. Assert accepted count, final state, ledger count and audit count after commit. Property-based state sequences are useful once core transitions are established. Attempt direct table writes as hostile roles to verify command-only protection.

Proposed load profile: 10 concurrent events, 20 devices each, one scan validation and one commit per device every 5 seconds, 10,000 invitations/event, plus dashboard polling. Measure p50/p95 latency, lock waits, error rate and bounded retry behavior. Targets are in PRD; no performance claim until measured.

CI gates: clean pinned install, lint, strict typecheck, unit tests, fresh migration reset, DB/RLS/integration tests, production build and critical E2E. Never fix tests by weakening auth. Each phase adds its relevant tests and closes failures before proceeding.

Demo fixture: Sabtech Events Demo / Christopher & Diana Wedding Demo. Exactly 30 invitations/50 allowed people: 18×1, 7×2, 3×3, 1×4, 1×5. Include tables, VIP/family/group fields, confirmed/declined/pending/maybe, plus a second tenant for isolation tests. Use synthetic phones/names and generated tokens, no production contacts. Keep pristine and progressed scenario fixtures separate for repeatable tests.
