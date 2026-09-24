# Yingira

Multi-tenant digital invitations and guest access management for event organizers.

## Current status

The foundation and first online implementation slice are built. The app supports verified account login, organization and event setup, staff gate assignment, guest invitations, secure QR links, revocation/reissue, mobile scanning, explicit quantity admission and live arrival totals.

The remaining full-MVP features are tracked in [the roadmap](docs/ROADMAP.md). See [implementation status](docs/IMPLEMENTATION.md) for delivered scope, design refinements and production-readiness limits.

## Hosted Supabase

The database schema is installed in the [yingira Supabase project](https://supabase.com/dashboard/project/vewpmovgfftsppsaiput). See [hosted setup](docs/HOSTED-SUPABASE.md) for app credentials, environment switching and future migrations.

## Run locally

Requirements: Node.js 24, npm and Docker Desktop running. Yingira uses dedicated local ports **56321–56329** to avoid another local Supabase project.

```sh
npm ci
npx supabase start -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
npm run setup:local
npm run dev
```

Open [the application](http://localhost:3000). Register and confirm your email using [local test mail](http://127.0.0.1:56324), then sign in. The first organizer creates a workspace, creates an event, adds guests and opens check-in. Staff register/confirm their own accounts; organizers assign their email to an event/gate in **Event team**.

`setup:local` writes connection settings and a generated encryption key only to ignored `.env.local`. It preserves an existing encryption key because changing that key makes previously issued invitation links unrecoverable. No cloud project is needed. See `.env.example` for the variable contract.

Optional synthetic demo:

```sh
npm run seed:demo
```

This creates Sabtech Events Demo, Christopher & Diana Wedding Demo, an organizer and usher, and **30 invitations / 50 allowed people**. Random local-only login credentials are saved in ignored `.local/demo-credentials.json`. No guest is admitted automatically. RSVP, categories and movement are later milestones.

## Verify

```sh
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run test:staff
npm run test:db
npx playwright install chromium
npm run test:e2e
```

Database tests use the actual local Auth/API/PostgreSQL services and create fresh synthetic accounts. Run `test:db` before `test:e2e` to refresh its fixture. The browser suite tests organizer creation, a guest invitation, usher admission after a deliberately lost response, and dashboard timestamps. An installed Chrome can be used locally with `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

To verify migrations from scratch, `npx supabase db reset --local --no-seed` resets **this local project's data**; run tests or the demo seed again afterward. Never run a reset against a shared/production database. CI runs static checks plus local database and browser suites. Physical Android/iPhone camera rehearsal is still required before an event pilot.

## Documentation

| Document                                                  | Purpose                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| [PRD](docs/PRD.md)                                        | Scope, assumptions, acceptance criteria and success measures |
| [Architecture](docs/ARCHITECTURE.md)                      | Stack, boundaries, decisions and repository layout           |
| [Database](docs/DATABASE.md) / [ERD](docs/ERD.md)         | Relationships, constraints and attendance state              |
| [Security](docs/SECURITY.md) / [RBAC](docs/RBAC.md)       | Threats, privacy and permissions                             |
| [User journeys](docs/USER-JOURNEYS.md) / [UX](docs/UX.md) | Organizer, guest and event-day flows                         |
| [API](docs/API.md)                                        | Proposed contracts and transactional behavior                |
| [Offline sync](docs/OFFLINE-SYNC.md)                      | Degraded operation and reconciliation                        |
| [Reporting](docs/REPORTING.md)                            | Metric definitions and export catalog                        |
| [Testing](docs/TESTING.md)                                | Required checks and release gates                            |
| [Deployment](docs/DEPLOYMENT.md)                          | Environments, operations and prerequisites                   |
| [Roadmap](docs/ROADMAP.md) / [Backlog](docs/BACKLOG.md)   | Phases and first implementation tickets                      |

## Working rules

Before each phase, identify scope, affected files, database changes, risks and definition of done. Use strict TypeScript, validated server inputs, explicit database permissions, migrations and append-only attendance history. Run applicable tests, lint and type checks before completing an implementation phase. Never commit credentials or production guest data.

Do not deploy this first slice as the full MVP. The remaining release gates are documented in `docs/IMPLEMENTATION.md`.

## Guest import and Invitation Studio

Open an event as Admin, then select **Manage guests & bulk import** or **Invitation Studio**. See [the workflow guide](docs/PHASES-A-B.md). Run `npm run test:planning` against the local stack for import and design permission checks; Storage must be enabled for the browser photo-upload test.

## Responses, communication and event operations

Open an event as Admin, then select **Responses, seating & email**. Staff use **Guest lookup & movements** during an active shift. See [the C/D workflow and email activation guide](docs/PHASES-C-D.md). Run `npm run test:operations` against the local stack for RSVP, seating, movements and mail-queue checks. Email sending requires a verified Resend sender and server-only production credentials.

## Whole-event planning and commercial tools

Open **Plan event & billing** from an event. Manage tasks, programme, suppliers, budgets/deposits, client reviews and invoices; use **Business** for planner branding, packages, prepaid Yingira subscriptions and WhatsApp scheduling. Uganda/UGX and Pesapal are the initial payment target. See [the E/F workflow and provider setup guide](docs/PHASES-E-F.md). Run `npm run test:commerce` locally. Checkout and message dispatch require real provider configuration; no subscription prices or campaigns are published automatically.
