import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test, { before } from 'node:test';

const execFileAsync = promisify(execFile);

before(async () => {
  await execFileAsync(process.execPath, ['scripts/build_netlify_frontend.mjs'], { cwd: process.cwd() });
});

async function text(path) {
  return readFile(path, 'utf8');
}

test('Netlify build emits only a static application shell', async () => {
  const index = await text('_site/index.html');
  assert.equal(index.includes('{{'), false);
  assert.equal(index.includes('{%'), false);
  assert.match(index, /type="module" src="\/js\/frontend-app\.js"/);
  await stat('_site/static/css/app.css');
  await stat('_site/js/api.js');
  await stat('_site/js/frontend-app.js');
  await stat('_site/data/srd-5.1.json');
});

test('published SRD catalog is byte-for-byte the certified shared source', async () => {
  assert.equal(await text('_site/data/srd-5.1.json'), await text('shared/srd-5.1.json'));
});

test('frontend JavaScript parses as valid modules', async () => {
  await execFileAsync(process.execPath, ['--check', '_site/js/api.js']);
  await execFileAsync(process.execPath, ['--check', '_site/js/frontend-app.js']);
});

test('frontend mutations use the session-bound readable CSRF cookie', async () => {
  const api = await text('_site/js/api.js');
  assert.match(api, /__Host-cf_csrf/);
  assert.match(api, /x-csrf-token/);
  assert.match(api, /credentials: 'same-origin'/);
  assert.match(api, /cache: 'no-store'/);
  assert.doesNotMatch(api, /X-CSRFToken/);
});

test('frontend shell uses Netlify API routes instead of legacy Flask action routes', async () => {
  const api = await text('_site/js/api.js');
  for (const route of [
    '/api/auth/setup', '/api/auth/login', '/api/auth/me', '/api/auth/logout',
    '/api/campaigns', '/api/campaigns/browse', '/api/campaigns/join', '/api/campaigns/delete',
    '/api/characters/create', '/api/characters/delete',
    '/api/templates', '/api/templates/save', '/api/templates/use', '/api/templates/delete',
  ]) assert.equal(api.includes(route), true, `missing ${route}`);
  for (const legacy of ["'/auth/login'", "'/characters/create'", "'/templates/api/list'"]) {
    assert.equal(api.includes(legacy), false, `legacy route leaked: ${legacy}`);
  }
});

test('template client sends the exact Function identifier field', async () => {
  const api = await text('_site/js/api.js');
  assert.match(api, /body: \{ template_id: templateId \}/);
  assert.doesNotMatch(api, /body: \{ id: templateId \}/);
});

test('Netlify routing does not rewrite nested API routes to guessed function names', async () => {
  const config = await text('netlify.toml');
  assert.equal(config.includes('from = "/api/*"'), false);
  assert.match(config, /publish = "_site"/);
  assert.match(config, /functions = "netlify\/functions"/);
});

test('static shell exposes the migrated application views', async () => {
  const index = await text('_site/index.html');
  for (const id of ['setup-view', 'login-view', 'campaigns-view', 'browse-view', 'characters-view', 'templates-view']) {
    assert.equal(index.includes(`id="${id}"`), true, `missing ${id}`);
  }
});
