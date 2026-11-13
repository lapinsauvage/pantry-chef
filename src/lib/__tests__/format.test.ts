/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { formatDate, formatMinutes, formatNumber } from '../format.ts';

test('english number formatting', () => {
  assert.equal(formatNumber(106929, 'en'), '106,929');
  assert.equal(formatNumber(2500, 'en'), '2,500');
  assert.equal(formatNumber(999, 'en'), '999');
  assert.equal(formatNumber(1.25, 'en', 1), '1.3');
  assert.equal(formatNumber(-1234.5, 'en', 2), '-1,234.5');
});

test('french (Belgian) number formatting', () => {
  assert.equal(formatNumber(106929, 'fr'), '106 929');
  assert.equal(formatNumber(2500, 'fr'), '2 500');
  assert.equal(formatNumber(1.5, 'fr', 1), '1,5');
  assert.equal(formatNumber(0, 'fr'), '0');
  assert.equal(formatNumber(-0.01, 'fr'), '0');
});

test('dates are shown day first', () => {
  assert.equal(formatDate('2026-11-12T22:13:53Z'), '12/11/2026');
  assert.equal(formatDate('2026-01-05'), '05/01/2026');
  assert.equal(formatDate(undefined), '—');
  assert.equal(formatDate('soon'), '—');
});

test('cooking times', () => {
  assert.equal(formatMinutes(45, 'en'), '45 min');
  assert.equal(formatMinutes(60, 'en'), '1 h');
  assert.equal(formatMinutes(90, 'fr'), '1 h 30');
  assert.equal(formatMinutes(125, 'en'), '2 h 05');
  assert.equal(formatMinutes(1500, 'en'), '1 d 1 h');
  assert.equal(formatMinutes(2880, 'fr'), '2 j');
  assert.equal(formatMinutes(null, 'en'), '—');
  assert.equal(formatMinutes(0, 'en'), '—');
});
