import type { Config } from '@netlify/functions';

import { requireSession } from '../lib/guard.mts';
import { json } from '../lib/http.mts';
import {
  ALL_SKILLS,
  SRD_ALIGNMENTS,
  SRD_BACKGROUNDS,
  SRD_CLASSES,
  SRD_RACES,
} from '../lib/srd.mts';

export default async function srdCatalog(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  const auth = await requireSession(request);
  if (auth.response) return auth.response;

  return json({
    races: SRD_RACES,
    classes: SRD_CLASSES,
    backgrounds: SRD_BACKGROUNDS,
    alignments: SRD_ALIGNMENTS,
    skills: ALL_SKILLS,
  });
}

export const config: Config = { path: '/api/srd' };
