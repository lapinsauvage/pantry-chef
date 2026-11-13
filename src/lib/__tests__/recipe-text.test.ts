/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { frenchTextsFit, hasFrenchTexts, lineFr, recipeTitle, shownSteps } from '../recipe-text.ts';

const recipe = {
  name: 'Easy Pie',
  name_fr: 'Tarte facile',
  steps: ['Bake at 350°F for 25 minutes.', 'Cool 1 hour.'],
  steps_fr: ['Cuire à 175 °C pendant 25 minutes.', null],
  ingredients_fr: ['farine', null],
};
const english = { ...recipe, name_fr: null, steps_fr: null, ingredients_fr: null };

test('French recipe texts are used in French + metric only', () => {
  assert.equal(frenchTextsFit('fr', 'metric'), true);
  assert.equal(frenchTextsFit('fr', 'us'), false);
  assert.equal(frenchTextsFit('en', 'metric'), false);
  assert.equal(recipeTitle(recipe, 'fr', 'metric'), 'Tarte facile');
  assert.equal(recipeTitle(recipe, 'fr', 'us'), 'Easy Pie');
  assert.equal(recipeTitle(recipe, 'en', 'metric'), 'Easy Pie');
  assert.equal(recipeTitle(english, 'fr', 'metric'), 'Easy Pie');
});

test('has French texts', () => {
  assert.equal(hasFrenchTexts(recipe), true);
  assert.equal(hasFrenchTexts(english), false);
  assert.equal(hasFrenchTexts({ name_fr: null, steps_fr: [null, 'Refroidir.'], ingredients_fr: null }), true);
});

test('steps: French where translated, else English converted to metric', () => {
  assert.deepEqual(shownSteps(recipe, true, 'metric', 'fr'), ['Cuire à 175 °C pendant 25 minutes.', 'Cool 1 hour.']);
  assert.deepEqual(shownSteps(recipe, false, 'metric', 'fr'), ['Bake at 175°C for 25 minutes.', 'Cool 1 hour.']);
  assert.deepEqual(shownSteps(recipe, false, 'us', 'en'), recipe.steps);
});

test('ingredient lines: French text only when shown in French', () => {
  assert.equal(lineFr(recipe, 0, true), 'farine');
  assert.equal(lineFr(recipe, 1, true), null);
  assert.equal(lineFr(recipe, 0, false), null);
  assert.equal(lineFr(english, 0, true), null);
});
