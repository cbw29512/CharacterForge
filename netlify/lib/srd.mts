import srd from '../../shared/srd-5.1.json' with { type: 'json' };

export const SRD_RACES = Object.freeze(srd.races);
export const SRD_CLASSES = Object.freeze(srd.classes);
export const SRD_BACKGROUNDS = Object.freeze(srd.backgrounds);
export const SRD_ALIGNMENTS = Object.freeze(srd.alignments);
export const ALL_SKILLS = Object.freeze(srd.skills);

export function getRace(name: string) {
  return SRD_RACES.find((value) => value.name === name) ?? null;
}

export function getClass(name: string) {
  return SRD_CLASSES.find((value) => value.name === name) ?? null;
}

export function getBackground(name: string) {
  return SRD_BACKGROUNDS.find((value) => value.name === name) ?? null;
}

export function proficiencyBonus(level: number) {
  return srd.proficiency_by_level[String(level)] ?? 2;
}

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function featuresThroughLevel(charClass: { features_by_level?: Record<string, string[]> }, level: number) {
  const features: string[] = [];
  for (let current = 1; current <= Math.min(level, 20); current += 1) {
    features.push(...(charClass.features_by_level?.[String(current)] ?? []));
  }
  return features;
}
