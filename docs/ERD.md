# High-level entity relationships

Logical model; all event-owned relationships use composite tenant/event foreign keys as specified in [Database](DATABASE.md).

```mermaid
erDiagram
  PROFILES ||--o{ ORGANIZATION_MEMBERS : joins
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
  ORGANIZATIONS ||--o{ EVENTS : owns
  ORGANIZATIONS ||--o| SUBSCRIPTIONS : has
  EVENTS ||--|| EVENT_SETTINGS : configures
  EVENTS ||--o{ EVENT_TEAM_MEMBERS : assigns
  PROFILES ||--o{ EVENT_TEAM_MEMBERS : serves
  EVENT_TEAM_MEMBERS ||--o{ EVENT_GATE_ASSIGNMENTS : receives
  EVENT_GATES ||--o{ EVENT_GATE_ASSIGNMENTS : permits
  EVENTS ||--o{ EVENT_GATES : has
  EVENTS ||--o{ GUEST_RECORDS : owns
  EVENT_TABLES o|--o{ GUEST_RECORDS : seats
  GUEST_CATEGORIES o|--o{ GUEST_RECORDS : groups
  EVENTS ||--o{ EVENT_TABLES : owns
  EVENTS ||--o{ GUEST_CATEGORIES : owns
  EVENTS ||--o{ CUSTOM_FIELD_DEFINITIONS : defines
  CUSTOM_FIELD_DEFINITIONS ||--o{ CUSTOM_FIELD_VALUES : types
  GUEST_RECORDS ||--o{ CUSTOM_FIELD_VALUES : has
  GUEST_RECORDS ||--o{ INVITATIONS : receives
  INVITATIONS ||--o{ INVITATION_TOKENS : versions
  INVITATIONS ||--o| RSVPS : answers
  INVITATIONS ||--|| ATTENDANCE_STATE : projects
  INVITATIONS ||--o{ ATTENDANCE_TRANSACTIONS : records
  INVITATIONS o|--o{ SCAN_ATTEMPTS : resolves
  SUPERVISOR_OVERRIDES o|--o{ ATTENDANCE_TRANSACTIONS : authorizes
  EVENTS ||--o{ INVITATION_DESIGNS : presents
  INVITATION_TEMPLATES ||--o{ INVITATION_DESIGNS : instantiates
  PROFILES ||--o{ DEVICE_SESSIONS : uses
  DEVICE_SESSIONS ||--o{ OFFLINE_LEASES : holds
  OFFLINE_LEASES ||--o{ OFFLINE_SYNC_ITEMS : scopes
  EVENTS ||--o{ AUDIT_LOGS : records
  EVENTS ||--o{ REPORT_EXPORTS : produces
```

Idempotency requests, import jobs, notification records, platform admins and granular permission grants are support tables omitted from this overview for readability; see the full catalog.
