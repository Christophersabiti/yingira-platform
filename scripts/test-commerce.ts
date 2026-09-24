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
  const email = `commerce-${randomUUID()}@yingira.test`;
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
  return c.rpc('yingira_commerce', { p_action: action, p_data: data });
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
    name: 'Planning Commerce Test',
  });
  const ev = await command(owner.c, 'create_event', {
    organizationId: org.id,
    title: 'Complete Planning Test',
    venue: 'Test venue',
    startsAt: '2027-01-01T10:00:00Z',
    timezone: 'Africa/Kampala',
  });
  const eventId = ev.id;
  const act = (action: string, data: Record<string, unknown> = {}) =>
    op(owner.c, action, { eventId, requestId: randomUUID(), ...data });
  const state = () => act('state');
  assert.equal((await raw(staff.c, 'state', { eventId })).error?.code, '42501');
  assert.equal(
    (await raw(stranger.c, 'state', { eventId })).error?.code,
    '42501',
  );
  assert(
    (
      await service.rpc('yingira_commerce', {
        p_action: 'state',
        p_data: { eventId },
      })
    ).error,
  );
  pass(
    'Planning is tenant scoped, Admin-only and requires a live user session',
  );
  const s = await state();
  assert.equal(s.settings.currency, 'UGX');
  await act('settings', {
    expectedVersion: 0,
    currency: 'UGX',
    mode: 'live',
    budget: 2000000,
    clientName: 'Client Couple',
    clientEmail: 'client@yingira.test',
  });
  const taskId = randomUUID(),
    requestId = randomUUID();
  const task = {
    id: taskId,
    title: 'Confirm venue',
    owner: 'Planner',
    due: '2027-01-01',
    status: 'todo',
    notes: '',
    expectedVersion: 0,
    requestId,
  };
  await act('task_save', task);
  await act('task_save', task);
  assert.equal((await state()).tasks.length, 1);
  assert(
    (await raw(owner.c, 'task_save', { eventId, ...task, title: 'Changed' }))
      .error,
  );
  assert(
    (
      await raw(owner.c, 'task_save', {
        eventId,
        ...task,
        requestId: randomUUID(),
      })
    ).error,
  );
  pass(
    'Task retries are idempotent and stale edits cannot overwrite another change',
  );
  const supplierId = randomUUID();
  await act('supplier_save', {
    id: supplierId,
    expectedVersion: 0,
    name: 'Catering Co',
    category: 'Catering',
    contact: 'Jane',
    email: 'jane@yingira.test',
    phone: '+256700000789',
    notes: 'Private supplier note',
  });
  const programmeId = randomUUID();
  await act('programme_save', {
    id: programmeId,
    expectedVersion: 0,
    title: 'Reception',
    startsAt: '2027-01-01T10:00:00Z',
    endsAt: '2027-01-01T12:00:00Z',
    location: 'Garden',
    owner: 'Coordinator',
    supplierId,
    notes: 'Private setup note',
  });
  assert(
    (
      await raw(owner.c, 'programme_save', {
        eventId,
        requestId: randomUUID(),
        id: randomUUID(),
        expectedVersion: 0,
        title: 'Bad timing',
        startsAt: '2027-01-01T12:00:00Z',
        endsAt: '2027-01-01T10:00:00Z',
        location: '',
        owner: '',
        supplierId,
        notes: '',
      })
    ).error,
  );
  const costId = randomUUID();
  await act('cost_save', {
    id: costId,
    expectedVersion: 0,
    title: 'Catering',
    supplierId,
    planned: 900000,
    quoted: 850000,
    committed: 800000,
    deposit: 200000,
    due: '2027-01-01',
    notes: '',
  });
  assert(
    (
      await raw(owner.c, 'delete_item', {
        eventId,
        requestId: randomUUID(),
        kind: 'supplier',
        id: supplierId,
        expectedVersion: 1,
      })
    ).error,
  );
  pass(
    'Programme times and linked supplier/cost records have database constraints',
  );
  assert(
    (
      await raw(owner.c, 'settings', {
        eventId,
        requestId: randomUUID(),
        expectedVersion: 1,
        currency: 'USD',
        budget: 100,
        clientName: 'Client',
        clientEmail: '',
      })
    ).error,
  );
  pass('Currency is locked once financial records exist');
  const paymentId = randomUUID();
  await act('payment_record', {
    id: paymentId,
    targetId: costId,
    targetKind: 'supplier',
    amount: 200000,
    paidOn: '2026-09-24',
    method: 'mobile_money',
    reference: 'TEST-DEPOSIT',
    notes: '',
  });
  assert.equal((await state()).costs[0].paid, 200000);
  const races = await Promise.all(
    [1, 2].map(() =>
      raw(owner.c, 'payment_record', {
        eventId,
        requestId: randomUUID(),
        id: randomUUID(),
        targetId: costId,
        targetKind: 'supplier',
        amount: 500000,
        paidOn: '2026-09-24',
        method: 'bank',
        reference: randomUUID(),
        notes: '',
      }),
    ),
  );
  assert.equal(races.filter((r) => !r.error).length, 1);
  await assert.rejects(
    sql.query('update yingira.plan_payments set amount=1 where id=$1', [
      paymentId,
    ]),
  );
  await act('payment_reverse', {
    id: randomUUID(),
    paymentId,
    reason: 'Duplicate deposit record',
  });
  assert.equal((await state()).costs[0].paid, 500000);
  assert(
    (
      await raw(owner.c, 'payment_reverse', {
        eventId,
        requestId: randomUUID(),
        id: randomUUID(),
        paymentId,
        reason: 'Repeat reversal',
      })
    ).error,
  );
  pass(
    'Payment ledger is append-only; concurrent overpayment and double reversal are prevented',
  );
  const packId = randomUUID(),
    invoiceId = randomUUID();
  const lines = [
    { description: 'Planning service', quantity: 1, unitAmount: 350000 },
  ];
  await act('package_save', {
    id: packId,
    expectedVersion: 0,
    name: 'Wedding coordination',
    description: 'Event support',
    currency: 'UGX',
    mode: 'live',
    lines,
    active: true,
  });
  await act('invoice_save', {
    id: invoiceId,
    expectedVersion: 0,
    clientName: 'Client Couple',
    clientEmail: 'client@yingira.test',
    due: '2027-01-01',
    lines,
    notes: 'Pay before the event.',
  });
  await act('invoice_issue', { id: invoiceId, expectedVersion: 1 });
  assert(
    (
      await raw(owner.c, 'invoice_save', {
        eventId,
        requestId: randomUUID(),
        id: invoiceId,
        expectedVersion: 2,
        clientName: 'Changed',
        clientEmail: '',
        due: null,
        lines,
        notes: '',
      })
    ).error,
  );
  await assert.rejects(
    sql.query('update yingira.client_invoices set total=1 where id=$1', [
      invoiceId,
    ]),
  );
  pass(
    'Service packages copy into invoices; issued invoices cannot be silently edited',
  );
  const approvalId = randomUUID(),
    token = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
  await act('approval_create', {
    id: approvalId,
    title: 'Budget review',
    clientName: 'Client Couple',
    kind: 'budget',
    invoiceId: null,
    details: 'Please review.',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    tokenHash: token.tokenHash,
    tokenCiphertext: token.tokenCiphertext,
  });
  const portal = () =>
    service.rpc('yingira_client_portal', {
      p_token: token.token,
      p_action: 'view',
      p_data: {},
    });
  const view = await portal();
  assert.ifError(view.error);
  assert.equal(view.data.snapshot.budget.committed, 800000);
  assert(!JSON.stringify(view.data).includes('jane@'));
  assert(!JSON.stringify(view.data).includes('TEST-DEPOSIT'));
  await act('cost_save', {
    id: costId,
    expectedVersion: 1,
    title: 'Catering revised',
    supplierId,
    planned: 900000,
    quoted: 850000,
    committed: 850000,
    deposit: 200000,
    due: null,
    notes: '',
  });
  assert.equal((await portal()).data.snapshot.budget.committed, 800000);
  await assert.rejects(
    sql.query("update yingira.client_approvals set snapshot='{}' where id=$1", [
      approvalId,
    ]),
  );
  const decision = {
    decision: 'approved',
    signer: 'Client One',
    comment: 'Approved budget',
    requestId: randomUUID(),
  };
  assert.ifError(
    (
      await service.rpc('yingira_client_portal', {
        p_token: token.token,
        p_action: 'decide',
        p_data: decision,
      })
    ).error,
  );
  assert.ifError(
    (
      await service.rpc('yingira_client_portal', {
        p_token: token.token,
        p_action: 'decide',
        p_data: decision,
      })
    ).error,
  );
  assert(
    (
      await service.rpc('yingira_client_portal', {
        p_token: token.token,
        p_action: 'decide',
        p_data: {
          ...decision,
          requestId: randomUUID(),
          decision: 'changes_requested',
        },
      })
    ).error,
  );
  assert(
    (
      await owner.c.rpc('yingira_client_portal', {
        p_token: token.token,
        p_action: 'view',
      })
    ).error,
  );
  pass(
    'Client links expose frozen scoped snapshots; decisions are immutable and retries are safe',
  );
  const bill = async (action: string, data: Record<string, unknown> = {}) => {
    const r = await owner.c.rpc('yingira_billing', {
      p_action: action,
      p_data: { eventId, ...data },
    });
    assert.ifError(r.error);
    return r.data;
  };
  assert.equal((await bill('state')).isPlatformAdmin, false);
  assert(
    (
      await owner.c.rpc('yingira_billing', {
        p_action: 'plan_save',
        p_data: { eventId, id: randomUUID() },
      })
    ).error,
  );
  await sql.query('insert into yingira.platform_admins(user_id) values($1)', [
    owner.id,
  ]);
  const planId = randomUUID();
  await bill('plan_save', {
    id: planId,
    expectedVersion: 0,
    name: 'Test paid plan',
    description: 'Synthetic plan',
    price: 50000,
    days: 30,
    eventLimit: 2,
    guestLimit: 2,
    active: true,
  });
  pass('Only the platform owner can set subscription prices and allowances');
  const linkToken = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
  await bill('invoice_link', {
    id: randomUUID(),
    invoiceId,
    tokenHash: linkToken.tokenHash,
    tokenCiphertext: linkToken.tokenCiphertext,
  });
  const publicInvoice = await service.rpc('yingira_invoice_checkout', {
    p_token: linkToken.token,
    p_action: 'view',
  });
  assert.ifError(publicInvoice.error);
  assert.equal(publicInvoice.data.total, 350000);
  const orderResult = await service.rpc('yingira_invoice_checkout', {
    p_token: linkToken.token,
    p_action: 'order',
    p_data: {
      id: randomUUID(),
      name: 'Client One',
      email: 'client@yingira.test',
      phone: '',
    },
  });
  assert.ifError(orderResult.error);
  const orderId = orderResult.data.id;
  const worker = async (action: string, data: Record<string, unknown>) => {
    const r = await service.rpc('yingira_pesapal_worker', {
      p_action: action,
      p_data: data,
    });
    assert.ifError(r.error);
    return r.data;
  };
  assert(
    (
      await owner.c.rpc('yingira_pesapal_worker', {
        p_action: 'read',
        p_data: { id: orderId },
      })
    ).error,
  );
  const claims = await Promise.all([
    worker('claim', { id: orderId, mode: 'live' }),
    worker('claim', { id: orderId, mode: 'live' }),
  ]);
  assert.equal(claims.filter((c) => c.claimed).length, 1);
  await worker('uncertain', { id: orderId });
  assert.equal(
    (await worker('claim', { id: orderId, mode: 'live' })).claimed,
    false,
  );
  assert(
    (
      await raw(owner.c, 'payment_record', {
        eventId,
        requestId: randomUUID(),
        id: randomUUID(),
        targetId: invoiceId,
        targetKind: 'client',
        amount: 1,
        paidOn: '2026-09-24',
        method: 'cash',
        reference: 'Blocked',
        notes: '',
      })
    ).error,
  );
  assert(
    (
      await raw(owner.c, 'invoice_void', {
        eventId,
        requestId: randomUUID(),
        id: invoiceId,
        expectedVersion: 2,
      })
    ).error,
  );
  pass(
    'Online checkout claims once; uncertain submissions block duplicate checkout and conflicting manual receipts',
  );
  const trackingId = randomUUID();
  assert(
    (
      await service.rpc('yingira_pesapal_worker', {
        p_action: 'settle',
        p_data: {
          id: orderId,
          trackingId,
          amount: 1,
          currency: 'UGX',
          mode: 'live',
          status: 'completed',
        },
      })
    ).error,
  );
  const verified = {
    id: orderId,
    trackingId,
    amount: 350000,
    currency: 'UGX',
    mode: 'live',
    status: 'completed',
    confirmation: 'TEST-PESA',
  };
  await worker('settle', verified);
  await worker('settle', verified);
  assert.equal((await state()).invoices[0].paid, 350000);
  await worker('settle', { ...verified, status: 'reversed' });
  await worker('settle', { ...verified, status: 'completed' });
  assert.equal((await state()).invoices[0].paid, 0);
  pass(
    'Verified Pesapal completion credits once; mismatches and out-of-order reversal callbacks cannot fabricate receipts',
  );
  const subOrder = await bill('subscription_order', {
    id: randomUUID(),
    planId,
    planVersion: 1,
    customerName: 'Planner',
  });
  await worker('settle', {
    id: subOrder.id,
    trackingId: randomUUID(),
    amount: 50000,
    currency: 'UGX',
    mode: 'live',
    status: 'completed',
    confirmation: 'TEST-SUB',
  });
  assert.equal((await bill('state')).subscription.plan_name, 'Test paid plan');
  for (let i = 0; i < 2; i++) {
    const t = issueToken(process.env.INVITATION_ENCRYPTION_KEY!);
    await command(owner.c, 'create_guest', {
      eventId,
      name: `Allowed guest ${i}`,
      phone: '+256700000000',
      capacity: 1,
      tableLabel: '',
      ...t,
    });
  }
  const over = await owner.c.rpc('yingira_command', {
    p_action: 'create_guest',
    p_data: {
      eventId,
      name: 'Over limit',
      phone: '+256700000000',
      capacity: 1,
      tableLabel: '',
      ...issueToken(process.env.INVITATION_ENCRYPTION_KEY!),
    },
  });
  assert(over.error || over.data?.ok === false);
  pass(
    'Paid subscriptions activate only after verification and enforce invitation allowances',
  );

  const paidUntil = (await bill('state')).subscription.expires_at;
  const sandboxOrder = await bill('subscription_order', {
    id: randomUUID(),
    planId,
    planVersion: 1,
    customerName: 'Sandbox Planner',
  });
  await worker('settle', {
    id: sandboxOrder.id,
    trackingId: randomUUID(),
    amount: 50000,
    currency: 'UGX',
    status: 'completed',
    mode: 'sandbox',
    confirmation: 'TEST-ONLY',
  });
  assert.equal((await bill('state')).subscription.expires_at, paidUntil);
  pass(
    'Sandbox payments are visible test records and never activate real entitlements',
  );
  const renewal = await bill('subscription_order', {
    id: randomUUID(),
    planId,
    planVersion: 1,
    customerName: 'Renewing Planner',
  });
  await worker('settle', {
    id: renewal.id,
    trackingId: randomUUID(),
    amount: 50000,
    currency: 'UGX',
    status: 'completed',
    mode: 'live',
    confirmation: 'TEST-RENEWAL',
  });
  const renewalBefore = (
    await sql.query(
      'select * from yingira.subscription_terms where order_id=$1',
      [renewal.id],
    )
  ).rows[0];
  const originalTracking = (
    await sql.query(
      'select tracking_id from yingira.pesapal_orders where id=$1',
      [subOrder.id],
    )
  ).rows[0].tracking_id;
  await worker('settle', {
    id: subOrder.id,
    trackingId: originalTracking,
    amount: 50000,
    currency: 'UGX',
    status: 'reversed',
    mode: 'live',
    confirmation: 'TEST-REFUND',
  });
  const renewalAfter = (
    await sql.query(
      'select * from yingira.subscription_terms where order_id=$1',
      [renewal.id],
    )
  ).rows[0];
  assert.deepEqual(renewalAfter, renewalBefore);
  assert.equal(
    new Date((await bill('state')).subscription.expires_at).toISOString(),
    renewalBefore.ends_at.toISOString(),
  );
  pass(
    'Reversing an earlier subscription preserves the later paid renewal window',
  );
  const wa = async (action: string, data: Record<string, unknown> = {}) => {
    const r = await owner.c.rpc('yingira_whatsapp', {
      p_action: action,
      p_data: { eventId, ...data },
    });
    assert.ifError(r.error);
    return r.data;
  };
  const waWorker = async (action: string, data: Record<string, unknown>) => {
    const r = await service.rpc('yingira_whatsapp_worker', {
      p_action: action,
      p_data: data,
    });
    assert.ifError(r.error);
    return r.data;
  };
  let waState = await wa('state');
  const waGuest = waState.guests[0];
  const templateSid = 'HX' + 'a'.repeat(32);
  const waCampaign = {
    campaignId: randomUUID(),
    kind: 'invitation',
    guestIds: [waGuest.id],
    scheduledAt: new Date().toISOString(),
    templateSid,
  };
  assert(
    (
      await owner.c.rpc('yingira_whatsapp', {
        p_action: 'queue',
        p_data: { eventId, ...waCampaign },
      })
    ).error,
  );
  assert(
    (
      await staff.c.rpc('yingira_whatsapp', {
        p_action: 'state',
        p_data: { eventId },
      })
    ).error,
  );
  await wa('consent', {
    invitationId: waGuest.id,
    allowed: true,
    evidence: 'Guest agreed in a phone call, test evidence',
  });
  await wa('queue', waCampaign);
  await wa('queue', waCampaign);
  assert.equal((await wa('state')).messages.length, 1);
  pass(
    'WhatsApp requires recorded consent and Admin access; campaign retries do not duplicate sends',
  );
  const waClaims = await Promise.all([
    waWorker('claim', { organizations: [org.id] }),
    waWorker('claim', { organizations: [org.id] }),
  ]);
  const claimed = waClaims.find((x) => x?.id);
  assert(claimed);
  assert.equal(waClaims.filter((x) => x?.id).length, 1);
  const messageSid = 'SM' + randomUUID().replaceAll('-', '');
  await waWorker('status', {
    id: claimed.id,
    status: 'delivered',
    providerId: messageSid,
  });
  await waWorker('status', {
    id: claimed.id,
    status: 'accepted',
    providerId: messageSid,
  });
  assert.equal((await wa('state')).messages[0].status, 'delivered');
  assert(
    (
      await owner.c.rpc('yingira_whatsapp_worker', {
        p_action: 'status',
        p_data: { id: claimed.id, status: 'read' },
      })
    ).error,
  );
  pass(
    'WhatsApp dispatch claims once and signed-status delivery cannot be downgraded by stale acceptance',
  );
  await wa('queue', { ...waCampaign, campaignId: randomUUID() });
  await waWorker('stop', { organizationId: org.id, phone: waGuest.phone });
  waState = await wa('state');
  assert(waState.guests[0].suppressed);
  assert(
    waState.messages.some((m: { status: string }) => m.status === 'cancelled'),
  );
  assert.equal(await waWorker('claim', { organizations: [org.id] }), null);
  pass(
    'Verified STOP suppresses the phone across an organization and cancels unsent messages',
  );
  console.log(`${passed} planning/billing integration checks passed.`);
} finally {
  await sql.end();
}
