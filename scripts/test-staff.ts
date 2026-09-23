import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (
  url !== 'http://127.0.0.1:56321' ||
  !process.env.DATABASE_URL?.includes('127.0.0.1:56322')
)
  throw Error('Staff tests require the local Yingira stack');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const password = randomBytes(24).toString('base64url');
const run = randomUUID().slice(0, 8);
let passed = 0;
const pass = (s: string) => {
  passed++;
  console.log('✓ ' + s);
};
async function account(label: string, confirmed = true) {
  const email = `${label}-${run}@yingira.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: confirmed,
  });
  assert.ifError(error);
  return { id: data.user!.id, email };
}
async function login(email: string) {
  const c = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
  return c;
}
async function raw(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown> = {},
) {
  return c.rpc('yingira_command', { p_action: action, p_data: data });
}
async function call(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown> = {},
) {
  const r = await raw(c, action, data);
  assert.ifError(r.error);
  return r.data;
}
try {
  const owner = await account('admin');
  const staff = await account('pending', false);
  const supervisor = await account('supervisor');
  const stranger = await account('stranger');
  const oc = await login(owner.email);
  const xc = await login(stranger.email);
  assert.equal(
    (await raw(xc, 'create_organization', { name: 'Not allowed' })).error?.code,
    '42501',
  );
  pass('Ordinary verified accounts cannot self-promote to Admin');
  assert.equal(
    (
      await oc.rpc('yingira_authorize_organization_creator', {
        p_email: owner.email,
      })
    ).error?.code,
    '42501',
  );
  assert.ifError(
    (
      await admin.rpc('yingira_authorize_organization_creator', {
        p_email: owner.email,
      })
    ).error,
  );
  pass('Only the operator service credential can authorize Admin onboarding');
  const org = (
    await call(oc, 'create_organization', { name: 'Staff access tests' })
  ).data.id;
  async function event(title: string) {
    const e = (
      await call(oc, 'create_event', {
        organizationId: org,
        title,
        venue: 'Kampala',
        startsAt: '2027-01-01T10:00:00Z',
        timezone: 'Africa/Kampala',
      })
    ).data.id;
    const detail = await call(oc, 'event', { eventId: e });
    return { id: e, gate: detail.gates[0].id };
  }
  const e = await event('Main event'),
    other = await event('Second event');
  const invited = await call(oc, 'assign_staff', {
    eventId: e.id,
    gateId: e.gate,
    email: staff.email,
    role: 'usher',
  });
  assert.equal(invited.data.pending, true);
  assert.equal(
    (await call(oc, 'event', { eventId: e.id })).pendingStaff.length,
    1,
  );
  assert.equal(
    (
      await db.query('select count(*) from yingira.team where user_id=$1', [
        staff.id,
      ])
    ).rows[0].count,
    '0',
  );
  await admin.auth.admin.updateUserById(staff.id, { email_confirm: true });
  const sc = await login(staff.email);
  let dash = await call(sc, 'dashboard');
  assert.equal(dash.events[0].role, 'usher');
  assert.equal(dash.canCreateOrganization, false);
  assert.equal(dash.organizations.length, 0);
  pass(
    'Pending invitation activates only after verified registration, with correct role',
  );
  await call(sc, 'dashboard');
  assert.equal(
    (
      await db.query(
        "select count(*) from yingira.audit where actor_id=$1 and action='ACCEPT_STAFF_INVITATION'",
        [staff.id],
      )
    ).rows[0].count,
    '1',
  );
  pass('Repeated sign-in does not duplicate invitation acceptance');
  await call(oc, 'assign_staff', {
    eventId: other.id,
    gateId: other.gate,
    email: staff.email,
    role: 'usher',
  });
  const lease = randomUUID(),
    lease2 = randomUUID();
  const common = { eventId: e.id, leaseId: lease };
  assert.equal(
    (
      await call(sc, 'validate', {
        eventId: e.id,
        gateId: e.gate,
        token: randomBytes(32).toString('base64url'),
      })
    ).code,
    'SHIFT_REQUIRED',
  );
  const attempts = await Promise.all([
    call(sc, 'start_shift', { ...common, role: 'supervisor' }),
    call(sc, 'start_shift', {
      eventId: other.id,
      leaseId: lease2,
      role: 'usher',
    }),
  ]);
  assert.equal(attempts.filter((r) => r.ok).length, 1);
  assert.equal(attempts.filter((r) => r.code === 'SHIFT_BUSY').length, 1);
  pass('Concurrent requests acquire at most one active event per account');
  // Release whichever event won, then establish the main-event fixture.
  await call(oc, 'release_staff_shift', {
    eventId: attempts[0].ok ? e.id : other.id,
    userId: staff.id,
  });
  assert.equal(
    (await call(sc, 'start_shift', { ...common, role: 'supervisor' })).data
      .role,
    'usher',
  );
  assert.equal(
    (await raw(sc, 'supervisor_overview', common)).error?.code,
    '42501',
  );
  pass('Usher cannot request supervisor authority or overview');
  const secondSession = await login(staff.email);
  assert.equal(
    (await call(secondSession, 'start_shift', { ...common, role: 'usher' }))
      .code,
    'SHIFT_BUSY',
  );
  assert.equal(
    (await call(secondSession, 'heartbeat_shift', common)).code,
    'SHIFT_REQUIRED',
  );
  pass('A different Auth session cannot reuse the active lease identifier');
  await call(oc, 'assign_staff', {
    eventId: e.id,
    gateId: e.gate,
    email: supervisor.email,
    role: 'supervisor',
  });
  const sup = await login(supervisor.email);
  const supLease = randomUUID();
  assert.equal(
    (
      await call(sup, 'start_shift', {
        eventId: e.id,
        leaseId: supLease,
        role: 'supervisor',
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await call(sup, 'supervisor_overview', {
        eventId: e.id,
        leaseId: supLease,
      })
    ).ok,
    true,
  );
  pass('Different supervisors and ushers work concurrently at the same event');
  assert.equal(
    (
      await raw(sc, 'release_staff_shift', {
        eventId: e.id,
        userId: supervisor.id,
      })
    ).error?.code,
    '42501',
  );
  await call(oc, 'release_staff_shift', { eventId: e.id, userId: staff.id });
  assert.equal(
    (await call(sc, 'heartbeat_shift', common)).code,
    'SHIFT_REQUIRED',
  );
  pass(
    'Only Admin can release another staff shift; stale sessions are rejected',
  );
  await call(sc, 'start_shift', { ...common, role: 'usher' });
  await call(oc, 'assign_staff', {
    eventId: e.id,
    gateId: e.gate,
    email: staff.email,
    role: 'supervisor',
  });
  assert.equal(
    (await call(sc, 'heartbeat_shift', common)).code,
    'SHIFT_REQUIRED',
  );
  assert.equal(
    (await call(sc, 'start_shift', { ...common, role: 'usher' })).data.role,
    'supervisor',
  );
  pass('Role reassignment invalidates the old shift and uses the new role');
  await db.query(
    "update yingira.staff_shifts set expires_at=now()-interval '1 second' where user_id=$1",
    [staff.id],
  );
  assert.equal(
    (
      await call(secondSession, 'start_shift', {
        eventId: other.id,
        leaseId: lease2,
        role: 'usher',
      })
    ).ok,
    true,
  );
  assert.equal(
    (await call(sc, 'heartbeat_shift', common)).code,
    'SHIFT_REQUIRED',
  );
  pass('Expired shifts can be replaced and old pages remain blocked');
  const adminLease = randomUUID();
  assert.equal(
    (
      await call(oc, 'start_shift', {
        eventId: e.id,
        leaseId: adminLease,
        role: 'supervisor',
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await call(oc, 'supervisor_overview', {
        eventId: e.id,
        leaseId: adminLease,
      })
    ).ok,
    true,
  );
  const audit = await db.query(
    "select metadata from yingira.audit where actor_id=$1 and action='START_SHIFT' order by created_at desc limit 1",
    [owner.id],
  );
  assert.equal(audit.rows[0].metadata.adminSupport, true);
  assert.equal(audit.rows[0].metadata.role, 'supervisor');
  pass('Admin support mode preserves Admin identity and records acting role');
  await call(oc, 'end_shift', { eventId: e.id, leaseId: adminLease });
  assert.equal(
    (
      await call(oc, 'start_shift', {
        eventId: other.id,
        leaseId: randomUUID(),
        role: 'usher',
      })
    ).ok,
    true,
  );
  pass('Ending a shift frees the account for another event');
  await call(oc, 'disable_staff', { eventId: e.id, userId: supervisor.id });
  assert.equal(
    (await raw(sup, 'heartbeat_shift', { eventId: e.id, leaseId: supLease }))
      .error?.code,
    '42501',
  );
  pass('Disabled staff lose operational access immediately');
  const cancelled = await account('cancelled', false);
  await call(oc, 'assign_staff', {
    eventId: e.id,
    gateId: e.gate,
    email: cancelled.email,
    role: 'usher',
  });
  const pending = (
    await call(oc, 'event', { eventId: e.id })
  ).pendingStaff.find((p: { email: string }) => p.email === cancelled.email);
  await call(oc, 'cancel_staff_invitation', {
    eventId: e.id,
    invitationId: pending.id,
  });
  await admin.auth.admin.updateUserById(cancelled.id, { email_confirm: true });
  dash = await call(await login(cancelled.email), 'dashboard');
  assert.equal(dash.events.length, 0);
  pass('Cancelled invitations never grant access after signup');
  console.log(`${passed} staff-access integration checks passed.`);
} finally {
  await db.end();
}
