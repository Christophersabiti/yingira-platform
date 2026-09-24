import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync('.local/fixture.json', 'utf8')) as {
  ownerEmail: string;
  staffEmail: string;
  password: string;
  eventId: string;
  token: string;
  gateId: string;
};
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(
    email === fixture.staffEmail ? `/work/${fixture.eventId}` : '/dashboard',
  );
}
test('public welcome and protected workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Make every/ })).toBeVisible();
  await page.screenshot({ path: '.local/landing-desktop.png', fullPage: true });
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login');
});
test('organizer creates event and invitation through the UI', async ({
  page,
}) => {
  await login(page, fixture.ownerEmail);
  await page.getByRole('button', { name: 'Create event', exact: true }).click();
  await page.getByLabel('Event title').fill('A browser-tested gathering');
  await page.getByLabel('Venue', { exact: true }).fill('The Kampala gardens');
  await page.getByLabel('Date and time').fill('2026-12-20T14:00');
  await page
    .getByRole('button', { name: 'Create event', exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(/\/events\//);
  await expect(
    page.getByRole('heading', { name: 'A browser-tested gathering' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add guest', exact: true }).click();
  await page.getByLabel('Guest name').fill('Amina Demo');
  await page.getByLabel('Phone number').fill('+256700000123');
  await page.getByLabel('People allowed').fill('3');
  await page.getByLabel('Table / directions', { exact: true }).fill('Table 4');
  await page
    .getByRole('button', { name: 'Create invitation', exact: true })
    .click();
  await expect(page.getByText('Amina Demo', { exact: true })).toBeVisible();
  const link = await page
    .getByRole('link', { name: 'View', exact: true })
    .getAttribute('href');
  expect(link).toMatch(/\/i\/[A-Za-z0-9_-]{43}$/);
  await page
    .getByRole('button', { name: 'Open check-in', exact: true })
    .click();
  await expect(
    page.getByText('Check-in is open', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '.local/event-desktop.png', fullPage: true });
  await page.goto(link!);
  await expect(page.getByText('Dear Amina Demo,')).toBeVisible();
  await expect(
    page.getByAltText('Entrance QR invitation for Amina Demo'),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('+256700000123');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: '.local/invitation-mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('usher recovers a lost admission response without admitting twice', async ({
  page,
}) => {
  await login(page, fixture.staffEmail);
  await page.goto(`/events/${fixture.eventId}`);
  await expect(page.getByText('Ready to welcome guests?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add guest' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Start usher shift' }).click();
  await expect(page.getByRole('button', { name: 'Open camera' })).toBeVisible();
  await page.screenshot({ path: '.local/scanner-mobile.png', fullPage: true });
  await page.getByText('Use an invitation link instead').click();
  await page
    .getByLabel('Invitation link', { exact: true })
    .fill(`http://localhost:3000/i/${fixture.token}`);
  await page
    .getByRole('button', { name: 'Verify invitation', exact: true })
    .click();
  await expect(
    page.getByText('VALID INVITATION', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.phone-mask')).toContainText('0001');
  await page.getByLabel('People arriving now').fill('1');
  let dropped = false;
  await page.route('**/api/command', async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === 'admit' && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page
    .getByRole('button', { name: 'Admit 1 person', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Recover admission result' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Start usher shift' }).click();
  await expect(
    page.getByRole('button', { name: 'Recover admission result' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Recover admission result' }).click();
  await expect(
    page.getByText('ADMITTED SUCCESSFULLY', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('1 admitted · 1 remaining')).toBeVisible();
  await page.screenshot({
    path: '.local/admission-mobile.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'End shift', exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('organizer sees the usher timestamp and API denies cross-origin mutation', async ({
  page,
}) => {
  await login(page, fixture.ownerEmail);
  await page.goto(`/events/${fixture.eventId}`);
  await page
    .getByRole('button', { name: 'Recent gate activity', exact: true })
    .click();
  await expect(
    page.locator('.activity-list').getByText('Browser Journey Guest'),
  ).toBeVisible();
  await expect(page.locator('.activity-list time').first()).toHaveText(
    /\d{2}:\d{2}/,
  );
  const response = await page.request.post('/api/command', {
    headers: { Origin: 'https://untrusted.example' },
    data: { action: 'create_organization', name: 'Unauthorized' },
  });
  expect(response.status()).toBe(403);
});

test('Admin can support in either staff role and return to administration', async ({
  page,
}) => {
  await login(page, fixture.ownerEmail);
  await page.goto(`/events/${fixture.eventId}`);
  await page
    .getByRole('link', { name: 'Work as supervisor', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Start supervisor shift', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Event overview' }),
  ).toBeVisible();
  await expect(
    page.getByText('Admin supporting · Supervisor', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'End shift', exact: true }).click();
  await expect(page).toHaveURL(`/events/${fixture.eventId}`);
  await page.getByRole('link', { name: 'Work as usher', exact: true }).click();
  await page
    .getByRole('button', { name: 'Start usher shift', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Open camera', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Event overview' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'End shift', exact: true }).click();
});
test('Admin can invite an unregistered supervisor and cancel the pending invitation', async ({
  page,
}) => {
  await login(page, fixture.ownerEmail);
  await page.goto(`/events/${fixture.eventId}`);
  await page.getByRole('button', { name: 'Event team' }).click();
  const email = `pending-${Date.now()}@yingira.test`;
  await page.getByLabel('Staff email').fill(email);
  await page.getByLabel('Role', { exact: true }).selectOption('supervisor');
  await page
    .getByRole('button', { name: 'Invite or update team member' })
    .click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Cancel invitation', exact: true })
    .click();
  await expect(page.getByText(email, { exact: true })).toHaveCount(0);
});
