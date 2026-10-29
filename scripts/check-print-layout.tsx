import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium } from '@playwright/test';
import QRCode from 'qrcode';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { InvitationCard } from '../src/components/invitation-card';
import { defaultDesign } from '../src/lib/planning';
import { fitPrintCard } from '../src/lib/print-card-fit';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const qr = await QRCode.toDataURL('https://example.com/invite/sample', {
    margin: 4,
  });
  const design = {
    ...defaultDesign,
    groom: 'Joseph',
    bride: 'Tess',
    experience: {
      ...defaultDesign.experience,
      ceremonyVenue: 'St. Paul’s Cathedral, Namirembe',
      ceremonyTime: '12:00 pm',
      receptionVenue: 'Kampala Serena Hotel',
      receptionTime: '4:00 pm',
    },
  };
  for (const [label, additional, expected] of [
    ['short', '', true],
    [
      'long',
      'Join us for dinner and dancing as we celebrate with our family and friends. '.repeat(
        12,
      ),
      true,
    ],
    ['excessive', 'Full programme and additional details. '.repeat(150), false],
  ] as const) {
    const markup = renderToStaticMarkup(
      <InvitationCard
        design={{ ...design, programme: additional }}
        details={{
          title: 'Wedding',
          venue: 'Kampala',
          startsAt: '2026-12-12T09:00:00Z',
          timezone: 'Africa/Kampala',
          guestName: 'Mr. and Mrs. Example',
          capacity: 2,
          tableLabel: 'Table 4',
        }}
        qr={qr}
      />,
    );
    await page.setContent(
      `<style>${readFileSync('src/app/globals.css', 'utf8')}</style>${markup}`,
    );
    await page.evaluate(() => document.fonts.ready);
    const initialBottom = await page
      .locator('.print-notes')
      .evaluate((el) => el.getBoundingClientRect().bottom);
    await page.addScriptTag({
      content: `window.fitPrintCard = ${fitPrintCard.toString()}`,
    });
    const fits = await page.evaluate(
      'window.fitPrintCard(document.querySelector("article"))',
    );
    assert.equal(fits, expected, label);
    const result = await page.locator('article').evaluate((el) => ({
      density: (el as HTMLElement).dataset.density,
      height: el.getBoundingClientRect().height,
      entrance: el
        .querySelector('.print-admission img')!
        .getBoundingClientRect().width,
      map: el.querySelector('.print-map-qr svg')!.getBoundingClientRect().width,
    }));
    assert.equal(result.entrance, 116);
    assert.equal(result.map, 82);
    assert.ok(Math.abs(result.height - 650.357143) < 0.1);
    if (label === 'long') {
      assert.ok(
        initialBottom > 650,
        'Regression fixture must overflow the original layout',
      );
      assert.notEqual(result.density, 'comfortable');
      await page
        .locator('article')
        .screenshot({ path: '/tmp/yingira-fitted-print.png' });
    }
    console.log(label, { fits, ...result });
  }
} finally {
  await browser.close();
}
