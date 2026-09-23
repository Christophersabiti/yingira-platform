import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import { issueToken } from '../src/lib/tokens';
import type {
  Dashboard,
  EventDetail,
  Receipt,
  Result,
  Scan,
} from '../src/lib/contracts';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (
  !url.startsWith('http://127.0.0.1:') ||
  !process.env.DATABASE_URL?.includes('127.0.0.1:56322')
)
  throw new Error(
    'Integration tests only run on the dedicated local Yingira database',
  );
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let checks = 0;
function pass(label: string) {
  checks++;
  console.log(`✓ ${label}`);
}
const run = randomUUID().slice(0, 8),
  password = randomBytes(24).toString('base64url');
async function account(name: string) {
  const email = `${name}-${run}@yingira.test`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  const client = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  return { client, email, id: created.data.user!.id };
}
const testLeases = new Map<SupabaseClient, string>();
async function rpc<T>(
  client: SupabaseClient,
  action: string,
  data: Record<string, unknown> = {},
) {
  if (action === 'validate' || action === 'admit') {
    let leaseId = testLeases.get(client);
    if (!leaseId) {
      leaseId = randomUUID();
      testLeases.set(client, leaseId);
    }
    const started = await client.rpc('yingira_command', {
      p_action: 'start_shift',
      p_data: { eventId: data.eventId, leaseId, role: 'usher' },
    });
    assert.ifError(started.error);
    assert.equal(started.data.ok, true);
    data = { ...data, leaseId };
  }
  const response = await client.rpc('yingira_command', {
    p_action: action,
    p_data: data,
  });
  assert.ifError(response.error);
  return response.data as T;
}
async function mutate<T = { id: string }>(
  client: SupabaseClient,
  action: string,
  data: Record<string, unknown> = {},
) {
  const result = await rpc<Result<T>>(client, action, data);
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
try {
  const owner = await account('organizer'),
    staff = await account('usher'),
    second = await account('usher-two'),
    outsider = await account('outsider');
  await db.query(
    'insert into yingira.admin_onboarding(email) values($1),($2) on conflict do nothing',
    [owner.email, outsider.email],
  );
  const org = await mutate(owner.client, 'create_organization', {
    name: 'Sabtech Events Demo',
  });
  const event = await mutate(owner.client, 'create_event', {
    organizationId: org.id,
    title: 'Christopher & Diana Wedding Demo',
    venue: 'Kampala · Garden pavilion',
    startsAt: '2026-12-19T11:00:00Z',
    timezone: 'Africa/Kampala',
  });
  let detail = await rpc<EventDetail>(owner.client, 'event', {
    eventId: event.id,
  });
  const gate = detail.gates[0].id;
  await mutate(owner.client, 'assign_staff', {
    eventId: event.id,
    email: staff.email,
    role: 'usher',
    gateId: gate,
  });
  await mutate(owner.client, 'assign_staff', {
    eventId: event.id,
    email: second.email,
    role: 'usher',
    gateId: gate,
  });
  await mutate(owner.client, 'set_event_status', {
    eventId: event.id,
    status: 'active',
  });
  pass('Verified accounts, organization, event, gate and scoped staff setup');
  const otherOrg = await mutate(outsider.client, 'create_organization', {
    name: 'Other organization',
  });
  const otherEvent = await mutate(outsider.client, 'create_event', {
    organizationId: otherOrg.id,
    title: 'Private other event',
    venue: 'Other venue',
    startsAt: '2026-12-19T11:00:00Z',
    timezone: 'Africa/Kampala',
  });
  const denied = await outsider.client.rpc('yingira_command', {
    p_action: 'event',
    p_data: { eventId: event.id },
  });
  assert.equal(denied.error?.code, '42501');
  const otherDashboard = await rpc<Dashboard>(outsider.client, 'dashboard');
  assert(!otherDashboard.events.some((e) => e.id === event.id));
  pass('Cross-tenant read and dashboard isolation');
  const teamDetail = await rpc<EventDetail>(staff.client, 'event', {
    eventId: event.id,
  });
  assert.deepEqual(teamDetail.guests, []);
  assert.deepEqual(teamDetail.staff, []);
  assert.deepEqual(teamDetail.metrics, {});
  const privilege = await staff.client.rpc('yingira_command', {
    p_action: 'create_guest',
    p_data: {
      eventId: event.id,
      name: 'Forbidden guest',
      phone: '+256700000001',
      capacity: 1,
    },
  });
  assert.equal(privilege.error?.code, '42501');
  pass('Usher cannot list guests or create invitations');
  async function guest(name: string, capacity: number) {
    const token = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
    const invitation = await mutate(owner.client, 'create_guest', {
      eventId: event.id,
      name,
      phone: '+256700000001',
      capacity,
      tableLabel: 'Table 12 · Family',
      tokenHash: token.tokenHash,
      tokenCiphertext: token.tokenCiphertext,
    });
    return { ...token, id: invitation.id };
  }
  const one = await guest('Single Guest', 1),
    group = await guest('Family Guest', 4),
    reissue = await guest('Revoked Guest', 2);
  const publicView = await admin.rpc('yingira_public_invitation', {
    p_token: one.token,
  });
  assert.ifError(publicView.error);
  assert.equal(publicView.data.guestName, 'Single Guest');
  assert(!('phone' in publicView.data));
  assert(!('initialCount' in publicView.data));
  const anon = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  assert(
    (await anon.rpc('yingira_public_invitation', { p_token: one.token })).error,
  );
  assert((await anon.rpc('yingira_command', { p_action: 'dashboard' })).error);
  pass(
    'Public projection excludes contact/history; anonymous direct RPC access denied',
  );
  const base = { eventId: event.id, gateId: gate, deviceId: randomUUID() };
  const validated = await mutate<Scan>(staff.client, 'validate', {
    ...base,
    token: one.token,
  });
  assert.equal(validated.phoneSuffix, '0001');
  assert.equal(validated.remaining, 1);
  pass('Valid scan returns masked verification and available quantity');
  const invalid = await rpc<Result>(staff.client, 'validate', {
    ...base,
    token: randomBytes(32).toString('base64url'),
  });
  assert(!invalid.ok && invalid.code === 'INVALID');
  const wrongGate = await staff.client.rpc('yingira_command', {
    p_action: 'validate',
    p_data: {
      ...base,
      leaseId: testLeases.get(staff.client),
      gateId: randomUUID(),
      token: one.token,
    },
  });
  assert.equal(wrongGate.error?.code, '42501');
  const otherDetail = await rpc<EventDetail>(outsider.client, 'event', {
    eventId: otherEvent.id,
  });
  await mutate(outsider.client, 'set_event_status', {
    eventId: otherEvent.id,
    status: 'active',
  });
  const wrongEvent = await rpc<Result>(outsider.client, 'validate', {
    eventId: otherEvent.id,
    gateId: otherDetail.gates[0].id,
    token: one.token,
  });
  assert(!wrongEvent.ok && wrongEvent.code === 'INVALID');
  pass(
    'Invalid QR, wrong gate and wrong tenant token rejected without disclosure',
  );
  const a = {
    ...base,
    token: one.token,
    quantity: 1,
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
  };
  const b = { ...a, idempotencyKey: randomUUID(), deviceId: randomUUID() };
  const raced = await Promise.all([
    rpc<Result<Receipt>>(staff.client, 'admit', a),
    rpc<Result<Receipt>>(second.client, 'admit', b),
  ]);
  assert.equal(raced.filter((r) => r.ok).length, 1);
  const counts = await db.query(
    'select initial_count,inside_count,(select count(*) from yingira.attendance where invitation_id=$1) ledger from yingira.invitations where id=$1',
    [one.id],
  );
  assert.equal(counts.rows[0].initial_count, 1);
  assert.equal(counts.rows[0].inside_count, 1);
  assert.equal(Number(counts.rows[0].ledger), 1);
  pass(
    'Two independent ushers race the final slot; exactly one ledger entry commits',
  );
  const winner = raced[0].ok ? staff.client : second.client,
    winning = raced[0].ok ? a : b;
  const replay = await rpc<Result<Receipt>>(winner, 'admit', winning);
  assert.deepEqual(
    replay,
    raced.find((r) => r.ok),
  );
  const changed = await rpc<Result>(winner, 'admit', {
    ...winning,
    quantity: 2,
  });
  assert(!changed.ok && changed.code === 'IDEMPOTENCY_CONFLICT');
  pass(
    'Lost-response replay returns original receipt; changed payload is rejected',
  );
  const groupIntent = {
    ...base,
    token: group.token,
    quantity: 3,
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
  };
  const groupRace = await Promise.all([
    rpc<Result<Receipt>>(staff.client, 'admit', groupIntent),
    rpc<Result<Receipt>>(staff.client, 'admit', groupIntent),
  ]);
  assert.deepEqual(groupRace[0], groupRace[1]);
  assert(groupRace[0].ok && groupRace[0].data.remaining === 1);
  const last = await mutate<Receipt>(staff.client, 'admit', {
    ...base,
    token: group.token,
    quantity: 1,
    expectedVersion: 1,
    idempotencyKey: randomUUID(),
  });
  assert.equal(last.remaining, 0);
  const over = await rpc<Result>(staff.client, 'admit', {
    ...base,
    token: group.token,
    quantity: 1,
    expectedVersion: 2,
    idempotencyKey: randomUUID(),
  });
  assert(!over.ok && over.code === 'CAPACITY_REACHED');
  pass('Same-key concurrency and partial group 3+1 preserve capacity 4');
  for (const quantity of [0, -1]) {
    const result = await rpc<Result>(staff.client, 'admit', {
      ...base,
      token: group.token,
      quantity,
      expectedVersion: 2,
      idempotencyKey: randomUUID(),
    });
    assert(!result.ok && result.code === 'INVALID_QUANTITY');
  }
  pass('Database rejects invalid quantities independently of HTTP validation');
  await mutate(owner.client, 'revoke', {
    eventId: event.id,
    invitationId: reissue.id,
  });
  assert.equal(
    (await admin.rpc('yingira_public_invitation', { p_token: reissue.token }))
      .data,
    null,
  );
  const revoked = await rpc<Result>(staff.client, 'validate', {
    ...base,
    token: reissue.token,
  });
  assert(!revoked.ok && revoked.code === 'REVOKED');
  const replacement = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
  await mutate(owner.client, 'reissue', {
    eventId: event.id,
    invitationId: group.id,
    tokenHash: replacement.tokenHash,
    tokenCiphertext: replacement.tokenCiphertext,
  });
  const afterReissue = await mutate<Scan>(staff.client, 'validate', {
    ...base,
    token: replacement.token,
  });
  assert.equal(afterReissue.initialCount, 4);
  assert.equal(afterReissue.remaining, 0);
  pass(
    'Revocation invalidates public/scanner use; reissue preserves consumed capacity',
  );

  const revokeRace = await guest('Revocation Race Guest', 1);
  await db.query('BEGIN');
  await db.query('select id from yingira.invitations where id=$1 for update', [
    revokeRace.id,
  ]);
  const waitingAdmission = rpc<Result>(staff.client, 'admit', {
    ...base,
    token: revokeRace.token,
    quantity: 1,
    expectedVersion: 0,
    idempotencyKey: randomUUID(),
  });
  let blocked = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    await db.query('select pg_stat_clear_snapshot()');
    const waiting = await db.query(
      'select count(*) from pg_stat_activity where pg_backend_pid() = any(pg_blocking_pids(pid))',
    );
    if (Number(waiting.rows[0].count) > 0) {
      blocked = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await db.query(
    'update yingira.tokens set revoked_at=clock_timestamp() where invitation_id=$1',
    [revokeRace.id],
  );
  await db.query('COMMIT');
  const racedRevocation = await waitingAdmission;
  assert(blocked, 'Admission must reach the lock before revocation commits');
  assert(!racedRevocation.ok && racedRevocation.code === 'REVOKED');
  pass('Token revocation wins while an admission waits on its invitation lock');
  await mutate(owner.client, 'set_event_status', {
    eventId: event.id,
    status: 'closed',
  });
  const closed = await rpc<Result>(staff.client, 'validate', {
    ...base,
    token: one.token,
  });
  assert(!closed.ok && closed.code === 'EVENT_CLOSED');
  await mutate(owner.client, 'set_event_status', {
    eventId: event.id,
    status: 'active',
  });
  pass('Closed events reject validation until explicitly reopened');
  await mutate(owner.client, 'disable_staff', {
    eventId: event.id,
    userId: second.id,
  });
  const disabled = await second.client.rpc('yingira_command', {
    p_action: 'validate',
    p_data: { ...base, token: one.token },
  });
  assert.equal(disabled.error?.code, '42501');
  pass('Disabling staff takes effect on the next online command');
  await db.query('BEGIN');
  await db.query('SET LOCAL ROLE authenticated');
  let tableDenied = false;
  try {
    await db.query('select * from yingira.invitations');
  } catch {
    tableDenied = true;
  }
  await db.query('ROLLBACK');
  assert(tableDenied);
  pass('Direct authenticated database reads are denied');
  let fkDenied = false;
  try {
    await db.query(
      'insert into yingira.gates(organization_id,event_id,name) values($1,$2,$3)',
      [otherOrg.id, event.id, 'Wrong tenant'],
    );
  } catch (e) {
    fkDenied = (e as { code: string }).code === '23503';
  }
  assert(fkDenied);
  pass('Composite foreign keys reject cross-tenant relationships');
  let immutable = false;
  try {
    await db.query(
      'update yingira.attendance set quantity=99 where invitation_id=$1',
      [one.id],
    );
  } catch {
    immutable = true;
  }
  assert(immutable);
  pass('Attendance history rejects destructive edits');
  detail = await rpc<EventDetail>(owner.client, 'event', { eventId: event.id });
  assert.equal(detail.metrics.admitted, 5);
  assert.equal(detail.recent.length, 3);
  assert(detail.recent.every((r) => r.accepted_at));
  pass('Dashboard totals and timestamped arrival history match the ledger');
  const audit = await db.query(
    "select count(*) from yingira.audit where event_id=$1 and action='INITIAL_ENTRY'",
    [event.id],
  );
  assert.equal(Number(audit.rows[0].count), 3);
  pass('Every accepted initial entry has an audit record');
  const browserGuest = await guest('Browser Journey Guest', 2);
  mkdirSync('.local', { recursive: true });
  writeFileSync(
    '.local/fixture.json',
    JSON.stringify({
      ownerEmail: owner.email,
      staffEmail: staff.email,
      password,
      eventId: event.id,
      token: browserGuest.token,
      gateId: gate,
      invitationId: browserGuest.id,
    }),
    { mode: 0o600 },
  );
  await db.query(
    'delete from yingira.staff_shifts where user_id=any($1::uuid[])',
    [[owner.id, staff.id, second.id]],
  );
  console.log(
    `${checks} database integration checks passed. Browser fixture saved to ignored .local/fixture.json.`,
  );
} finally {
  await db.end();
}
