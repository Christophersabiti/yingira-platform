# Deployment preparation

A local Docker/Supabase stack has been provisioned for development and tests. No cloud infrastructure has been provisioned. Proposed topology: Vercel web/server and managed Supabase PostgreSQL/Auth/Storage, with separate local, staging and production environments.

## Prerequisites

After architecture approval, local foundation can proceed with pinned tools and a local Supabase environment. Before staging/production choose project ownership, region, domain, verified transactional email sender, commercial plan/limits and data retention. Configure DNS and HTTPS for camera access. Keep real guest data out of preview environments.

Expected configuration: public Supabase URL/publishable key; server-only token encryption key with key ID; canonical app origin; privileged maintenance credentials only where needed; email provider configuration; observability DSN with PII scrubbing. Confirm exact SDK variable names during foundation. Publishable keys are not a substitute for RLS. No secret belongs in NEXT_PUBLIC variables or Git.

## Delivery sequence

1. Foundation creates lockfile, env example, CI and migration setup; run from a clean checkout.
2. Create staging project; configure Auth redirect allowlist and email delivery; apply reviewed migrations including grants/RLS together.
3. Load synthetic seed; run isolation/concurrency/device tests against staging; inspect database security advisors and explicit RPC permissions.
4. Configure production secrets, least-privilege storage and rate limiting. Use backward-compatible migrations before application deployment.
5. Deploy, verify health and a synthetic authorized journey, confirm dashboard/report access and log redaction.
6. Record release commit, migration version, rollback plan and operator contacts. Revert app release only if schema is compatible; prefer forward corrective migrations for data-bearing changes.

## Operations

Monitor auth and command failures, latency, DB lock contention, offline conflicts, export failures, unusual rejected token volume and storage/DB growth. Alert on meaningful thresholds established by pilot. Never include token paths or guest details in alerts.

Select backup/PITR coverage and frequency based on confirmed plan. Proposed recovery targets: RPO ≤1 hour and RTO ≤4 hours, requiring a measured restore rehearsal before launch. Do not promise these targets without provider capability and evidence. Restore staging from a protected backup, verify migrations/ledger reconciliation and isolate credentials. Document loss of unsynced browser transactions as outside server backup coverage.

Production gate: owner-approved design and retention policy, complete MVP acceptance tests, device rehearsal, load results, tenant audit, verified sender, backup restore evidence and named incident owner. No automatic billing, domains or cloud resources are created by this documentation phase.
