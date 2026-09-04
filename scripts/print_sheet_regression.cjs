const fs = require('fs');
const puppeteer = require('puppeteer');

const baseUrl = process.env.CI_BASE_URL || 'http://127.0.0.1:5050';
const username = process.env.CI_PLAYER_USERNAME;
const password = process.env.CI_PLAYER_PASSWORD;
const characterId = process.env.CI_CHARACTER_ID;
const outputPath = process.env.CI_PRINT_PDF || '/tmp/characterforge-sheet.pdf';

if (!username || !password || !characterId) {
  throw new Error('Player credentials and CI_CHARACTER_ID are required for print regression');
}

(async () => {
  const browser = await puppeteer.launch({args: ['--no-sandbox']});
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1280, height: 900});
    await page.goto(`${baseUrl}/auth/login`, {waitUntil: 'networkidle0'});

    await page.type('#login-username', username);
    await page.type('#login-password', password);
    await page.click('.role-btn[data-role="player"]');
    await Promise.all([
      page.waitForNavigation({waitUntil: 'networkidle0'}),
      page.click('button[type="submit"]')
    ]);

    await page.goto(`${baseUrl}/characters/${characterId}/sheet`, {waitUntil: 'networkidle0'});
    const title = await page.$eval('h1', element => element.textContent.trim());
    if (title !== 'A11y Test Fighter') {
      throw new Error(`Unexpected character sheet title: ${title}`);
    }

    await page.emulateMediaType('print');
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true
    });

    const stat = fs.statSync(outputPath);
    if (stat.size < 1000) {
      throw new Error(`Generated PDF is unexpectedly small: ${stat.size} bytes`);
    }
    console.log(`Generated ${outputPath} (${stat.size} bytes)`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
