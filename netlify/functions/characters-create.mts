import type { Config } from '@netlify/functions';

import { canCreateInCampaign } from '../lib/character-access.mts';
import { requireCsrf, requireSession } from '../lib/guard.mts';
import { json, readJson } from '../lib/http.mts';
import { getPool } from '../lib/pg.mts';
import {
  SRD_ALIGNMENTS,
  abilityModifier,
  featuresThroughLevel,
  getBackground,
  getClass,
  getRace,
  proficiencyBonus,
} from '../lib/srd.mts';

function integer(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  return Math.max(minimum, Math.min(maximum, integer(value, fallback)));
}

function optionalInteger(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value));
  return Number.isInteger(parsed) ? parsed : null;
}

export default async function createCharacter(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });

  const auth = await requireSession(request);
  if (auth.response) return auth.response;
  const csrfError = requireCsrf(request, auth.session);
  if (csrfError) return csrfError;

  let body;
  try { body = await readJson(request); }
  catch { return json({ error: 'invalid_json' }, 400); }

  const campaignRaw = body?.campaign_id;
  const campaignId = campaignRaw === null || campaignRaw === undefined || campaignRaw === '' ? null : Number(campaignRaw);
  if (campaignId !== null && (!Number.isSafeInteger(campaignId) || campaignId <= 0)) return json({ error: 'invalid_campaign' }, 400);

  const isNpc = Boolean(body?.is_npc);
  if (isNpc && !['dm', 'admin'].includes(auth.session.role)) return json({ error: 'forbidden' }, 403);
  if (!(await canCreateInCampaign(auth.session, campaignId, isNpc))) return json({ error: 'forbidden' }, 403);

  const raceName = String(body?.race ?? 'Human');
  const className = String(body?.char_class ?? 'Fighter');
  const backgroundName = String(body?.background ?? 'Soldier');
  const alignment = String(body?.alignment ?? 'True Neutral');
  const race = getRace(raceName);
  const charClass = getClass(className);
  const background = getBackground(backgroundName);
  if (!race || !charClass || !background || !SRD_ALIGNMENTS.includes(alignment)) {
    return json({ error: 'invalid_srd_choice' }, 400);
  }

  const level = clamp(body?.level, 1, 30, 1);
  const strength = clamp(body?.strength, 1, 30, 10);
  const dexterity = clamp(body?.dexterity, 1, 30, 10);
  const constitution = clamp(body?.constitution, 1, 30, 10);
  const intelligence = clamp(body?.intelligence, 1, 30, 10);
  const wisdom = clamp(body?.wisdom, 1, 30, 10);
  const charisma = clamp(body?.charisma, 1, 30, 10);

  const hitDieValue = Number.parseInt(charClass.hit_die.slice(1), 10);
  const conMod = abilityModifier(constitution);
  const dexMod = abilityModifier(dexterity);
  const autoHp = Math.max(1, hitDieValue + conMod + (level - 1) * (Math.floor(hitDieValue / 2) + 1 + conMod));
  const hpOverride = optionalInteger(body?.hp_override);
  const acOverride = optionalInteger(body?.armor_class_override);
  const maxHp = Math.max(1, hpOverride ?? autoHp);
  const armorClass = Math.max(0, acOverride ?? (10 + dexMod));
  const speed = Math.max(0, integer(body?.speed, 30));
  const proficiency = proficiencyBonus(Math.min(level, 20));
  const name = String(body?.name ?? '').trim() || '(unnamed)';
  if (name.length > 200) return json({ error: 'invalid_input' }, 400);

  const traits = {
    personality: String(body?.personality_trait ?? ''),
    ideal: String(body?.ideal ?? ''),
    bond: String(body?.bond ?? ''),
    flaw: String(body?.flaw ?? ''),
  };
  const skills = Object.fromEntries(background.skill_proficiencies.map((skill) => [skill, true]));
  const saves = Object.fromEntries(charClass.saving_throws.map((save) => [save, true]));
  const features = featuresThroughLevel(charClass, level);

  try {
    const result = await getPool().query(
      `INSERT INTO characters (
         owner_id, campaign_id, is_npc, name, level, char_class, race, background, alignment,
         strength, dexterity, constitution, intelligence, wisdom, charisma,
         max_hp, current_hp, armor_class, speed, proficiency_bonus, hit_dice,
         skills, saving_throws, equipment, features, traits, notes, build_complete
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15,
         $16, $16, $17, $18, $19, $20,
         $21::jsonb, $22::jsonb, $23::jsonb, $24::jsonb, $25::jsonb, $26, TRUE
       )
       RETURNING id, owner_id, campaign_id, is_npc, name, level, char_class, race, background,
                 alignment, max_hp, current_hp, armor_class, speed, proficiency_bonus, hit_dice,
                 skills, saving_throws, equipment, features, traits, build_complete`,
      [
        auth.session.id, campaignId, isNpc, name, level, className, raceName, backgroundName, alignment,
        strength, dexterity, constitution, intelligence, wisdom, charisma,
        maxHp, armorClass, speed, proficiency, `${level}${charClass.hit_die}`,
        JSON.stringify(skills), JSON.stringify(saves), JSON.stringify(background.equipment),
        JSON.stringify(features), JSON.stringify(traits), String(body?.notes ?? ''),
      ],
    );
    return json({ ok: true, character: result.rows[0] }, 201);
  } catch (error) {
    console.error('CharacterForge character create failed', error instanceof Error ? error.name : 'unknown_error');
    return json({ error: 'service_unavailable' }, 503);
  }
}

export const config: Config = { path: '/api/characters/create' };
