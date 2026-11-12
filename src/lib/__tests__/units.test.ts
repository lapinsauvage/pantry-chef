/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  convertQuantity,
  fToC,
  formatFraction,
  formatIngredient,
  metricizeText,
  parseIngredientTuple,
  scaleFactor,
} from '../units.ts';

test('fractions', () => {
  assert.equal(formatFraction(1.5), '1½');
  assert.equal(formatFraction(0.3333), '⅓');
  assert.equal(formatFraction(2), '2');
  assert.equal(formatFraction(0.125), '⅛');
  assert.equal(formatFraction(2.98), '3');
});

test('cups to ml, and to grams for baking ingredients', () => {
  assert.deepEqual(convertQuantity({ qmin: 1, qmax: null, unit: 'cup' }, 'metric').unit, 'ml');
  const flour = convertQuantity({ qmin: 2, qmax: null, unit: 'cup' }, 'metric', 'flour');
  assert.equal(flour.unit, 'g');
  assert.equal(flour.qmin, 250);
  const water = convertQuantity({ qmin: 6, qmax: null, unit: 'cup' }, 'metric', 'water');
  assert.equal(water.unit, 'l');
});

test('spoons stay spoons in metric mode', () => {
  assert.deepEqual(convertQuantity({ qmin: 2, qmax: null, unit: 'tbsp' }, 'metric'), { qmin: 2, qmax: null, unit: 'tbsp' });
});

test('format full lines', () => {
  const tomatoes = parseIngredientTuple([1, null, 'can', 14, 'oz', 'diced tomatoes', 'briefly drained', 57]);
  assert.deepEqual(formatIngredient(tomatoes), { quantity: '1 (395 g) can', text: 'diced tomatoes', note: 'briefly drained' });
  assert.equal(formatIngredient(tomatoes, { system: 'us' }).quantity, '1 (14 oz) can');

  const butter = parseIngredientTuple([0.75, null, 'cup', null, null, 'butter']);
  assert.equal(formatIngredient(butter, { ingredient: 'butter' }).quantity, '170 g');
  assert.equal(formatIngredient(butter, { system: 'us' }).quantity, '¾ cup');

  const garlic = parseIngredientTuple([1, 2, 'clove', null, null, 'garlic', 'minced']);
  assert.equal(formatIngredient(garlic).quantity, '1–2 cloves');
  assert.equal(formatIngredient(garlic, { factor: 2 }).quantity, '2–4 cloves');

  const salt = parseIngredientTuple([null, null, null, null, null, 'salt', 'to taste']);
  assert.deepEqual(formatIngredient(salt), { quantity: '', text: 'salt', note: 'to taste' });

  const beef = parseIngredientTuple([1.5, null, 'lb', null, null, 'ground beef']);
  assert.equal(formatIngredient(beef).quantity, '680 g');
  assert.equal(formatIngredient(beef, { factor: 2 }).quantity, '1.36 kg');
  assert.equal(formatIngredient(beef, { factor: 2, lang: 'fr' }).quantity, '1,36 kg');
});

test('oven temperatures and pan sizes in steps', () => {
  assert.equal(fToC(350), 175);
  assert.equal(metricizeText('Preheat oven to 350°F.'), 'Preheat oven to 175°C.');
  assert.equal(metricizeText('Preheat oven to 275°F (135C).'), 'Preheat oven to 135°C.');
  assert.equal(metricizeText('Bake at 325-350 degrees for 1 hour.'), 'Bake at 165–175°C for 1 hour.');
  assert.equal(metricizeText('Heat oven to 400 F'), 'Heat oven to 205°C');
  assert.equal(metricizeText('Grease a 9x13-inch pan.'), 'Grease a 23 x 33 cm pan.');
  assert.equal(metricizeText('Use an 8 inch skillet.'), 'Use an 20 cm skillet.');
  assert.equal(metricizeText('Cook 2 minutes; serves 100 people.'), 'Cook 2 minutes; serves 100 people.');
  assert.equal(metricizeText('Preheat oven to 350°F.', 'us'), 'Preheat oven to 350°F.');
});

test('scale factor', () => {
  assert.equal(scaleFactor(4, 6), 1.5);
  assert.equal(scaleFactor(null, 6), 1);
});
