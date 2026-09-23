import jsQR from 'jsqr';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
const f = JSON.parse(readFileSync('.local/fixture.json', 'utf8'));
test('Admin imports XLSX guests, reviews duplicates, publishes a photo design and downloads cards', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(f.ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(f.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  await page.goto(`/events/${f.eventId}/guests`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Guests');
  sheet.addRow(['Name', 'Phone', 'People', 'Category']);
  sheet.addRow(['Import Family', '', 2, 'Family']);
  sheet.addRow(['Import Family', '', 2, 'Family']);
  sheet.addRow(['Bad Capacity', '', 0, 'Friends']);
  await page.getByLabel('Guest spreadsheet').setInputFiles({
    name: 'guests.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
  });
  await expect(
    page.getByRole('heading', { name: 'Match your columns' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Review guests', exact: true })
    .click();
  await expect(
    page.getByText('Possible duplicate', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Include row 3')).not.toBeChecked();
  await expect(page.getByLabel('Include row 4')).toBeDisabled();
  await page
    .getByRole('button', { name: 'Confirm import of 1 invitations' })
    .click();
  await expect(page.getByText(/Import complete: 1 created/)).toBeVisible();
  await page.getByLabel('Search guests').fill('Import Family');
  await expect(
    page.getByRole('cell', { name: 'Import Family', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page
    .getByRole('region', { name: 'Edit guest' })
    .getByLabel('Table / directions')
    .fill('Table 9');
  await page.getByRole('button', { name: 'Save guest', exact: true }).click();
  await expect(
    page.getByText('Guest updated.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Card & downloads' }).click();
  await expect(
    page.getByRole('heading', { name: 'Make it yours.' }),
  ).toBeVisible();
  await page.getByLabel('Bride / first host').fill('Amina');
  await page.getByLabel('Groom / second host').fill('Daniel');
  const image = await sharp({
    create: { width: 1200, height: 1500, channels: 3, background: '#789080' },
  })
    .png()
    .toBuffer();
  await page.getByLabel('Couple photo or artwork').setInputFiles({
    name: 'couple.png',
    mimeType: 'image/png',
    buffer: image,
  });
  await expect(
    page.getByRole('img', { name: 'Photograph chosen by the hosts' }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Draft saved', {
    timeout: 20000,
  });
  page.once('dialog', (d) => d.accept());
  await page
    .getByRole('button', { name: 'Publish design', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Published.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PNG', exact: true }).click();
  const downloaded = await download;
  const path = await downloaded.path();
  const pixels = await sharp(path!)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decoded = jsQR(
    new Uint8ClampedArray(pixels.data),
    pixels.info.width,
    pixels.info.height,
  );
  expect(decoded?.data).toMatch(
    /^http:\/\/localhost:3000\/i\/[A-Za-z0-9_-]{43}$/,
  );
  expect(downloaded.suggestedFilename()).toMatch(/Import-Family.*\.png/);
  await expect(page.getByRole('status')).toContainText('Downloaded.');
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download 5×7 PDF' }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  await page.screenshot({ path: '.local/studio-desktop.png', fullPage: true });
  await page.goto(`/i/${f.token}`);
  await expect(
    page.getByRole('heading', { name: 'Amina & Daniel' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Photograph chosen by the hosts' }),
  ).toBeVisible();
  const imageSrc = await page
    .getByRole('img', { name: 'Photograph chosen by the hosts' })
    .getAttribute('src');
  const privateUrl = new URL(imageSrc!, 'http://localhost:3000');
  expect((await request.get(privateUrl.toString())).status()).toBe(200);
  privateUrl.searchParams.delete('token');
  expect((await request.get(privateUrl.toString())).status()).toBe(404);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: '.local/studio-guest-mobile.png',
    fullPage: true,
  });
});
