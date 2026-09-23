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
