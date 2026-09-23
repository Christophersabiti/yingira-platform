import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const output = execFileSync(
  'node_modules/.bin/supabase',
  ['status', '--output', 'json'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
const config = JSON.parse(output.slice(output.indexOf('{')));
const previous = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8')
  : '';
const encryption =
  previous.match(/^INVITATION_ENCRYPTION_KEY=(.+)$/m)?.[1] ??
  randomBytes(32).toString('base64');
const values = {
  NEXT_PUBLIC_SUPABASE_URL: config.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    config.PUBLISHABLE_KEY ?? config.ANON_KEY,
  SUPABASE_SECRET_KEY: config.SECRET_KEY ?? config.SERVICE_ROLE_KEY,
  APP_ORIGIN: 'http://localhost:3000',
  INVITATION_ENCRYPTION_KEY: encryption,
  DATABASE_URL: config.DB_URL,
};
if (Object.values(values).some((v) => !v))
  throw new Error('Local Supabase configuration is incomplete');
if (!String(values.NEXT_PUBLIC_SUPABASE_URL).startsWith('http://127.0.0.1:'))
  throw new Error('This helper is only for local development');
writeFileSync(
  '.env.local',
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
console.log(
  'Local environment configured. Secrets were written only to ignored .env.local.',
);
