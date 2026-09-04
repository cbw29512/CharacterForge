const fs = require('fs');
const puppeteer = require('puppeteer');

const baseUrl = process.env.CI_BASE_URL || 'http://127.0.0.1:5050';
const username = process.env.CI_PLAYER_USERNAME;
const password = process.env.CI_PLAYER_PASSWORD;
const characterId = process.env.CI_CHARACTER_ID;

if (!username || !password || !characterId) {
  throw new Error('CI_PLAYER_USERNAME, CI_PLAYER_PASSWORD, and CI_CHARACTER_ID are required');
}

async function login(page) {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle0' });
  await page.type('#login-username', username);
  await page.type('#login-password', password);
  await page.click('.role-btn[data-role="player"]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type=submit]')
  ]);
  if (page.url().includes('/auth/login')) throw new Error('Browser login did not leave /auth/login');
}

async function assertNoViewportOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  const width = Math.max(metrics.scrollWidth, metrics.bodyWidth);
  if (width > metrics.innerWidth + 2) {
    throw new Error(`${label} overflows viewport: content=${width}, viewport=${metrics.innerWidth}`);
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await login(page);

    await page.goto(`${baseUrl}/characters/new`, { waitUntil: 'networkidle0' });
    if (!(await page.$('form'))) throw new Error('Character builder did not render a form');

    await page.goto(`${baseUrl}/characters/${characterId}/sheet`, { waitUntil: 'networkidle0' });
    const heading = await page.$eval('h1', el => el.textContent.trim());
    if (heading !== 'A11y Test Fighter') throw new Error(`Unexpected character sheet heading: ${heading}`);

    await page.emulateMediaType('print');
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync('/tmp/characterforge-sheet.pdf', pdf);
    if (pdf.length < 15000) throw new Error(`Generated character PDF is unexpectedly small: ${pdf.length} bytes`);
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    if (pageCount < 1 || pageCount > 3) throw new Error(`Unexpected character PDF page count: ${pageCount}`);

    await page.emulateMediaType('screen');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}/player/`, { waitUntil: 'networkidle0' });
    await assertNoViewportOverflow(page, 'Player dashboard');

    await page.goto(`${baseUrl}/characters/${characterId}/sheet`, { waitUntil: 'networkidle0' });
    await assertNoViewportOverflow(page, 'Character sheet');

    console.log(`Browser release checks passed; PDF bytes=${pdf.length}, pages=${pageCount}`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
