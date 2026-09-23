// Regenerates the home-screen icon and the link-preview card. The card needs the dev server (port 5200 by default).
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge' });
try {
  // iOS rounds the icon itself and fills transparent corners with black, so this one is full-bleed.
  const svg = readFileSync('public/favicon.svg', 'utf8').replace('rx="14"', 'rx="0"');
  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await icon.setContent(`<body style="margin:0"><img style="display:block" width="180" height="180" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`);
  await icon.locator('img').evaluate(img => img.decode());
  await icon.screenshot({ path: 'public/apple-touch-icon.png' });

  // The card is the real hero at the 1200×630 size link previews use, minus the page chrome.
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce' });
  await page.goto(process.env.HOME_TEST_URL || 'http://127.0.0.1:5200/');
  await page.waitForSelector('.ler-play button:not([disabled])');
  await page.evaluate(() => document.fonts.ready);
  for (const img of await page.locator('.ler-hero-art, .ler-powered img').all()) await img.evaluate(el => el.decode());
  // At this height the first sparkle lands on the kicker text.
  await page.addStyleTag({ content: '.ler-nav, .ler-hero-copy .ler-button, .ler-scroll, .ler-spark-one { display: none; }' });
  await page.screenshot({ path: 'public/social-card.jpg', type: 'jpeg', quality: 85 });
  console.log('Wrote public/apple-touch-icon.png and public/social-card.jpg');
} finally { await browser.close(); }
