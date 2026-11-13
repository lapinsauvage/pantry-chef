/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  activeFilterCount,
  browseFilters,
  COLLECTIONS,
  DEFAULT_BROWSE_OPTIONS,
  effectiveSort,
  presetFor,
  sortChoices,
} from '../browse.ts';

const settings = { equipment: 1 | 2 | 4, diet: 0, avoid: 512 }; // oven, stovetop, microwave; no pork
const opts = DEFAULT_BROWSE_OPTIONS;

test('no preset, default sheet: Settings only', () => {
  assert.deepEqual(browseFilters(null, opts, settings), {
    equipmentAvailable: 7,
    dietMask: 0,
    avoidMask: 512,
    maxMinutes: null,
  });
});

test('collections', () => {
  const p = (key: string) => presetFor('collection', key);
  assert.equal(browseFilters(p('quick'), opts, settings).maxMinutes, 15);
  assert.equal(browseFilters(p('vegetarian'), opts, settings).dietMask, 1);
  assert.deepEqual(browseFilters(p('one_pot'), opts, settings).chips, ['one_pot']);
  assert.deepEqual(browseFilters(p('desserts'), opts, settings).courses, ['dessert']);
  // "No oven": oven removed from what's available
  assert.equal(browseFilters(p('no_oven'), opts, settings).equipmentAvailable, 2 | 4);
  // "Slow cooker": required, and therefore counted as available even if not in Settings
  const slow = browseFilters(p('slow_cooker'), opts, settings);
  assert.equal(slow.equipmentRequired, 16);
  assert.equal(slow.equipmentAvailable, 7 | 16);
  assert.equal(COLLECTIONS.length, 8);
});

test('presets from route params', () => {
  assert.deepEqual(presetFor('course', 'soup'), { courses: ['soup'] });
  assert.deepEqual(presetFor('cuisine', 'thai'), { cuisines: ['thai'] });
  assert.equal(presetFor('course', 'nope'), null);
  assert.equal(presetFor('collection', 'nope'), null);
  assert.equal(presetFor(undefined, undefined), null);
});

test('the filter sheet combines with presets (AND)', () => {
  const sheet = { ...opts, maxMinutes: 30, maxDifficulty: 1 as const, withImageOnly: true, diet: 4, avoid: 0 };
  const f = browseFilters(presetFor('collection', 'vegetarian'), sheet, settings);
  assert.equal(f.dietMask, 1 | 4); // vegetarian AND gluten-free
  assert.equal(f.avoidMask, 0); // sheet override of Settings
  assert.equal(f.maxDifficulty, 1);
  assert.equal(f.withImageOnly, true);
  // tighter time limit wins
  assert.equal(browseFilters(presetFor('collection', 'quick'), sheet, settings).maxMinutes, 15);
  assert.equal(browseFilters(presetFor('collection', 'quick'), { ...opts, maxMinutes: 45 }, settings).maxMinutes, 15);
});

test('cuisine preset and sheet cuisines intersect', () => {
  const thai = presetFor('cuisine', 'thai');
  assert.deepEqual(browseFilters(thai, opts, settings).cuisines, ['thai']);
  assert.deepEqual(browseFilters(thai, { ...opts, cuisines: ['thai', 'indian'] }, settings).cuisines, ['thai']);
  assert.deepEqual(browseFilters(thai, { ...opts, cuisines: ['indian'] }, settings).cuisines, ['__none__']);
  assert.deepEqual(browseFilters(null, { ...opts, cuisines: ['indian'] }, settings).cuisines, ['indian']);
});

test('sort: relevance only with search text', () => {
  assert.equal(effectiveSort('relevance', false), 'popular');
  assert.equal(effectiveSort('relevance', true), 'relevance');
  assert.equal(effectiveSort('quick', false), 'quick');
  assert.deepEqual(sortChoices(false), ['popular', 'quick', 'rating']);
  assert.deepEqual(sortChoices(true), ['relevance', 'popular', 'quick', 'rating']);
});

test('filters badge counts real changes only', () => {
  assert.equal(activeFilterCount(opts, settings), 0);
  assert.equal(activeFilterCount({ ...opts, equipment: 7, avoid: 512 }, settings), 0);
  assert.equal(activeFilterCount({ ...opts, maxMinutes: 30, cuisines: ['thai'], avoid: 0 }, settings), 3);
});
