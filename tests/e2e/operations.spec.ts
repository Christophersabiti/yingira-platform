import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync('.local/fixture.json', 'utf8'));
test('Admin configures household RSVP and seating; supervisor records exit and re-entry', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(fixture.ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  const create = await page.request.post('/api/command', {
    headers: { Origin: 'http://localhost:3000' },
    data: {
      action: 'create_guest',
      eventId: fixture.eventId,
      name: 'Operations Journey Guest',
      phone: '+256700000456',
      capacity: 2,
      tableLabel: '',
    },
  });
  expect((await create.json()).ok).toBe(true);
  await page.goto(`/events/${fixture.eventId}`);
  const invitationLink = await page
    .getByRole('row')
    .filter({ hasText: 'Operations Journey Guest' })
    .getByRole('link', { name: 'View', exact: true })
    .getAttribute('href');

  await page.goto(`/events/${fixture.eventId}/operations`);
  await page.getByLabel('Accept household responses').check();
  await page.getByRole('button', { name: 'Save response settings' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page.goto(invitationLink!);
  await page.getByLabel('Name 1', { exact: true }).fill('Browser RSVP Guest');
  await page.getByLabel('Meal preference 1').fill('Vegetarian');
  await page.getByRole('button', { name: 'Add household member' }).click();
  await page.getByLabel('Name 2', { exact: true }).fill('Second Member');
  await page.getByLabel('Attending 2').selectOption('no');
  await page
    .getByRole('button', { name: 'Save response', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('response is saved');
  await page.reload();
  await expect(page.getByLabel('Name 1', { exact: true })).toHaveValue(
    'Browser RSVP Guest',
  );
  await page.goto(`/events/${fixture.eventId}/operations`);
  await page
    .getByRole('button', { name: 'Tables & seating', exact: true })
    .click();
  await page.getByLabel('New table name').fill('Garden table');
  await page.getByLabel('Table capacity', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Create table', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page
    .getByLabel('Table for Operations Journey Guest', { exact: true })
    .selectOption({ label: 'Garden table · 2 free' });
  await expect(page.getByRole('status')).toHaveText('Saved.');
  const csv = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export seating & meal list' })
    .click();
  expect((await csv).suggestedFilename()).toBe('yingira-seating.csv');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-seating')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Garden table · 2/2 reserved' }),
  ).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page
    .getByRole('button', { name: 'Email invitations', exact: true })
    .click();
  await expect(page.getByText(/Email sending is not connected/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send queued emails', exact: true }),
  ).toBeDisabled();
  await page.goto(`/work/${fixture.eventId}?role=supervisor`);
  await page.getByRole('button', { name: 'Start supervisor shift' }).click();
  await page
    .getByLabel('Find guest at the gate')
    .fill('Operations Journey Guest');
  await page.getByRole('button', { name: 'Find guest', exact: true }).click();
  await page
    .getByRole('button', { name: /Operations Journey Guest.*Phone ending/ })
    .click();
  await page
    .getByLabel('Verification / exception reason')
    .fill('Host confirmed identity');
  await page
    .getByRole('button', { name: 'Confirm assisted first entry' })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '1 people from this invitation are now inside',
  );
  await page.getByRole('button', { name: 'Find guest', exact: true }).click();
  await page
    .getByRole('button', { name: /Operations Journey Guest.*Phone ending/ })
    .click();
  await page.getByRole('button', { name: 'Record exit', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(
    '0 people from this invitation are now inside',
  );
  await page.getByRole('button', { name: 'Find guest', exact: true }).click();
  await page
    .getByRole('button', { name: /Operations Journey Guest.*Phone ending/ })
    .click();
  await page
    .getByRole('button', { name: 'Record re-entry', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '1 people from this invitation are now inside',
  );
  await page.getByRole('button', { name: 'End shift', exact: true }).click();
  await expect(page).toHaveURL(`/events/${fixture.eventId}`);
});
