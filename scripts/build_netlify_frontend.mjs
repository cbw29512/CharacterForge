import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, '_site');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(resolve(root, 'site'), out, { recursive: true });
await cp(resolve(root, 'static'), resolve(out, 'static'), { recursive: true });
await mkdir(resolve(out, 'data'), { recursive: true });
await cp(resolve(root, 'shared', 'srd-5.1.json'), resolve(out, 'data', 'srd-5.1.json'));
