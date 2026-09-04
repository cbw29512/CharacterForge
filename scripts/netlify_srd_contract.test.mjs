import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ALL_SKILLS,
  SRD_ALIGNMENTS,
  SRD_BACKGROUNDS,
  SRD_CLASSES,
  SRD_RACES,
  abilityModifier,
  featuresThroughLevel,
  getBackground,
  getClass,
  getRace,
  proficiencyBonus,
} from '../netlify/lib/srd.mts';

test('portable SRD catalog exposes the same cardinality and representative data', () => {
  assert.equal(SRD_RACES.length, 14);
  assert.equal(SRD_CLASSES.length, 12);
  assert.equal(SRD_BACKGROUNDS.length, 13);
  assert.equal(SRD_ALIGNMENTS.length, 9);
  assert.equal(ALL_SKILLS.length, 18);

  assert.equal(getRace('Elf (Wood)').speed, 35);
  assert.deepEqual(getRace('Half-Orc').ability_bonuses, { strength: 2, constitution: 1 });
  assert.equal(getClass('Fighter').hit_die, 'd10');
  assert.deepEqual(getClass('Wizard').saving_throws, ['Intelligence', 'Wisdom']);
  assert.deepEqual(getBackground('Soldier').skill_proficiencies, ['Athletics', 'Intimidation']);
  assert.equal(getRace('Not A Race'), null);
  assert.equal(getClass('Not A Class'), null);
  assert.equal(getBackground('Not A Background'), null);
});

test('ability and proficiency math matches the Python contract', () => {
  assert.deepEqual([1, 8, 9, 10, 11, 20, 30].map(abilityModifier), [-5, -1, -1, 0, 0, 5, 10]);
  assert.deepEqual([1, 4, 5, 8, 9, 12, 13, 16, 17, 20].map(proficiencyBonus), [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  assert.equal(proficiencyBonus(30), 2);
});

test('class features accumulate exactly through capped level 20', () => {
  assert.deepEqual(featuresThroughLevel(getClass('Fighter'), 1), ['Fighting Style', 'Second Wind']);
  assert.deepEqual(featuresThroughLevel(getClass('Fighter'), 2), ['Fighting Style', 'Second Wind', 'Action Surge (one use)']);
  assert.deepEqual(featuresThroughLevel(getClass('Fighter'), 30), ['Fighting Style', 'Second Wind', 'Action Surge (one use)']);
});
