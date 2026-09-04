const siteUrlRaw = process.env.CHARACTERFORGE_SITE_URL;
const expectedSha = process.env.CHARACTERFORGE_EXPECTED_SHA;
const allowHttp = process.env.CHARACTERFORGE_SMOKE_ALLOW_HTTP === '1';

function fail(message) {
  throw new Error(message);
}

if (!siteUrlRaw) fail('CHARACTERFORGE_SITE_URL is required');
if (!expectedSha) fail('CHARACTERFORGE_EXPECTED_SHA is required');
if (!/^[0-9a-f]{40}$/i.test(expectedSha)) fail('CHARACTERFORGE_EXPECTED_SHA must be a full 40-character Git SHA');

const site = new URL(siteUrlRaw);
if (site.username || site.password) fail('site URL must not contain credentials');
if (site.search || site.hash) fail('site URL must not contain query parameters or fragments');
if (site.protocol !== 'https:' && !(allowHttp && site.protocol === 'http:')) fail('site URL must use HTTPS');
if (site.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(site.hostname)) fail('HTTP smoke is allowed only for localhost tests');
site.pathname = site.pathname.replace(/\/+$/, '') || '/';

const timeoutMs = Number(process.env.CHARACTERFORGE_SMOKE_TIMEOUT_MS || 10000);
if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) fail('invalid smoke timeout');

function endpoint(path) {
  return new URL(path.replace(/^\//, ''), site.href.endsWith('/') ? site.href : `${site.href}/`);
}

async function request(path, options = {}) {
  const response = await fetch(endpoint(path), {
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
    ...options,
  });
  if (response.url && new URL(response.url).origin !== site.origin) fail(`${path} redirected off the configured site origin`);
  return response;
}

async function json(path) {
  const response = await request(path, { headers: { Accept: 'application/json' } });
  if (response.status !== 200) fail(`${path} returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.toLowerCase().includes('application/json')) fail(`${path} did not return JSON`);
  return { response, body: await response.json() };
}

function requireHeader(response, name, predicate, description) {
  const value = response.headers.get(name) || '';
  if (!predicate(value)) fail(`${name} missing or invalid: expected ${description}`);
}

const build = await json('/build-info.json');
if (build.body.commit !== expectedSha) fail(`deployed commit mismatch: expected ${expectedSha}, received ${build.body.commit || 'missing'}`);
if (!build.body.context || !build.body.branch) fail('build provenance is missing context or branch');

const root = await request('/');
if (root.status !== 200) fail(`/ returned HTTP ${root.status}`);
const rootText = await root.text();
if (!rootText.includes('CharacterForge')) fail('root page does not identify CharacterForge');
requireHeader(root, 'content-security-policy', (value) => value.includes("default-src 'self'") && value.includes("object-src 'none'") && value.includes("frame-ancestors 'none'"), 'restrictive CSP');
requireHeader(root, 'x-content-type-options', (value) => value.toLowerCase() === 'nosniff', 'nosniff');
requireHeader(root, 'x-frame-options', (value) => value.toUpperCase() === 'DENY', 'DENY');
requireHeader(root, 'permissions-policy', (value) => value.includes('camera=()') && value.includes('microphone=()'), 'camera and microphone disabled');

const health = await json('/api/health');
if (health.body.ok !== true || health.body.service !== 'characterforge' || health.body.database !== 'reachable' || health.body.schema !== 1) {
  fail(`health contract failed: ${JSON.stringify(health.body)}`);
}
requireHeader(health.response, 'cache-control', (value) => value.toLowerCase().includes('no-store'), 'no-store');
requireHeader(health.response, 'x-content-type-options', (value) => value.toLowerCase() === 'nosniff', 'nosniff');

console.log(JSON.stringify({
  ok: true,
  site: site.origin,
  commit: build.body.commit,
  branch: build.body.branch,
  context: build.body.context,
  database: health.body.database,
  schema: health.body.schema,
}, null, 2));
