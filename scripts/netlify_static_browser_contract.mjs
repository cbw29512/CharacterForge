import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const origin = process.env.CHARACTERFORGE_STATIC_ORIGIN || 'http://127.0.0.1:4174';
const pages = [
  '/index.html',
  '/login.html',
  '/setup.html',
  '/app.html',
  '/admin.html',
  '/campaign.html?id=1',
  '/character.html?id=1',
  '/character-new.html?campaign_id=1',
  '/templates.html',
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const path of pages) {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.goto(`${origin}${path}`, { waitUntil: 'networkidle0' });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert.ok(
      metrics.scrollWidth <= metrics.clientWidth + 1 && metrics.bodyScrollWidth <= metrics.innerWidth + 1,
      `${path} overflows at 390px: ${JSON.stringify(metrics)}`,
    );
    await page.close();
  }

  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
  await page.goto(`${origin}/character.html?id=1`, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');

  const printContract = await page.evaluate(() => {
    const style = (selector) => getComputedStyle(document.querySelector(selector));
    const columns = (selector) => style(selector).gridTemplateColumns.split(' ').filter(Boolean).length;
    return {
      topbarDisplay: style('.topbar').display,
      saveTemplateDisplay: style('#save-template-section').display,
      deleteDisplay: style('#delete-character').display,
      cardShadow: style('.card').boxShadow,
      twoColumnCount: columns('.two-column'),
      statColumnCount: columns('.stat-grid'),
      shellWidth: document.querySelector('.shell').getBoundingClientRect().width,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  assert.equal(printContract.topbarDisplay, 'none');
  assert.equal(printContract.saveTemplateDisplay, 'none');
  assert.equal(printContract.deleteDisplay, 'none');
  assert.equal(printContract.cardShadow, 'none');
  assert.equal(printContract.twoColumnCount, 2);
  assert.equal(printContract.statColumnCount, 4);
  assert.ok(printContract.shellWidth <= printContract.viewportWidth + 1);

  const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
  assert.ok(pdf.byteLength > 3000, `print PDF unexpectedly small: ${pdf.byteLength}`);
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString('ascii'), '%PDF');
  await page.close();

  console.log(JSON.stringify({ ok: true, mobile_pages: pages.length, print: 'letter' }));
} finally {
  await browser.close();
}
