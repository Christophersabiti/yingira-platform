import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import { issueToken } from '../src/lib/tokens';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (
  url !== 'http://127.0.0.1:56321' ||
  !process.env.DATABASE_URL?.includes('127.0.0.1:56322')
)
  throw Error('Local only');
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const sql = new pg.Client({ connectionString: process.env.DATABASE_URL });
await sql.connect();
const password = randomBytes(24).toString('base64url');
let passed = 0;
const pass = (s: string) => {
  passed++;
  console.log('✓ ' + s);
};
async function account() {
  const email = `operations-${randomUUID()}@yingira.test`;
  const a = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(a.error);
  const c = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
  return { c, email, id: a.data.user!.id };
}
async function command(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown>,
) {
  const r = await c.rpc('yingira_command', { p_action: action, p_data: data });
  assert.ifError(r.error);
  if (r.data.ok === false) throw Error(JSON.stringify(r.data));
  return r.data.data ?? r.data;
}
async function raw(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown>,
) {
  return c.rpc('yingira_operations', { p_action: action, p_data: data });
}
async function op(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown>,
) {
  const r = await raw(c, action, data);
  assert.ifError(r.error);
  return r.data;
}
try {
  const owner = await account(),
    staff = await account(),
    stranger = await account();
  await service.rpc('yingira_authorize_organization_creator', {
    p_email: owner.email,
  });
  const org = await command(owner.c, 'create_organization', {
    name: 'Operations integration',
  });
  const event = await command(owner.c, 'create_event', {
    organizationId: org.id,
    title: 'Household and gates test',
    venue: 'Test Hall',
    startsAt: '2027-01-01T10:00:00Z',
    timezone: 'Africa/Kampala',
  });
  const eventId = event.id;
  const detail = await command(owner.c, 'event', { eventId });
  const gateId = detail.gates[0].id;
  await command(owner.c, 'assign_staff', {
    eventId,
    gateId,
    email: staff.email,
    role: 'usher',
  });
  await command(owner.c, 'set_event_status', { eventId, status: 'active' });
  async function guest(name: string, capacity = 2) {
    const t = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
    const g = await command(owner.c, 'create_guest', {
      eventId,
      name,
      phone: '+256700000123',
      capacity,
      tableLabel: '',
      ...t,
    });
    await sql.query('UPDATE yingira.invitations SET email=$1 WHERE id=$2', [
      `${g.id}@yingira.test`,
      g.id,
    ]);
    return { ...g, ...t };
  }
  const g = await guest('Response Household'),
    g2 = await guest('Second Household'),
    g3 = await guest('Third Household');
  assert.equal(
    (await raw(stranger.c, 'state', { eventId })).error?.code,
    '42501',
  );
  assert.equal((await raw(staff.c, 'state', { eventId })).error?.code, '42501');
  pass(
    'Responses, seating and email state remain Admin-only and tenant scoped',
  );
  const members = [
    { name: 'Alex', response: 'yes', meal: 'Vegetarian', dietary: 'No nuts' },
    { name: 'Sam', response: 'no', meal: '', dietary: '' },
  ];
  const rsvp = (token: string, body = members, revision = 0) =>
    service.rpc('yingira_rsvp', {
      p_token: token,
      p_members: body,
      p_revision: revision,
    });
  assert((await rsvp(g.token)).error);
  await op(owner.c, 'rsvp_settings', {
    eventId,
    enabled: true,
    deadline: null,
  });
  assert.ifError((await rsvp(g.token)).error);
  assert((await rsvp(g.token)).error);
  assert((await rsvp(g.token, [...members, ...members], 1)).error);
  let state = await op(owner.c, 'state', { eventId });
  assert.equal(
    state.guests.find((x: { id: string }) => x.id === g.id).members[0].name,
    'Alex',
  );
  const publicView = await service.rpc('yingira_public_invitation', {
    p_token: g.token,
  });
  assert.equal(publicView.data.members.length, 2);
  pass(
    'Household RSVP respects enablement, allowance, private token and optimistic revision',
  );
  await op(owner.c, 'rsvp_settings', {
    eventId,
    enabled: true,
    deadline: '2020-01-01T00:00:00Z',
  });
  assert((await rsvp(g.token, members, 1)).error);
  await op(owner.c, 'admin_response', {
    eventId,
    invitationId: g.id,
    members,
    expectedRevision: 1,
  });
  assert.equal(
    Number(
      (
        await sql.query(
          'select initial_count from yingira.invitations where id=$1',
          [g.id],
        )
      ).rows[0].initial_count,
    ),
    0,
  );
  const history = await sql.query(
    'select source, actor_id from yingira.response_history where invitation_id=$1 order by revision',
    [g.id],
  );
  assert.deepEqual(history.rows, [
    { source: 'guest', actor_id: null },
    { source: 'admin', actor_id: owner.id },
  ]);
  await assert.rejects(
    sql.query(
      'update yingira.response_history set source=$1 where invitation_id=$2',
      ['admin', g.id],
    ),
  );
  pass(
    'Deadlines block guest edits; audited Admin responses do not admit guests',
  );
  const anon = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  assert.equal(
    (
      await anon.rpc('yingira_rsvp', {
        p_token: g.token,
        p_members: members,
        p_revision: 2,
      })
    ).error?.code,
    '42501',
  );
  pass('Anonymous callers cannot bypass the bounded RSVP service adapter');
  await op(owner.c, 'table_save', {
    eventId,
    tableId: null,
    name: 'Table A',
    capacity: 3,
  });
  state = await op(owner.c, 'state', { eventId });
  const tableId = state.tables[0].id;
  const race = await Promise.all(
    [g, g2].map((x) =>
      raw(owner.c, 'assign_table', {
        eventId,
        invitationId: x.id,
        tableId,
        expectedVersion: 0,
      }),
    ),
  );
  assert.equal(race.filter((r) => !r.error).length, 1);
  assert(
    (
      await raw(owner.c, 'table_save', {
        eventId,
        tableId,
        name: 'Table A',
        capacity: 1,
      })
    ).error,
  );
  const seated = (
    await sql.query('select id from yingira.invitations where table_id=$1', [
      tableId,
    ])
  ).rows[0].id;
  await assert.rejects(
    sql.query('update yingira.invitations set capacity=4 where id=$1', [
      seated,
    ]),
  );
  pass(
    'Concurrent household seating cannot overbook; all capacity edits share the database guard',
  );
  const leaseId = randomUUID(),
    staffLease = randomUUID();
  await command(owner.c, 'start_shift', {
    eventId,
    leaseId,
    role: 'supervisor',
  });
  await command(staff.c, 'start_shift', {
    eventId,
    leaseId: staffLease,
    role: 'usher',
  });
  const ctx = { eventId, gateId, leaseId };
  const staffCtx = { eventId, gateId, leaseId: staffLease };
  assert(
    (
      await raw(owner.c, 'lookup', {
        ...ctx,
        leaseId: randomUUID(),
        search: 'Household',
      })
    ).error,
  );
  const lookup = await op(staff.c, 'lookup', {
    ...staffCtx,
    search: 'Response',
  });
  assert.equal(lookup[0].name, 'Response Household');
  assert.equal(lookup[0].phoneSuffix, '0123');
  assert(!('email' in lookup[0]));
  pass('Assisted lookup requires an active session and masks contact details');
  const version = lookup[0].version;
  const intent = {
    ...ctx,
    invitationId: g.id,
    quantity: 2,
    expectedVersion: version,
    idempotencyKey: randomUUID(),
    deviceId: randomUUID(),
    kind: 'INITIAL_ENTRY',
    reason: 'Verified identity against host list',
  };
  assert.equal(
    (await raw(staff.c, 'movement', { ...intent, leaseId: staffLease })).error
      ?.code,
    '42501',
  );
  const entered = await op(owner.c, 'movement', intent);
  assert.deepEqual(await op(owner.c, 'movement', intent), entered);
  pass(
    'Only supervisors can record assisted first entry; retries return the same receipt',
  );
  const exit = {
    ...staffCtx,
    invitationId: g.id,
    quantity: 1,
    expectedVersion: entered.version,
    idempotencyKey: randomUUID(),
    deviceId: randomUUID(),
    kind: 'EXIT',
    reason: '',
  };
  const exited = await op(staff.c, 'movement', exit);
  assert.equal(exited.initialCount, 2);
  assert.equal(exited.insideCount, 1);
  const reentry = {
    ...exit,
    kind: 'REENTRY',
    expectedVersion: exited.version,
    idempotencyKey: randomUUID(),
  };
  const competing = await Promise.all([
    raw(staff.c, 'movement', reentry),
    raw(owner.c, 'movement', {
      ...reentry,
      leaseId,
      idempotencyKey: randomUUID(),
    }),
  ]);
  assert.equal(competing.filter((r) => !r.error).length, 1);
  const enteredAgain = competing.find((r) => !r.error)!.data;
  assert.equal(enteredAgain.insideCount, 2);
  assert.equal(enteredAgain.initialCount, 2);
  pass(
    'Exit/re-entry preserves initial allowance and concurrent re-entry cannot duplicate occupancy',
  );
  assert(
    (
      await raw(staff.c, 'movement', {
        ...exit,
        expectedVersion: enteredAgain.version,
        quantity: 3,
        idempotencyKey: randomUUID(),
      })
    ).error,
  );
  assert(
    (
      await raw(owner.c, 'movement', {
        ...intent,
        expectedVersion: enteredAgain.version,
        idempotencyKey: randomUUID(),
        quantity: 1,
      })
    ).error,
  );
  pass('Movement bounds prevent negative occupancy and capacity bypass');
  const requestId = randomUUID();
  await op(staff.c, 'request_exception', {
    ...staffCtx,
    invitationId: g3.id,
    requestId,
    quantity: 1,
    reason: 'Guest has no phone; host confirms name',
  });
  const requests = await op(owner.c, 'gate_state', ctx);
  const request = requests.find((r: { id: string }) => r.id === requestId);
  const decision = {
    ...ctx,
    invitationId: g3.id,
    requestId,
    decision: 'approve',
    quantity: 1,
    expectedVersion: request.version,
    idempotencyKey: randomUUID(),
    deviceId: randomUUID(),
    reason: 'Host confirmed guest identity',
  };
  assert.equal(
    (
      await raw(staff.c, 'resolve_exception', {
        ...decision,
        leaseId: staffLease,
      })
    ).error?.code,
    '42501',
  );
  await op(owner.c, 'resolve_exception', decision);
  assert.equal(
    (await op(owner.c, 'resolve_exception', decision)).status,
    'approved',
  );
  pass(
    'Supervisor exception approvals are scoped, reasoned, and cannot admit twice',
  );
  await command(owner.c, 'revoke', { eventId, invitationId: g3.id });
  assert((await rsvp(g3.token)).error);
  assert(
    (
      await raw(owner.c, 'movement', {
        ...intent,
        invitationId: g3.id,
        quantity: 1,
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
      })
    ).error,
  );
  pass('Revoked invitations cannot RSVP or use assisted movements');
  const campaignId = randomUUID();
  const queue = {
    eventId,
    campaignId,
    kind: 'invitation',
    subject: 'Test invitation',
    message: 'Please join us',
    guestIds: [g.id, g2.id, g3.id],
  };
  assert.equal((await op(owner.c, 'queue_mail', queue)).queued, 2);
  assert.equal((await op(owner.c, 'queue_mail', queue)).queued, 2);
  const worker = (action: string, data: Record<string, unknown>) =>
    service.rpc('yingira_mail_worker', { p_action: action, p_data: data });
  const claims = await Promise.all([
    worker('claim', { eventId }),
    worker('claim', { eventId }),
  ]);
  claims.forEach((r) => assert.ifError(r.error));
  assert.notEqual(claims[0].data.id, claims[1].data.id);
  assert.equal((await worker('claim', { eventId })).data, null);
  pass(
    'Email queue retries do not duplicate recipients and parallel workers claim distinct messages',
  );
  const m = claims[0].data;
  await worker('payload', { id: m.id, payload: { text: 'Frozen' } });
  await worker('payload', { id: m.id, payload: { text: 'Changed' } });
  assert.equal(
    (
      await sql.query('select payload from yingira.mail_messages where id=$1', [
        m.id,
      ])
    ).rows[0].payload.text,
    'Frozen',
  );
  await worker('complete', {
    id: m.id,
    status: 'accepted',
    providerId: randomUUID(),
  });
  const tracking = await worker('track', { eventId });
  assert.ifError(tracking.error);
  assert.equal(tracking.data.length, 1);
  await worker('complete', { id: m.id, status: 'bounced' });
  assert.equal(
    (
      await sql.query(
        'select count(*) from yingira.mail_suppressions where email=$1',
        [m.recipient],
      )
    ).rows[0].count,
    '1',
  );
  pass('Email retry payload is frozen and bounces suppress future sends');
  const reminder = await op(owner.c, 'queue_mail', {
    ...queue,
    campaignId: randomUUID(),
    kind: 'reminder',
  });
  assert(reminder.queued <= 1);
  assert.equal(
    (
      await staff.c.rpc('yingira_mail_worker', {
        p_action: 'claim',
        p_data: { eventId },
      })
    ).error?.code,
    '42501',
  );
  pass(
    'Reminders exclude responded households; clients cannot invoke the privileged mail worker',
  );
  const pendingMessage = claims[1].data;
  await sql.query(
    "update yingira.mail_messages set lease_until=now()-interval '1 minute',attempt_started_at=now()-interval '24 hours' where id=$1",
    [pendingMessage.id],
  );
  await worker('claim', { eventId });
  assert.equal(
    (
      await sql.query('select status from yingira.mail_messages where id=$1', [
        pendingMessage.id,
      ])
    ).rows[0].status,
    'unknown',
  );
  pass(
    'Uncertain sends outside the provider idempotency window require review instead of automatic resend',
  );
  console.log(`${passed} C/D integration checks passed.`);
} finally {
  await sql.end();
}
