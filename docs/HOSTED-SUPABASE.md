# Hosted Supabase

Project: [yingira](https://supabase.com/dashboard/project/vewpmovgfftsppsaiput), reference `vewpmovgfftsppsaiput`, region `eu-west-1`.

On 23 September 2026 the two repository migrations were applied to this project. Select the **yingira** schema in the Table Editor to see its 13 application tables. All tables enforce RLS. No local demo guests or accounts were uploaded.

## Connection verified

On 23 September 2026, the local app was switched to this hosted project. The server-only invitation RPC was verified with a random nonexistent token, the login page loaded, and a guest lookup completed without a service error. Auth Site URL is `http://localhost:3000` with the exact `/auth/callback` redirect allowed. Credentials and the separate hosted encryption key are saved only in ignored local files. No synthetic hosted accounts or guests were created. This verifies connectivity, not a full hosted event rehearsal.

## Connect the application

The project URL and publishable key are public configuration in `scripts/setup-hosted.ts`. The server key must remain private. Save the project's existing secret API key as a single line in `.local/hosted-secret.txt`, then run:

```sh
npm run setup:hosted
npm run dev
```

The helper verifies the server-only invitation RPC before changing `.env.local`. It preserves the local environment in `.local/local.env`, saves a separate hosted encryption key in `.local/hosted.env`, and omits the local database URL. All these files are ignored by Git. Keep the hosted invitation encryption key stable and back it up securely; changing it prevents recovery of existing invitation links.

For development, configure Supabase Auth Site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/callback`. Confirm email verification is enabled. Register a fresh hosted account; local demo credentials do not exist in hosted Auth. Configure the eventual HTTPS domain and validated email delivery before deployment.

To switch back to the preserved local environment:

```sh
cp .local/local.env .env.local
```

Restart the app after switching. Database tests and demo seeding deliberately reject hosted URLs. Run these against the local environment only.

## Database changes

The hosted migration versions match the repository filenames. For future CLI work, sign in with `npx supabase login`, then run `npx supabase link --project-ref vewpmovgfftsppsaiput`. Review `npx supabase db push --dry-run` before applying new migrations. Never reset the hosted database. CLI link metadata and credentials stay ignored.

## Reviewed security advisory

The hosted advisor flags `public.yingira_command(text,jsonb)` as an authenticated executable SECURITY DEFINER function ([advisory and remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). This is the intentional command boundary: its owner is a non-login, non-BYPASSRLS role, browser roles cannot read private tables, and the function checks live identity/session and tenant/event/gate permissions. Local integration tests exercise these boundaries. Do not change it to SECURITY INVOKER or grant browser table access just to suppress the warning. Production review and remaining hardening are tracked in IMPLEMENTATION.md.

## Admin onboarding and staff access

Use the operator-only onboarding script with the intended project's ignored environment file:

```sh
node --env-file=.env.local --import tsx scripts/provision-admin.ts admin@example.com
```

This permits that verified email to create its own organization. It does not create an Auth account, send email, or grant access to an existing organization. The service credential is required; authenticated browser users cannot invoke this command. Admin registers, confirms email, creates a workspace and event, then uses Event team to invite or update supervisors and ushers. Share the registration link manually. Staff must use the exact assigned email.

Operational staff enter through `/work/[eventId]` and start a shift. One account can hold one active event/session; other staff accounts work concurrently. Admin support buttons preserve the real account identity. Release stuck shifts through Event team or wait 90 seconds after the old session stops sending heartbeats.

### Retaining invitation links across encryption-key changes

Keep `INVITATION_ENCRYPTION_KEY` stable in every environment writing to the same
hosted database. Existing invitation envelopes cannot be read with a different
key. If a previous key is needed, configure the server-only production secret
`INVITATION_PREVIOUS_ENCRYPTION_KEY`; the event page tries the current key first,
then the previous key. New invitations always use the current key. Retain the
previous key until no active envelopes require it.

On 23 September 2026, a hosted invitation created with the earlier key caused
an authenticated event page to fail during rendering. Recovery was verified
against that saved envelope without changing its QR token. Unreadable envelopes
now leave the Admin page available and expose an explicit Reissue action, which
invalidates the old QR. Regression coverage is in
`tests/unit/invitation-links.test.ts`.
