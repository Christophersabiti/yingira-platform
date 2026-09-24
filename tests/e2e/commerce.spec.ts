import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync('.local/fixture.json', 'utf8'));
test('Admin plans an event, records a deposit, shares approval and issues a client invoice', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(fixture.ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await page.goto(`/events/${fixture.eventId}/plan`);
  await expect(
    page.getByRole('heading', { name: 'Client & budget settings' }),
  ).toBeVisible();
  await page.getByLabel('Client name', { exact: true }).fill('Browser Client');
  await page
    .getByLabel('Client email', { exact: true })
    .fill('client@yingira.test');
  await page.getByLabel('Budget target (UGX)').fill('2000000');
  await page
    .getByRole('button', { name: 'Save event planning settings' })
    .click();
  await expect(page.getByRole('status').first()).toHaveText('Saved.');
  await page.getByRole('button', { name: 'Tasks', exact: true }).click();
  await page.getByLabel('Task title').fill('Confirm photographer');
  await page.getByLabel('Task owner').fill('Planner');
  await page.getByLabel('Task due date').fill('2027-01-01');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirm photographer' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Suppliers', exact: true }).click();
  await page.getByLabel('Supplier name').fill('Browser Photography');
  await page.getByLabel('Service category').fill('Photography');
  await page.getByLabel('Supplier email').fill('photo@yingira.test');
  await page
    .getByRole('button', { name: 'Save supplier', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Browser Photography' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Programme', exact: true }).click();
  await page.getByLabel('Programme title').fill('Ceremony photography');
  await page.getByLabel('Starts at', { exact: true }).fill('2027-01-01T13:00');
  await page.getByLabel('Ends at', { exact: true }).fill('2027-01-01T14:00');
  await page
    .getByRole('combobox', { name: 'Supplier', exact: true })
    .selectOption({ label: 'Browser Photography' });
  await page.getByRole('button', { name: 'Save programme item' }).click();
  await expect(
    page.getByRole('heading', { name: 'Ceremony photography' }),
  ).toBeVisible();
  const calendar = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export calendar (.ics)', exact: true })
    .click();
  expect((await calendar).suggestedFilename()).toBe('yingira-programme.ics');
  await page
    .getByRole('button', { name: 'Budget & deposits', exact: true })
    .click();
  await page
    .getByLabel('Budget item', { exact: true })
    .fill('Photographer fee');
  await page
    .getByRole('combobox', { name: 'Supplier', exact: true })
    .selectOption({ label: 'Browser Photography' });
  await page.getByLabel('Planned (UGX)').fill('900000');
  await page.getByLabel('Quoted (UGX)').fill('850000');
  await page.getByLabel('Committed (UGX)').fill('800000');
  await page.getByLabel('Deposit required (UGX)').fill('200000');
  await page.getByRole('button', { name: 'Save budget item' }).click();
  await expect(
    page.getByRole('heading', { name: 'Photographer fee' }),
  ).toBeVisible();
  await page.getByLabel('Budget item to pay').selectOption({ index: 1 });
  await page.getByLabel('Payment amount (UGX)').fill('200000');
  await page.getByLabel('Payment reference').fill('BROWSER-DEPOSIT');
  await page
    .getByRole('button', { name: 'Record payment', exact: true })
    .click();
  await expect(page.getByText(/UGX.*200,000.*BROWSER-DEPOSIT/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Client approvals', exact: true })
    .click();
  await page.getByLabel('Review title').fill('Approve browser budget');
  await page
    .getByLabel('Client-facing details')
    .fill('Please review this agreed budget.');
  await page.getByRole('button', { name: 'Create approval link' }).click();
  await expect(
    page.getByRole('heading', { name: 'Approve browser budget' }),
  ).toBeVisible();
  const reviewLink = await page
    .getByRole('link', { name: 'Open review' })
    .getAttribute('href');
  const guest = await context.newPage();
  await guest.goto(reviewLink!);
  await expect(
    guest.getByRole('heading', { name: 'Approve browser budget' }),
  ).toBeVisible();
  await expect(guest.getByText('photo@yingira.test')).toHaveCount(0);
  await guest.getByLabel('Your full name').fill('Client Person');
  await guest
    .getByLabel('Comments', { exact: true })
    .fill('Approved for planning');
  await guest.getByRole('checkbox').check();
  await guest.getByRole('button', { name: 'Record decision' }).click();
  await expect(
    guest.getByRole('heading', { name: 'Approved', exact: true }),
  ).toBeVisible();
  await guest.close();
  await page.reload();
  await page
    .getByRole('button', { name: 'Client approvals', exact: true })
    .click();
  await expect(page.getByText(/Decision by Client Person/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Client invoices', exact: true })
    .click();
  await page
    .getByLabel('Description 1', { exact: true })
    .fill('Planning service');
  await page.getByLabel('Unit price 1', { exact: true }).fill('350000');
  await page.getByRole('button', { name: 'Save invoice draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Draft invoice', exact: true }),
  ).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Issue invoice', exact: true })
    .click();
  await expect(page.getByRole('link', { name: 'Payment link' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Print invoice', exact: true })
    .click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-invoice')).toBeVisible();
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.getByRole('link', { name: 'Payment link' }).click();
  await expect(
    page.getByRole('heading', { name: 'Subscriptions & payments' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Create / show payment link' })
    .click();
  await expect(page.getByRole('link', { name: 'Open invoice' })).toBeVisible();
  const payLink = await page
    .getByRole('link', { name: 'Open invoice' })
    .getAttribute('href');
  const payer = await context.newPage();
  await payer.goto(payLink!);
  await expect(
    payer.getByText(/Online payment is not connected/),
  ).toBeVisible();
  await expect(
    payer.getByRole('heading', { name: /Outstanding UGX.*350,000/ }),
  ).toBeVisible();
  await payer.close();
  await page.goto(`/events/${fixture.eventId}/whatsapp`);
  await expect(
    page.getByRole('heading', { name: 'Automated WhatsApp', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/WhatsApp Business is not connected/),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Dispatch due messages now' }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/events/${fixture.eventId}/plan`);
  await expect(
    page.getByRole('heading', { name: 'Client & budget settings' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
