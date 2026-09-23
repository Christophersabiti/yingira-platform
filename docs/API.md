# Proposed API contract

Versioned under /api/v1. All schemas are validated on the server. This is a design contract, not implemented endpoints. Internal UUIDs are permitted in authenticated APIs; they never appear as public QR identity.

| Endpoint                                   | Authorization            | Behavior                                                             |
| ------------------------------------------ | ------------------------ | -------------------------------------------------------------------- |
| POST /organizations                        | Verified user            | Atomic organization + owner membership                               |
| POST /organizations/:org/events            | Org admin                | Event/settings/default gate                                          |
| GET/PATCH /events/:event                   | Scoped membership/admin  | Filtered read or settings update                                     |
| POST /events/:event/guests                 | Admin                    | Guest + optional invitation                                          |
| POST /events/:event/imports/preview        | Admin                    | File limits, column mapping, duplicate/error report                  |
| POST /events/:event/imports/:job/commit    | Admin + idempotency      | Apply confirmed valid batch; no silent partial import                |
| POST /events/:event/invitations/:id/issue  | Admin + idempotency      | Issue/reissue token and audit                                        |
| POST /events/:event/invitations/:id/revoke | Admin                    | Revoke active token, preserve attendance                             |
| GET /i/:token                              | Public bearer token      | Minimal invitation page, no-store                                    |
| POST /invitation/rsvp                      | Token in body            | Validated RSVP; CSRF/origin protections; rate limit                  |
| POST /events/:event/team                   | Admin                    | Invite authenticated staff, role/gates                               |
| DELETE /events/:event/team/:member         | Admin                    | Disable membership, audit; no historical actor deletion              |
| POST /events/:event/scans/validate         | Assigned gate staff      | token, gate, intended action; no attendance side effects             |
| POST /events/:event/attendance             | Assigned permitted staff | Atomic initial/exit/re-entry command                                 |
| GET /events/:event/receipts/:key           | Original actor or admin  | Recover committed result after timeout                               |
| GET /events/:event/guests/search           | Supervisor/admin         | Restricted results; exact normalized phone or bounded name/ref query |
| POST /events/:event/overrides              | Supervisor/admin         | Reason, target, quantities; atomic override + related movement       |
| POST /events/:event/offline/lease          | Enabled assigned staff   | Restricted snapshot/expiry/device scope                              |
| POST /events/:event/offline/sync           | Assigned device session  | Per-item accepted/conflict/rejected receipts                         |
| GET /events/:event/metrics                 | Admin                    | Authorized aggregate counters and freshness                          |
| POST /events/:event/reports                | Admin                    | Filtered asynchronous export job                                     |
| GET /events/:event/reports/:id/download    | Admin rechecked          | Authorized stream, no public bucket                                  |

Attendance request: token (or supervisor-only invitation reference), action, quantity, gateId, deviceId, expectedVersion and idempotencyKey. Actor, organization and committed timestamp are server-derived. A changed expectedVersion returns STATE_CHANGED with a fresh minimal projection; the usher confirms a new intent/key after re-verification. Retries of the identical committed request always return the original receipt even if the state has since advanced.

Success receipt: commandId, transactionIds, acceptedAt, action, quantity, initialCount, insideCount, remaining, stateVersion, table and permitted directions. Never return a raw database row or full guest contact.

Error envelope: error.code, safe message, requestId and optional retryable flag. Use 401 unauthenticated, 403 disabled/forbidden, 404 unavailable resource, 409 capacity/state/idempotency conflict, 422 invalid quantity/input, 429 throttled and 503 transient unavailable. INVALID, REVOKED, CAPACITY_REACHED, ALREADY_INSIDE, WRONG_EVENT, SUPERVISOR_REQUIRED and EVENT_CLOSED are UX codes with disclosure constrained by RBAC. Public unknown/revoked links use neutral UNAVAILABLE.

Validation is advisory only; commit repeats every permission/token/count check. Distinct scan previews do not reserve capacity. A lost response must query/retry the same key. Duplicate key + different payload never mutates state. No GET route changes attendance. Cookie-authenticated writes validate origin/CSRF protection. PII/token endpoints and authenticated views use private/no-store caching.
