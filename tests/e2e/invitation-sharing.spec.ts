import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import jsQR from 'jsqr';
const fixture = JSON.parse(readFileSync('.local/fixture.json', 'utf8'));

test('Admin copies readable guest URL and exports only selected guests; short URL preserves entrance QR', async ({
  page,
  context,
  browser,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(fixture.ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await page.goto(
    `/events/${fixture.eventId}/studio?guest=${fixture.invitationId}`,
  );
  const input = page.getByLabel('Guest invitation URL', { exact: true });
  const url = await input.inputValue();
  expect(url).toMatch(
    /^http:\/\/localhost:3000\/[a-z0-9][a-z0-9-]{0,23}-[A-Za-z0-9_-]{16}$/,
  );
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy URL', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Invitation URL copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  const option = page
    .locator('.bulk-guest-option')
    .filter({ has: page.locator('input:not(:disabled)') })
    .first();
  const selectedName = (await option.innerText()).trim();
  await option.getByRole('checkbox').check();
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download selected URLs (CSV)' })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('yingira-guest-urls.csv');
  const csv = readFileSync((await file.path())!, 'utf8');
  expect(csv).toContain('"Guest name","Invitation URL"');
  expect(csv).toContain(selectedName);
  expect(csv.split('\r\n')).toHaveLength(2);
  await page.getByRole('button', { name: 'Copy selected URLs' }).click();
  await expect(page.getByRole('status')).toContainText('Copied 1 guest names');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    `${selectedName}\thttp://localhost:3000/`,
  );
  const guestContext = await browser.newContext({ reducedMotion: 'reduce' });
  const guest = await guestContext.newPage();
  try {
    await guest.goto(url);
    await expect(guest).toHaveURL(url);
    const cover = guest.locator('summary.inv-cover');
    if (await cover.count()) await cover.click();
    const qr = guest.locator(
      '.inv-qr-frame > img, .design-qr img, .qr-card img',
    );
    await expect(qr).toHaveCount(1);
    const raw = await sharp(await qr.screenshot())
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(
      jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height)
        ?.data,
    ).toBe(`http://localhost:3000/i/${fixture.token}`);
    await guest.goto('/florence');
    await expect(
      guest.getByRole('heading', { name: 'We couldn’t find that.' }),
    ).toBeVisible();
  } finally {
    await guestContext.close();
  }
  await page
    .locator('.studio-preview > .panel')
    .first()
    .screenshot({ path: '.local/invitation-url-controls.png' });
});
