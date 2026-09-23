import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = 'https://vewpmovgfftsppsaiput.supabase.co';
const publishable = 'sb_publishable_wcGg5LygRcrMl_J4Zg5WgQ_I6r6f_kx';
const secretPath = '.local/hosted-secret.txt';
if (!existsSync(secretPath))
  throw new Error(
    `Save your hosted Supabase secret key in ${secretPath}, then retry. This file is ignored by Git.`,
  );
const secret = readFileSync(secretPath, 'utf8').trim();
if (!secret || /\s/.test(secret))
  throw new Error('Expected one API secret key');
const client = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client.rpc('yingira_public_invitation', {
  p_token: randomBytes(32).toString('base64url'),
});
if (error || data !== null)
  throw new Error(
    'Hosted invitation service verification failed; environment was not changed.',
  );
mkdirSync('.local', { recursive: true });
const current = existsSync('.env.local')
  ? readFileSync('.env.local', 'utf8')
  : '';
if (current && !current.includes(url))
  copyFileSync('.env.local', '.local/local.env');
const previous = current.includes(url)
  ? current
  : existsSync('.local/hosted.env')
    ? readFileSync('.local/hosted.env', 'utf8')
    : '';
const encryption =
  previous.match(/^INVITATION_ENCRYPTION_KEY=(.+)$/m)?.[1] ??
  randomBytes(32).toString('base64');
const env =
  Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable,
    SUPABASE_SECRET_KEY: secret,
    APP_ORIGIN: 'http://localhost:3000',
    INVITATION_ENCRYPTION_KEY: encryption,
  })
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n';
writeFileSync('.local/hosted.env', env, { mode: 0o600 });
writeFileSync('.env.local', env, { mode: 0o600 });
console.log(
  'Hosted invitation RPC verified. Hosted settings saved to ignored .env.local. Restart the app.',
);
