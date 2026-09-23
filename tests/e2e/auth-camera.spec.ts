import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
const fixture = JSON.parse(readFileSync('.local/fixture.json', 'utf8')) as {
  staffEmail: string;
  password: string;
  eventId: string;
  token: string;
};
test('registration requires and accepts local email confirmation', async ({
  page,
  request,
}) => {
  const email = `registration-${randomUUID().slice(0, 8)}@yingira.test`;
  await page.goto('/register');
  await page.getByLabel('Email address').fill(email);
  await page
    .getByLabel('Password', { exact: true })
    .fill('Local-test-password-123!');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  let id = '';
  await expect
    .poll(async () => {
      const response = await request.get(
        'http://127.0.0.1:56324/api/v1/messages',
      );
      const body = await response.json();
      const message = body.messages.find((m: { To: { Address: string }[] }) =>
        m.To.some((t) => t.Address === email),
      );
      id = message?.ID ?? '';
      return Boolean(id);
    })
    .toBe(true);
  const response = await request.get(
    `http://127.0.0.1:56324/api/v1/message/${id}`,
  );
  const message = await response.json();
  const match = String(message.HTML).match(
    /href="([^"]*\/auth\/v1\/verify[^\"]*)"/,
  );
  expect(match).not.toBeNull();
  await page.goto(match![1].replaceAll('&amp;', '&'));
  await expect(page).toHaveURL('/dashboard');
  await expect(
    page.getByRole('heading', { name: 'Your event assignments' }),
  ).toBeVisible();
});
test('camera pipeline decodes a QR frame without admitting automatically', async ({
  page,
}) => {
  const dataUrl = await QRCode.toDataURL(
    `http://localhost:3000/i/${fixture.token}`,
    { width: 300, margin: 3 },
  );
  await page.addInitScript(
    ({ dataUrl }) => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 600;
          canvas.height = 600;
          const ctx = canvas.getContext('2d')!;
          const image = new Image();
          image.src = dataUrl;
          await image.decode();
          const draw = () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, 600, 600);
            ctx.drawImage(image, 150, 150, 300, 300);
          };
          draw();
          setInterval(draw, 100);
          return canvas.captureStream(10);
        },
      });
    },
    { dataUrl },
  );
  await page.goto('/login');
  await page.getByLabel('Email address').fill(fixture.staffEmail);
  await page.getByLabel('Password', { exact: true }).fill(fixture.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`/work/${fixture.eventId}`);
  await page
    .getByRole('button', { name: 'Start usher shift', exact: true })
    .click();
  await page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await expect(page.getByText('VALID INVITATION', { exact: true })).toBeVisible(
    { timeout: 15000 },
  );
  await expect(
    page.getByRole('heading', { name: 'Browser Journey Guest' }),
  ).toBeVisible();
  await expect(
    page.getByText('ADMITTED SUCCESSFULLY', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'End shift', exact: true }).click();
});
