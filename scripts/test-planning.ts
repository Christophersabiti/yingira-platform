import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { defaultDesign } from '../src/lib/planning';
import { issueToken } from '../src/lib/tokens';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (
  url !== 'http://127.0.0.1:56321' ||
  !process.env.DATABASE_URL?.includes('127.0.0.1:56322')
)
  throw Error('Local tests only');
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const password = randomBytes(24).toString('base64url');
let passed = 0;
const pass = (s: string) => {
  console.log('✓ ' + s);
  passed++;
};
async function account() {
  const email = `planning-${randomUUID()}@yingira.test`;
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
  return { email, c };
}
async function raw(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown>,
) {
  return c.rpc('yingira_planning', { p_action: action, p_data: data });
}
async function call(
  c: SupabaseClient,
  action: string,
  data: Record<string, unknown>,
) {
  const r = await raw(c, action, data);
  assert.ifError(r.error);
  return r.data;
}
const owner = await account(),
  outsider = await account();
assert.ifError(
  (
    await service.rpc('yingira_authorize_organization_creator', {
      p_email: owner.email,
    })
  ).error,
);
const org = await owner.c.rpc('yingira_command', {
  p_action: 'create_organization',
  p_data: { name: 'Planning integration' },
});
assert.ifError(org.error);
const ev = await owner.c.rpc('yingira_command', {
  p_action: 'create_event',
  p_data: {
    organizationId: org.data.data.id,
    title: 'Planning test',
    venue: 'Test Hall',
    startsAt: '2027-01-01T12:00:00Z',
    timezone: 'Africa/Kampala',
  },
});
assert.ifError(ev.error);
const eventId = ev.data.data.id;
assert.equal(
  (await raw(outsider.c, 'state', { eventId })).error?.code,
  '42501',
);
pass('Another organization cannot read the guest list or draft');
const guest = {
  name: 'Test Household',
  phone: '',
  email: '',
  capacity: 3,
  tableLabel: 'Table 1',
  category: 'Family',
  note: 'Private note',
};
const jobId = randomUUID();
await call(owner.c, 'create_import', {
  eventId,
  jobId,
  name: 'sample.csv',
  rows: [
    { ...guest, rowKey: 2, keepDuplicate: false },
    { ...guest, rowKey: 3, keepDuplicate: false },
  ],
});
await call(owner.c, 'create_import', {
  eventId,
  jobId,
  name: 'retry',
  rows: [
    { ...guest, name: 'Must not be appended', rowKey: 4, keepDuplicate: false },
  ],
});
let state = await call(owner.c, 'state', { eventId });
assert.equal(state.jobs[0].total, 2);
pass('Import creation retries preserve the confirmed rows');
const key = randomBytes(32).toString('base64');
const tokens = [2, 3].map((rowKey) => ({ rowKey, ...issueToken(key) }));
await Promise.all([
  call(owner.c, 'import_batch', { eventId, jobId, tokens }),
  call(owner.c, 'import_batch', { eventId, jobId, tokens }),
]);
state = await call(owner.c, 'state', { eventId });
assert.equal(state.guests.length, 1);
assert.equal(state.jobs[0].skipped, 1);
pass('Concurrent batch retries create one group and skip a duplicate');
assert.equal(
  (await raw(outsider.c, 'import_batch', { eventId, jobId, tokens })).error
    ?.code,
  '42501',
);
pass('Import jobs cannot be processed by a different organization');
const saved = state.guests[0];
await call(owner.c, 'save_guest', {
  eventId,
  guestId: saved.id,
  expectedVersion: saved.version,
  guest: { ...guest, capacity: 4, email: 'guest@example.test' },
});
assert.ok(
  (
    await raw(owner.c, 'save_guest', {
      eventId,
      guestId: saved.id,
      expectedVersion: saved.version,
      guest,
    })
  ).error,
);
pass('Guest edits reject stale versions and permit missing phone data');
await call(owner.c, 'save_design', {
  eventId,
  expectedRevision: 0,
  design: { ...defaultDesign, bride: 'Alice', groom: 'Bob' },
});
assert.ok(
  (
    await raw(owner.c, 'save_design', {
      eventId,
      expectedRevision: 0,
      design: defaultDesign,
    })
  ).error,
);
pass('Concurrent design edits do not overwrite a newer draft');
const publicBefore = await service.rpc('yingira_public_invitation', {
  p_token: tokens[0].token,
});
assert.ifError(publicBefore.error);
assert.equal(publicBefore.data.design, null);
pass('Drafts are not visible on public invitations');
await call(owner.c, 'publish_design', { eventId, expectedRevision: 1 });
const publicAfter = await service.rpc('yingira_public_invitation', {
  p_token: tokens[0].token,
});
assert.equal(publicAfter.data.design.bride, 'Alice');
assert.equal(publicAfter.data.capacity, 4);
pass('Publishing decorates the existing invitation without replacing its QR');
assert.ok(
  (
    await raw(owner.c, 'save_design', {
      eventId,
      expectedRevision: 2,
      design: { ...defaultDesign, assetId: randomUUID() },
    })
  ).error,
);
pass('Designs cannot reference an unregistered asset');
state = await call(owner.c, 'state', { eventId });
await call(owner.c, 'restore_design', {
  eventId,
  expectedRevision: 2,
  versionId: state.versions[0].id,
});
assert.equal((await call(owner.c, 'state', { eventId })).revision, 3);
pass('Published versions can be restored to a new draft revision');
assert.equal(
  (
    await service.rpc('yingira_planning', {
      p_action: 'state',
      p_data: { eventId },
    })
  ).error !== null,
  true,
);
pass('Operator credential is not a substitute for an authenticated Admin');
const bulkJob = randomUUID();
await call(owner.c, 'create_import', {
  eventId,
  jobId: bulkJob,
  name: '1000-row-load.csv',
  rows: Array.from({ length: 1000 }, (_, i) => ({
    ...guest,
    name: `Bulk Household ${i}`,
    rowKey: i + 2,
    keepDuplicate: false,
  })),
});
for (let offset = 0; offset < 1000; offset += 40) {
  await call(owner.c, 'import_batch', {
    eventId,
    jobId: bulkJob,
    tokens: Array.from({ length: 40 }, (_, i) => ({
      rowKey: offset + i + 2,
      ...issueToken(key),
    })),
  });
}
state = await call(owner.c, 'state', { eventId });
const bulk = state.jobs.find((j: { id: string }) => j.id === bulkJob);
assert.equal(bulk.created, 1000);
assert.equal(bulk.processed, 1000);
pass('A 1,000-row import completes through bounded durable batches');
console.log(`${passed} planning integration checks passed`);
