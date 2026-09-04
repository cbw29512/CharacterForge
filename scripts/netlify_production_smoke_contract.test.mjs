import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test, { after, before } from 'node:test';

const execFileAsync = promisify(execFile);
const expectedSha = '0123456789abcdef0123456789abcdef01234567';
let server;
let origin;
let mode = 'ok';

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/build-info.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        commit: mode === 'wrong-sha' ? 'ffffffffffffffffffffffffffffffffffffffff' : expectedSha,
        branch: 'main',
        context: 'production',
        deploy_id: 'deploy-test',
        build_id: 'build-test',
      }));
      return;
    }
    if (req.url === '/api/health') {
      res.writeHead(mode === 'bad-health' ? 503 : 200, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      });
      res.end(JSON.stringify(mode === 'bad-health'
        ? { ok: false, service: 'characterforge', database: 'unavailable' }
        : { ok: true, service: 'characterforge', database: 'reachable', schema: 1 }));
      return;
    }
    if (req.url === '/') {
      const headers = {
        'content-type': 'text/html',
        'content-security-policy': "default-src 'self'; object-src 'none'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'permissions-policy': 'camera=(), microphone=(), geolocation=()',
      };
      if (mode === 'missing-header') delete headers['x-frame-options'];
      res.writeHead(200, headers);
      res.end('<!doctype html><title>CharacterForge</title><h1>CharacterForge</h1>');
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function smoke(overrides = {}) {
  return execFileAsync(process.execPath, ['scripts/netlify_production_smoke.mjs'], {
    env: {
      ...process.env,
      CHARACTERFORGE_SITE_URL: origin,
      CHARACTERFORGE_EXPECTED_SHA: expectedSha,
      CHARACTERFORGE_SMOKE_ALLOW_HTTP: '1',
      ...overrides,
    },
  });
}

test('production smoke accepts exact artifact, headers, and database health', async () => {
  mode = 'ok';
  const { stdout } = await smoke();
  const result = JSON.parse(stdout);
  assert.equal(result.ok, true);
  assert.equal(result.commit, expectedSha);
  assert.equal(result.database, 'reachable');
  assert.equal(result.schema, 1);
});

test('production smoke rejects wrong deployed SHA', async () => {
  mode = 'wrong-sha';
  await assert.rejects(smoke(), /deployed commit mismatch/);
});

test('production smoke rejects unhealthy database path', async () => {
  mode = 'bad-health';
  await assert.rejects(smoke(), /\/api\/health returned HTTP 503/);
});

test('production smoke rejects missing security headers', async () => {
  mode = 'missing-header';
  await assert.rejects(smoke(), /x-frame-options missing or invalid/);
});

test('production smoke refuses implicit or malformed targets', async () => {
  mode = 'ok';
  await assert.rejects(execFileAsync(process.execPath, ['scripts/netlify_production_smoke.mjs'], {
    env: { ...process.env, CHARACTERFORGE_EXPECTED_SHA: expectedSha },
  }), /CHARACTERFORGE_SITE_URL is required/);
  await assert.rejects(smoke({ CHARACTERFORGE_EXPECTED_SHA: 'short' }), /full 40-character Git SHA/);
  await assert.rejects(smoke({ CHARACTERFORGE_SITE_URL: 'http://example.com' }), /HTTP smoke is allowed only for localhost tests/);
});

test('manual production smoke workflow is verification-only and cannot deploy', async () => {
  const workflow = await readFile('.github/workflows/netlify-production-smoke.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /site_url:/);
  assert.match(workflow, /expected_sha:/);
  assert.match(workflow, /npm run smoke:netlify/);
  for (const forbidden of [
    'netlify deploy',
    'netlify-cli',
    'NETLIFY_AUTH_TOKEN',
    'NETLIFY_SITE_ID',
    'deploy --prod',
    'production-deploy',
  ]) {
    assert.equal(workflow.toLowerCase().includes(forbidden.toLowerCase()), false, `workflow must not contain ${forbidden}`);
  }
});
