# Security and privacy design

Threat model: hostile public token callers, dishonest guests, compromised staff devices, malicious tenant members and accidental privileged-server exposure. The database/cloud owner remains a privileged trust boundary.

| Threat                     | Required control                                                                                          | Verification                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Token guessing/enumeration | 256-bit random opaque token, digest lookup, rate limits, neutral public errors                            | Entropy construction review; rate-limit and response tests                   |
| QR sharing                 | Capacity limits, staff verification and history                                                           | Copied token cannot exceed online allowance; acknowledge identity limitation |
| Concurrent scans/replays   | Invitation row lock, idempotency key and request hash                                                     | Real parallel DB tests and lost-response retry                               |
| Cross-tenant/event IDOR    | Composite FKs, RLS, live membership, scoped queries                                                       | Negative tests for every API and RPC                                         |
| Privilege escalation       | Non-editable role source, narrow grants, fixed command permissions                                        | Tampered JWT metadata, actor ID and direct RPC tests                         |
| Stolen staff device        | Secure sessions, MFA privileged users, live disable, limited offline lease                                | Revoke between validation and commit; expiry tests                           |
| Full guest list leakage    | Minimal scan DTO, no usher guest-table access, private exports                                            | Inspect actual response bodies and direct database API                       |
| SQL injection/XSS          | Parameter binding, typed inputs, structured templates, URL allowlists, CSP                                | Hostile imports/custom fields/URLs and template payloads                     |
| CSRF/session theft         | Verified auth, secure cookies as appropriate, same-origin checks and CSRF controls for cookie-auth writes | Cross-origin mutation tests; session lifecycle review                        |
| Token leakage              | Redact paths/bodies, no-store, no-referrer, no third-party trackers, encrypted recoverable tokens         | Inspect logs, cache, analytics and redirect behavior                         |
| Offline duplication        | Opt-in provisional mode, bounded cache, explicit conflict workflow                                        | Two devices consume last slot offline                                        |
| Export exfiltration        | Private storage, short expiry, authenticated download with fresh scope check                              | Revoke role after generation, then download                                  |
| Import/export injection    | File-size/row limits, safe parsers, neutralize spreadsheet formulas on export                             | Formula-leading fields and malformed archive tests                           |
| Audit tampering            | Append-only permissions/triggers and restricted retention role                                            | Deny update/delete; verify correction chain                                  |

QR: use cryptographic random bytes, hash digest index and constant-shaped public failure. Full phone access is admin-only or explicit supervisor grant; mask even when searching by full phone. Public invitation tokens are bearer credentials: anyone possessing one can see the approved invitation projection and submit its RSVP. Do not show phone, attendance history or sensitive custom fields publicly by default.

Reissue/cancel and admission share the invitation lock; authorize against current token at commit. QR URLs must use the configured trusted origin; scanning arbitrary URLs never causes a server-side fetch. Limit input lengths, image MIME types/file sizes and link protocols. Private storage access is event-scoped. Production assets must exclude uploaded scripts and unsafe SVG unless sanitized.

Proposed rate-limit keys: IP for public resolution/auth, actor+event for scan/search, tenant for import/export. Select numeric limits through load testing; infrastructure must share limits across application instances. Authorization cannot depend on rate limiting.

Retention is configurable and reviewed before launch. Purge/pseudonymize personal fields while preserving minimal operational aggregates, document backup deletion lag, and record privileged retention actions. Never describe application append-only records as invulnerable to database administrators. Do not log full tokens, passwords, full phones or unredacted guest payloads.
