/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { AVOID, EQUIPMENT } from '../constants.ts';
import {
  countBits,
  DEFAULT_SETTINGS,
  hasBit,
  maskOf,
  parseSettings,
  resolveLanguage,
  serializeSettings,
  toggleBit,
} from '../settings.ts';

test('default appliances are oven, stovetop and microwave', () => {
  assert.equal(DEFAULT_SETTINGS.equipment, 1 | 2 | 4);
  assert.equal(maskOf(EQUIPMENT, ['oven', 'stovetop', 'microwave']), DEFAULT_SETTINGS.equipment);
  assert.equal(maskOf(EQUIPMENT, ['oven', 'not-an-appliance']), 1);
});

test('bit helpers', () => {
  const pork = AVOID.find((a) => a.key === 'pork')!.bit;
  let mask = 0;
  mask = toggleBit(mask, pork);
  assert.ok(hasBit(mask, pork));
  assert.equal(countBits(mask), 1);
  mask = toggleBit(mask, pork);
  assert.equal(mask, 0);
  assert.equal(countBits(1 | 2 | 1024), 3);
  assert.equal(countBits(0), 0);
});

test('empty user.db gives the defaults', () => {
  assert.deepEqual(parseSettings({}), DEFAULT_SETTINGS);
});

test('stored values are parsed, invalid ones fall back to defaults', () => {
  const s = parseSettings({ language: 'fr', units: 'us', equipment: '17', diet: '1', avoid: '512', onboarded: '1' });
  assert.deepEqual(s, { language: 'fr', units: 'us', equipment: 17, diet: 1, avoid: 512, onboarded: true });
  const bad = parseSettings({ language: 'nl', units: 'imperial', equipment: 'abc', diet: '-1', onboarded: 'yes' });
  assert.deepEqual(bad, DEFAULT_SETTINGS);
});

test('serialize only the changed fields, round-trips through parse', () => {
  assert.deepEqual(serializeSettings({ onboarded: true, equipment: 0 }), [
    ['equipment', '0'],
    ['onboarded', '1'],
  ]);
  const all = { language: 'en', units: 'metric', equipment: 3, diet: 5, avoid: 0, onboarded: false } as const;
  assert.deepEqual(parseSettings(Object.fromEntries(serializeSettings(all))), all);
});

test('language: explicit choice wins, system picks the first supported phone language', () => {
  assert.equal(resolveLanguage('fr', ['en-US']), 'fr');
  assert.equal(resolveLanguage('en', ['fr-BE']), 'en');
  assert.equal(resolveLanguage('system', ['fr-BE', 'en-GB']), 'fr');
  assert.equal(resolveLanguage('system', ['nl-BE', 'fr-BE']), 'fr');
  assert.equal(resolveLanguage('system', ['FR']), 'fr');
  assert.equal(resolveLanguage('system', ['de-DE', 'nl-NL']), 'en');
  assert.equal(resolveLanguage('system', [null, 'en']), 'en');
  assert.equal(resolveLanguage('system', []), 'en');
});
