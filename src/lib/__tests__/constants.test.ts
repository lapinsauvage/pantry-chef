/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { IMAGE_PREFIX, imageUrl, sourceUrl, THUMB_PREFIX } from '../constants.ts';

test('photo URLs: full size and 300 px thumbnails', () => {
  assert.equal(imageUrl('45/80/9/a.jpg'), `${IMAGE_PREFIX}45/80/9/a.jpg`);
  assert.equal(
    imageUrl('45/80/9/a.jpg', 'thumb'),
    'https://img.sndimg.com/food/image/upload/w_300,h_300,c_fill,q_80/v1/img/recipes/45/80/9/a.jpg',
  );
  assert.notEqual(THUMB_PREFIX, IMAGE_PREFIX);
  assert.equal(imageUrl('!https://example.org/p.jpg', 'thumb'), 'https://example.org/p.jpg');
  assert.equal(imageUrl(null), null);
});

test('Food.com attribution link', () => {
  assert.equal(sourceUrl('bourbon-chicken', 45809), 'https://www.food.com/recipe/bourbon-chicken-45809');
});
