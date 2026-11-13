/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { MEAL_COURSES } from '../constants.ts';
import {
  clampServings,
  cookFilters,
  DEFAULT_COOK_OPTIONS,
  hasOverrides,
  lineStatus,
  missingIds,
  queryKey,
} from '../cook.ts';

const settings = { equipment: 1 | 2 | 4, diet: 1, avoid: 512 };

test('default Cook filters: meals, any time, kitchen from settings', () => {
  assert.deepEqual(cookFilters(DEFAULT_COOK_OPTIONS, settings), {
    courses: MEAL_COURSES,
    maxMinutes: null,
    equipmentAvailable: 7,
    dietMask: 1,
    avoidMask: 512,
  });
});

test('course group, time and filter-sheet overrides', () => {
  const f = cookFilters({ ...DEFAULT_COOK_OPTIONS, courseGroup: 'desserts', maxMinutes: 30, equipment: 2, diet: 0 }, settings);
  assert.deepEqual(f, { courses: ['dessert'], maxMinutes: 30, equipmentAvailable: 2, dietMask: 0, avoidMask: 512 });
});

test('overrides badge only when different from settings', () => {
  assert.equal(hasOverrides(DEFAULT_COOK_OPTIONS, settings), false);
  assert.equal(hasOverrides({ ...DEFAULT_COOK_OPTIONS, equipment: 7 }, settings), false);
  assert.equal(hasOverrides({ ...DEFAULT_COOK_OPTIONS, avoid: 0 }, settings), true);
});

test('query key ignores the order ingredients were picked in', () => {
  const f = cookFilters(DEFAULT_COOK_OPTIONS, settings);
  assert.equal(queryKey([3, 1], [9], DEFAULT_COOK_OPTIONS, f), queryKey([1, 3], [9], DEFAULT_COOK_OPTIONS, f));
  assert.notEqual(
    queryKey([1], [], DEFAULT_COOK_OPTIONS, f),
    queryKey([1], [], { ...DEFAULT_COOK_OPTIONS, maxMissing: 2 }, f),
  );
});

test('missing ingredients: distinct, in recipe order, minus owned and staples', () => {
  const owned = new Set([10, 11]);
  const staples = new Set([1, 2]);
  assert.deepEqual(missingIds([10, 1, 31, null, 12, 31, 2, 11], owned, staples), [31, 12]);
  assert.deepEqual(missingIds([], owned, staples), []);
});

test('ingredient line status', () => {
  const owned = new Set([10]);
  const staples = new Set([1]);
  assert.equal(lineStatus(10, owned, staples), 'owned');
  assert.equal(lineStatus(1, owned, staples), 'owned');
  assert.equal(lineStatus(5, owned, staples), 'missing');
  assert.equal(lineStatus(null, owned, staples), 'unknown');
});

test('servings stepper bounds', () => {
  assert.equal(clampServings(0), 1);
  assert.equal(clampServings(4.4), 4);
  assert.equal(clampServings(500), 99);
});
