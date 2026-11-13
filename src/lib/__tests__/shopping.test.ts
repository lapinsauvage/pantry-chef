/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { groupShopping, type ShoppingItem, shoppingText } from '../shopping.ts';

const item = (id: number, text: string, ingredient_id: number | null, checked = 0, created_at = id): ShoppingItem => ({
  id, text, ingredient_id, recipe_id: null, checked, created_at,
});
const categories: Record<number, string> = { 1: 'produce', 2: 'dairy_eggs', 3: 'canned_jarred', 4: 'produce' };
const categoryOf = (i: ShoppingItem) => (i.ingredient_id != null ? categories[i.ingredient_id] : undefined);

test('grouped in aisle order, free text in "other", to-buy before checked', () => {
  const items = [item(1, 'soy sauce', 3), item(2, 'garlic', 1, 1), item(3, 'batteries', null), item(4, 'milk', 2), item(5, 'onion', 4)];
  const groups = groupShopping(items, categoryOf);
  assert.deepEqual(groups.map((g) => g.category), ['produce', 'dairy_eggs', 'canned_jarred', 'other']);
  assert.deepEqual(groups[0].items.map((i) => i.text), ['onion', 'garlic']);
  assert.deepEqual(groups[3].items.map((i) => i.text), ['batteries']);
});

test('unknown category falls back to other', () => {
  assert.equal(groupShopping([item(1, 'x', 99)], () => 'not-a-category')[0].category, 'other');
});

test('share text lists what is left to buy', () => {
  const groups = groupShopping([item(1, 'onion', 1), item(2, 'garlic', 4, 1), item(3, 'milk', 2)], categoryOf);
  const labels: Record<string, string> = { produce: 'Fruit & vegetables', dairy_eggs: 'Dairy & eggs' };
  assert.equal(shoppingText(groups, 'Shopping list', (c) => labels[c]), 'Shopping list\n\nFruit & vegetables\n• onion\n\nDairy & eggs\n• milk');
  assert.equal(shoppingText(groupShopping([item(1, 'onion', 1, 1)], categoryOf), 'List', (c) => c), 'List');
});
