import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve(process.env.CHARACTERFORGE_BUILD_INFO_PATH || 'site/build-info.json');
const commit = process.env.COMMIT_REF || process.env.GITHUB_SHA || 'local';

const info = {
  commit,
  branch: process.env.BRANCH || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local',
  context: process.env.CONTEXT || 'local',
  deploy_id: process.env.DEPLOY_ID || null,
  build_id: process.env.BUILD_ID || null,
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(info, null, 2)}\n`, 'utf8');
