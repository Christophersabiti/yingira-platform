# Offline continuity and reconciliation

Online admission is authoritative. Offline acceptance is provisional business continuity with weaker guarantees. The owner must enable it per event; default is off. Cache the application shell in either mode so failures remain understandable.

## Authorized snapshot

Only an authenticated, assigned device receives an offline lease. Proposed defaults: 30-minute renewable lease, expires no later than event admission close; online renewal only; maximum 2,000 cached invitation projections per gate scope pending device performance validation. Large events can disable offline or deliberately configure a measured larger limit. If no valid snapshot is available, show connectivity failure and supervisor procedure rather than inventing validation.

Snapshot contains token digests, invitation reference, minimal display name, optional permitted phone suffix, counts/version, table/directions and allowed actions. Never full phones, private notes or a general searchable guest list. Ordinary ushers cannot browse cached records through the application. Any downloadable cache increases stolen-device exposure; offline continuity therefore explicitly relaxes online lookup-only privacy. Restrict it to opted-in gate scope, disclose this risk and offer online-only events. Browser encryption alone does not protect against an unlocked compromised session.

Do not cache guest bearer-token pages or authenticated API responses in the service worker. Store only curated snapshot data in IndexedDB. Logout/lease expiry removes projections; preserve encrypted pending evidence for authenticated reconciliation under a bounded recovery policy, never silently discard unsynced actions. Clearing browser storage can lose unsynced evidence; staff must see that limitation.

## Queue and replay

Each local action records immutable clientCommandId, device sequence, leaseId, event/gate, token digest, action/quantity, base state version, device time and prior local dependency. Local counters reject obvious excess against that device's snapshot. Display PROVISIONAL ADMISSION and pending count, never server-confirmed success.

Sync authenticates current actor/device, deduplicates by device+clientCommandId, processes device order and revalidates lease-at-recording evidence, current membership, token status, event window and server constraints. Device clocks are untrusted: suspicious/expired timing requires review. Keep deviceOccurredAt separate from serverReceivedAt and acceptedAt. Sync never accepts a client-supplied actor or tenant.

For each item return ACCEPTED, CONFLICT or REJECTED with stable receipt. A version mismatch alone can be reconciled if the command still satisfies current invariants and dependency order; otherwise conflict. Dependent items remain blocked if their prior action conflicted. Conflicting commands do not increment canonical counters. Retain their physical-admission claim as separate evidence.

## Example and supervisor resolution

Capacity 1; devices A and B both provisionally admit offline. First valid synced entry consumes the slot. Second becomes OFFLINE_ADMISSION_CONFLICT; retain both device records. Dashboard displays one canonical admitted person plus one unresolved provisional claim, not a fabricated exact physical count.

Supervisor verifies whether B represents a duplicate record or an actual extra entrant. Duplicate → append reconciliation decision, no count change. Actual extra entrant → explicit capacity allowance and admission adjustment linked to conflict. Incorrect evidence → reasoned rejection. Resolving or replaying the same item never applies it twice. Original evidence is immutable in all cases.

A membership removed while offline cannot revoke a disconnected lease instantly. On reconnect, reject or escalate actions from removed devices; do not silently treat local acceptance as authorization. No offline supervisor overrides in MVP. No background sync guarantee on every phone: foreground reconnect/manual sync must work on Android and iPhone.
