import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('build metadata contains only explicit public deploy provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'characterforge-build-info-'));
  const output = join(dir, 'build-info.json');
  try {
    await execFileAsync(process.execPath, ['scripts/write_netlify_build_info.mjs'], {
      env: {
        ...process.env,
        CHARACTERFORGE_BUILD_INFO_PATH: output,
        COMMIT_REF: '0123456789abcdef0123456789abcdef01234567',
        BRANCH: 'release/test',
        CONTEXT: 'deploy-preview',
        DEPLOY_ID: 'deploy-fixture',
        BUILD_ID: 'build-fixture',
        SECRET_KEY: 'must-not-leak',
        NETLIFY_DB_URL: 'postgres://must-not-leak',
      },
    });

    const info = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(info, {
      commit: '0123456789abcdef0123456789abcdef01234567',
      branch: 'release/test',
      context: 'deploy-preview',
      deploy_id: 'deploy-fixture',
      build_id: 'build-fixture',
    });
    const serialized = JSON.stringify(info);
    assert.equal(serialized.includes('must-not-leak'), false);
    assert.equal(Object.keys(info).some((key) => /secret|token|password|database|url/i.test(key)), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('local build falls back to explicit non-production provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'characterforge-build-info-local-'));
  const output = join(dir, 'build-info.json');
  try {
    const env = { ...process.env, CHARACTERFORGE_BUILD_INFO_PATH: output };
    for (const key of ['COMMIT_REF', 'GITHUB_SHA', 'BRANCH', 'GITHUB_HEAD_REF', 'GITHUB_REF_NAME', 'CONTEXT', 'DEPLOY_ID', 'BUILD_ID']) delete env[key];
    await execFileAsync(process.execPath, ['scripts/write_netlify_build_info.mjs'], { env });
    const info = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(info.commit, 'local');
    assert.equal(info.branch, 'local');
    assert.equal(info.context, 'local');
    assert.equal(info.deploy_id, null);
    assert.equal(info.build_id, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
