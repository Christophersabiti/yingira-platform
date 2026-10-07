import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { defaultDesign } from '../../src/lib/planning';
const fixture = JSON.parse(readFileSync('.local/fixture.json', 'utf8'));

test('customized shared invitation preserves photo privacy, calendar, offline QR and mobile access', async ({
  page,
  browser,
}) => {
  test.setTimeout(100000);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(fixture.ownerEmail);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/dashboard');
  const stateResponse = await page.request.post('/api/planning', {
    headers: { origin: 'http://localhost:3000' },
    data: { action: 'state', eventId: fixture.eventId },
  });
  expect(stateResponse.ok()).toBe(true);
  const state = await stateResponse.json();
  // Register three genuinely separate uploads through the production HTTP path.
  const assetIds: string[] = [];
  for (const background of ['#a1b7a0', '#c5a78b', '#b3b7bf']) {
    const image = await sharp({
      create: { width: 1100, height: 1400, channels: 3, background },
    })
      .png()
      .toBuffer();
    const upload = await page.request.post(
      `/api/planning/assets?eventId=${fixture.eventId}`,
      {
        data: image,
        headers: {
          'content-type': 'image/png',
          origin: 'http://localhost:3000',
        },
      },
    );
    expect(upload.ok()).toBe(true);
    assetIds.push((await upload.json()).id);
  }
  const design = {
    ...defaultDesign,
    bride: 'Amina',
    groom: 'Daniel',
    background: '#fffdf8',
    experience: {
      ...defaultDesign.experience,
      coverTitle: 'A day for love.',
      coverSubtitle: 'Together is a beautiful place to be',
      brideAssetId: assetIds[0],
      groomAssetId: assetIds[1],
      closingAssetId: assetIds[2],
      ceremonyVenue: 'Garden Chapel',
      ceremonyTime: '10:00 AM',
      ceremonyMap: 'https://maps.google.com/?q=Kampala',
      receptionVenue: 'The Garden Pavilion',
      receptionMap: 'https://maps.google.com/?q=Kampala',
      kindNote: 'Bring your brightest smile.',
      closingMessage: 'Let all that you do be done in love.',
    },
  };
  const saved = await page.request.post('/api/planning', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      action: 'save_design',
      eventId: fixture.eventId,
      expectedRevision: state.revision,
      design,
    },
  });
  expect(saved.ok()).toBe(true);
  const revision = (await saved.json()).revision;
  const published = await page.request.post('/api/planning', {
    headers: { origin: 'http://localhost:3000' },
    data: {
      action: 'publish_design',
      eventId: fixture.eventId,
      expectedRevision: revision,
    },
  });
  expect(published.ok()).toBe(true);
  await page.goto(`/events/${fixture.eventId}/studio`);
  await expect(
    page.getByLabel('Front page title', { exact: true }),
  ).toHaveValue('A day for love.');
  await expect(page.getByLabel('Flower style')).toHaveValue('ivory');
  await expect(
    page.getByRole('button', { name: 'Remove bride portrait' }),
  ).toBeVisible();
  // Exercise the actual portrait-upload and front-page editing controls as well.
  await page
    .getByLabel('Front page title', { exact: true })
    .fill('Our beautiful beginning.');
  const portrait = await sharp({
    create: { width: 1200, height: 1500, channels: 3, background: '#b5b6a0' },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel('Bride portrait', { exact: true })
    .setInputFiles({
      name: 'bride.png',
      mimeType: 'image/png',
      buffer: portrait,
    });
  await expect(page.getByRole('status')).toContainText('Draft saved', {
    timeout: 15000,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: 'Publish design', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Published.');
  // A guest browser has no organizer cookies.
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const guest = await guestContext.newPage();
  try {
    await guest.goto(`/i/${fixture.token}`);
    await expect(
      guest.getByText('Our beautiful beginning.', { exact: true }),
    ).toBeVisible();
    await guest.screenshot({ path: '.local/shared-invitation-envelope.png' });
    await guest.locator('summary.inv-cover').click();
    await expect(guest.locator('.inv-envelope')).toHaveAttribute('open', '');
    await expect(
      guest.getByRole('heading', { name: /Amina.*Daniel/ }),
    ).toBeVisible();
    for (const name of [
      'Amina',
      'Daniel',
      'Closing photograph chosen by the hosts',
    ]) {
      const img = guest.getByRole('img', { name, exact: true });
      await expect(img).toHaveCount(1);
      const src = await img.getAttribute('src');
      const assetUrl = new URL(src!, 'http://localhost:3000');
      expect((await guest.request.get(assetUrl.toString())).status()).toBe(200);
      assetUrl.searchParams.delete('token');
      expect((await guest.request.get(assetUrl.toString())).status()).toBe(404);
    }
    await expect(
      guest.getByRole('link', { name: 'Ceremony directions' }),
    ).toHaveAttribute('href', 'https://maps.google.com/?q=Kampala');
    const calendar = guest.waitForEvent('download');
    await guest
      .getByRole('button', { name: 'Add to calendar', exact: true })
      .click();
    const calendarText = readFileSync((await (await calendar).path())!, 'utf8');
    expect(calendarText).toContain('BEGIN:VCALENDAR');
    expect(calendarText).toContain(`celebration.${fixture.eventId}@yingira`);
    expect(calendarText).toContain('LOCATION:The Garden Pavilion');
    await guest
      .getByRole('button', { name: 'Entrance QR', exact: true })
      .click();
    await expect(
      guest.getByRole('region', { name: 'Entrance admission' }),
    ).toBeInViewport();
    const qr = guest.locator('.inv-qr-frame > img');
    const pixels = await sharp(await qr.screenshot())
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(
      jsQR(
        new Uint8ClampedArray(pixels.data),
        pixels.info.width,
        pixels.info.height,
      )?.data,
    ).toBe(`http://localhost:3000/i/${fixture.token}`);
    const offline = guest.waitForEvent('download');
    await guest
      .getByRole('button', { name: 'Download invitation', exact: true })
      .click();
    const image = await sharp((await (await offline).path())!)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(
      jsQR(
        new Uint8ClampedArray(image.data),
        image.info.width,
        image.info.height,
      )?.data,
    ).toBe(`http://localhost:3000/i/${fixture.token}`);
    for (const width of [320, 390, 1280]) {
      await guest.setViewportSize({ width, height: 844 });
      expect(
        await guest.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await guest.setViewportSize({ width: 390, height: 844 });
    await guest.screenshot({
      path: '.local/shared-invitation-story.png',
      fullPage: true,
    });
  } finally {
    await guestContext.close();
  }
});

test('envelope remains keyboard accessible with JavaScript disabled', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`/i/${fixture.token}`);
    await page.locator('.inv-cover').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.inv-envelope')).toHaveAttribute('open', '');
    await expect(page.locator('.inv-qr-frame > img')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('scroll opens the envelope and sections unveil in normal motion mode', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/i/${fixture.token}`);
  await page.locator('.inv-cover').hover();
  await page.mouse.wheel(0, 100);
  await expect(page.locator('.inv-envelope')).toHaveAttribute('open', '');
  await page.locator('.inv-union').scrollIntoViewIfNeeded();
  await expect(page.locator('.inv-union')).toHaveClass(/is-unveiled/);
  await expect(page.locator('.inv-union')).toHaveCSS('opacity', '1');
  await expect(page.locator('.inv-qr-frame > img')).toBeVisible();
});
