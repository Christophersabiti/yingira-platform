import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { issueToken } from '../src/lib/tokens';
import type { EventDetail, Result } from '../src/lib/contracts';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.startsWith('http://127.0.0.1:56321'))
  throw new Error(
    'Demo seeding is allowed only on the dedicated local Yingira stack',
  );
const config = { auth: { persistSession: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, config);
const owner = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  config,
);
if (existsSync('.local/demo-credentials.json')) {
  const prior = JSON.parse(
    readFileSync('.local/demo-credentials.json', 'utf8'),
  );
  const signed = await owner.auth.signInWithPassword({
    email: prior.organizer,
    password: prior.password,
  });
  if (!signed.error) {
    console.log(
      'Existing demo is ready. Credentials: .local/demo-credentials.json',
    );
    process.exit(0);
  }
}
const password = randomBytes(24).toString('base64url'),
  organizer = 'organizer@yingira.test',
  usher = 'usher@yingira.test';
for (const email of [organizer, usher]) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}
const signed = await owner.auth.signInWithPassword({
  email: organizer,
  password,
});
if (signed.error) throw signed.error;
async function call(action: string, data: Record<string, unknown> = {}) {
  const { data: result, error } = await owner.rpc('yingira_command', {
    p_action: action,
    p_data: data,
  });
  if (error) throw error;
  const r = result as Result<{ id: string }>;
  if (!r.ok) throw new Error(r.message);
  return r.data;
}
const org = await call('create_organization', { name: 'Sabtech Events Demo' });
const event = await call('create_event', {
  organizationId: org.id,
  title: 'Christopher & Diana Wedding Demo',
  venue: 'Kampala · The garden pavilion',
  startsAt: '2026-12-19T11:00:00Z',
  timezone: 'Africa/Kampala',
});
const info = await owner.rpc('yingira_command', {
  p_action: 'event',
  p_data: { eventId: event.id },
});
if (info.error) throw info.error;
const detail = info.data as EventDetail;
await call('assign_staff', {
  eventId: event.id,
  email: usher,
  gateId: detail.gates[0].id,
  role: 'usher',
});
const capacities = [
  ...Array<number>(18).fill(1),
  ...Array<number>(7).fill(2),
  ...Array<number>(3).fill(3),
  4,
  5,
];
const names = [
  'Amina Demo',
  'Daniel Demo',
  'Grace Demo',
  'James Demo',
  'Sarah Demo',
  'David Demo',
  'Ruth Demo',
  'Samuel Demo',
  'Esther Demo',
  'Paul Demo',
  'Miriam Demo',
  'Peter Demo',
  'Naomi Demo',
  'Joseph Demo',
  'Faith Demo',
  'Isaac Demo',
  'Hope Demo',
  'Joel Demo',
  'The Kato Couple',
  'The Nambi Couple',
  'The Okello Couple',
  'The Namara Couple',
  'The Musa Couple',
  'The Sanyu Couple',
  'The Lule Couple',
  'The Ayo Family',
  'The Birungi Family',
  'The Mugisha Family',
  'The Ssenyonga Family',
  'The Welcome Delegation',
];
for (const [i, capacity] of capacities.entries()) {
  const token = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
  await call('create_guest', {
    eventId: event.id,
    name: names[i],
    phone: `+25670000${String(i + 1).padStart(4, '0')}`,
    capacity,
    tableLabel: `Table ${Math.floor(i / 5) + 1}`,
    tokenHash: token.tokenHash,
    tokenCiphertext: token.tokenCiphertext,
  });
}
await call('set_event_status', { eventId: event.id, status: 'active' });
mkdirSync('.local', { recursive: true });
writeFileSync(
  '.local/demo-credentials.json',
  JSON.stringify({ organizer, usher, password, eventId: event.id }, null, 2) +
    '\n',
  { mode: 0o600 },
);
console.log(
  'Demo ready: 30 invitations, 50 people. Local-only credentials saved to .local/demo-credentials.json.',
);
