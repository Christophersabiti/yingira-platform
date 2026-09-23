# UX specification

Mobile usher operation has priority. Use ≥44px touch targets, readable contrast, text and icons alongside color, screen-reader status announcements and visible network state. Do not require app installation.

| Surface             | Primary information/actions                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Organizer home      | Organizations, upcoming events, create event                                              |
| Event dashboard     | Separate invitation/people totals, estimated presence, gate status and conflicts          |
| Guests              | Search/filter, import preview, capacity, RSVP, table/category/custom fields, issue/revoke |
| Invitation designer | Template, structured content controls, guest mobile preview, publish version              |
| Guest invitation    | Event/guest details, capacity, QR, RSVP, venue and optional content                       |
| Team                | Event permissions, gates, invitation status, disable access                               |
| Scanner             | Event/gate/mode/network header; camera; verify panel; quantity; confirmation              |
| Supervisor          | Restricted search, movement history, reasoned actions and correction preview              |
| Reports             | Defined metrics, filters, export status and expiry                                        |

Scanner panel: VALID INVITATION; guest name; masked phone; ALLOWED, ADMITTED, REMAINING, ESTIMATED INSIDE; allowed custom fields; quantity selector; ADMIT. For remaining capacity one, default quantity one; never default to the full group silently. Success: ADMITTED SUCCESSFULLY, accepted quantity, table, section, timestamp, SCAN NEXT. Disable repeated submission while pending; unknown outcome triggers receipt recovery.

| State                         | Message/action                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Invalid/revoked               | Do not admit; contact supervisor                                                            |
| Wrong event                   | Switch only to an authorized event or refer supervisor                                      |
| Already inside                | Initial capacity may still remain; choose appropriate mode; missed-exit requires supervisor |
| Capacity reached              | No initial entry; supervisor escalation; movement still possible                            |
| Partial remaining             | Bound quantity to remaining; state count visibly                                            |
| Valid re-entry                | Show recorded outside pool and last exit                                                    |
| Network failure               | Unknown outcome: check receipt; otherwise retry or authorized offline mode                  |
| Offline                       | Provisional status, snapshot age and pending count; never online success wording            |
| Sync conflict                 | Keep evidence; supervisor review; no auto-retry as new action                               |
| Camera denied                 | Explain browser permission steps; supervisor search fallback                                |
| Guest not found               | Refine authorized search; avoid cross-tenant suggestions                                    |
| Disabled account/closed event | Stop gate actions; organizer contact path                                                   |
| Supervisor required           | No ordinary-usher override shortcut                                                         |

Validate on narrow mobile screens, landscape, glare, low light, low bandwidth, keyboard-only navigation and screen readers. Full visual design and clickable wireframes are phase 3 deliverables; this file is the interaction contract.
