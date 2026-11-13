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
  parseAmount,
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
  assert.equal(metricizeText('Use an 8 inch skillet.'), 'Use a 20 cm skillet.');
  assert.equal(metricizeText('Cook 2 minutes; serves 100 people.'), 'Cook 2 minutes; serves 100 people.');
  assert.equal(metricizeText('Preheat oven to 350°F.', 'us'), 'Preheat oven to 350°F.');
});

test('temperatures already in Celsius are left alone', () => {
  assert.equal(metricizeText('Preheat oven to 180°C.'), 'Preheat oven to 180°C.');
  assert.equal(metricizeText('Bake in slow oven for 20 minutes at 160°C.'), 'Bake in slow oven for 20 minutes at 160°C.');
  assert.equal(metricizeText('Heat to 200 degrees C, then 180º C.'), 'Heat to 200 degrees C, then 180º C.');
  assert.equal(metricizeText('Gas mark 6 (400F) or 200°C'), 'Gas mark 6 (205°C) or 200°C');
  assert.equal(metricizeText('Preheat oven to 180 degrees celcius.'), 'Preheat oven to 180 degrees celcius.');
  // Celsius given first: keep it, drop the Fahrenheit
  assert.equal(metricizeText('Set the oven to 190°C/375°F/Gas 5.'), 'Set the oven to 190°C/Gas 5.');
  assert.equal(metricizeText('Pre-heat oven to 200°C or 400°F.'), 'Pre-heat oven to 200°C.');
  assert.equal(
    metricizeText('Bake at 200°C/400°F for 10 minutes then reduce to 190°C/375°F.'),
    'Bake at 200°C for 10 minutes then reduce to 190°C.',
  );
  assert.equal(metricizeText('Bake at 325-350°F.'), 'Bake at 165–175°C.');
});

test('Celsius already given after the Fahrenheit value is not converted again', () => {
  assert.equal(metricizeText('Preheat oven to 350º / 180º.'), 'Preheat oven to 175°C.');
  assert.equal(metricizeText('Bake at 425F/220C for 20 min.'), 'Bake at 220°C for 20 min.');
  assert.equal(metricizeText('Heat to 400°F/200°C.'), 'Heat to 205°C.');
  assert.equal(metricizeText('Oven at 350F or 180C.'), 'Oven at 175°C.');
  assert.equal(metricizeText('Set to 275ºF/140ºC, then wait.'), 'Set to 135°C, then wait.');
  assert.equal(metricizeText('Bake at 350 degrees F or 180°C'), 'Bake at 175°C');
  assert.equal(metricizeText('Preheat oven to 350 degrees F (175 degrees C).'), 'Preheat oven to 175°C.');
  // a second Fahrenheit option is kept and converted
  assert.equal(metricizeText('Bake at 350°F or 400°F.'), 'Bake at 175°C or 205°C.');
});

test('scale factor', () => {
  assert.equal(scaleFactor(4, 6), 1.5);
  assert.equal(scaleFactor(null, 6), 1);
});

test('amounts as written in recipes', () => {
  assert.equal(parseAmount('1 1/2'), 1.5);
  assert.equal(parseAmount('1-1/2'), 1.5);
  assert.equal(parseAmount('3/4'), 0.75);
  assert.equal(parseAmount('1½'), 1.5);
  assert.equal(parseAmount('¼'), 0.25);
  assert.equal(parseAmount('2.5'), 2.5);
  assert.equal(parseAmount('1/0'), null);
  assert.equal(parseAmount('a few'), null);
});

test('inches in text, including fractions', () => {
  assert.equal(metricizeText('Cut into 1/2-inch pieces.'), 'Cut into 1.3 cm pieces.');
  assert.equal(metricizeText('sliced 1/4 inch thick'), 'sliced 6 mm thick');
  assert.equal(metricizeText('Roll to 1 1/2 inch thick.'), 'Roll to 4 cm thick.');
  assert.equal(metricizeText('Cut in 1-1/2" cubes'), 'Cut in 4 cm cubes');
  assert.equal(metricizeText('cut into 1 to 2 inch chunks'), 'cut into 2.5–5 cm chunks');
  assert.equal(metricizeText('Leave 2 inches between cookies.'), 'Leave 5 cm between cookies.');
  assert.equal(metricizeText('Use a 9 x 13 inch pan or a 9"x13" dish.'), 'Use a 23 x 33 cm pan or a 23 x 33 cm dish.');
  assert.equal(metricizeText('an 8 x 8 x 2-inch dish'), 'a 20 x 20 x 5 cm dish');
  assert.equal(metricizeText('Use a 7-inch pan. An 8-ounce block.'), 'Use an 18 cm pan. A 225 g block.');
  assert.equal(metricizeText('an 80 g bar'), 'an 80 g bar');
  assert.equal(metricizeText('He said "add 2 " later'), 'He said "add 2 " later');
});

test('weights and liquid volumes in text; cups and spoons stay', () => {
  assert.equal(metricizeText('Add one 8-ounce package of cream cheese.'), 'Add one 225 g package of cream cheese.');
  assert.equal(metricizeText('Stir in 1 (14 oz.) can tomatoes.'), 'Stir in 1 (395 g) can tomatoes.');
  assert.equal(metricizeText('Use 2 to 3 pounds of chicken.'), 'Use 0.91–1.36 kg of chicken.');
  assert.equal(metricizeText('about 1 1/2 lbs ground beef'), 'about 680 g ground beef');
  assert.equal(metricizeText('Into a 1 quart jar, pour 2 cups hot water.'), 'Into a 945 ml jar, pour 2 cups hot water.');
  assert.equal(metricizeText('Pour into each 12-ounce glass.'), 'Pour into each 355 ml glass.');
  assert.equal(metricizeText('Divide among six 6-ounce ramekins.'), 'Divide among six 175 ml ramekins.');
  assert.equal(metricizeText('Add 4 fl oz cream and 1 tbsp sugar.'), 'Add 120 ml cream and 1 tbsp sugar.');
  assert.equal(metricizeText('Makes 1 gallon.'), 'Makes 3.79 l.');
  assert.equal(metricizeText('Fold in remaining 2 cups of blueberries.'), 'Fold in remaining 2 cups of blueberries.');
  assert.equal(metricizeText('Add 1 1/2 lbs beef.', 'metric', 'fr'), 'Add 680 g beef.');
  assert.equal(metricizeText('Cut into 1/2-inch pieces.', 'metric', 'fr'), 'Cut into 1,3 cm pieces.');
  assert.equal(metricizeText('Add one 8-ounce package.', 'us'), 'Add one 8-ounce package.');
  // not amounts
  assert.equal(metricizeText('Bake for 1 hour; serves 4 people, 2 ways.'), 'Bake for 1 hour; serves 4 people, 2 ways.');
  assert.equal(metricizeText('Bake at 350 or until done'), 'Bake at 350 or until done');
});

test('ingredient name and note follow the unit system', () => {
  const bread = parseIngredientTuple([1, null, null, null, null, 'French baguette', 'sliced 1/4-1/2 inch thick']);
  assert.equal(formatIngredient(bread).note, 'sliced 0.6–1.3 cm thick');
  assert.equal(formatIngredient(bread, { system: 'us' }).note, 'sliced 1/4-1/2 inch thick');
  const onion = parseIngredientTuple([1, null, null, null, null, 'onion', 'chopped, about 1 cup']);
  assert.equal(formatIngredient(onion).note, 'chopped, about 1 cup');
});
