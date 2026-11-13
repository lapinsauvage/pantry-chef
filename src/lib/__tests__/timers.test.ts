/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { formatDuration } from '../format.ts';
import { detectTimers, formatCountdown } from '../timers.ts';

const secs = (step: string) => detectTimers(step).map((t) => t.seconds);

test('minutes, hours, seconds as recipes write them', () => {
  assert.deepEqual(detectTimers('Bake 25 minutes or until golden.'), [{ text: '25 minutes', seconds: 1500 }]);
  assert.deepEqual(secs('Simmer for 1 hour.'), [3600]);
  assert.deepEqual(secs('Stir for 30 seconds.'), [30]);
  assert.deepEqual(secs('Cook 5 mins, then 2 min more.'), [300, 120]);
  assert.deepEqual(secs('Chill 2 hrs.'), [7200]);
  assert.deepEqual(secs('Cook about 5 more minutes.'), [300]);
  assert.deepEqual(secs('Bake 10 additional minutes.'), [600]);
});

test('ranges use the lower bound; text keeps the range', () => {
  assert.deepEqual(detectTimers('Bake 25-30 minutes.'), [{ text: '25-30 minutes', seconds: 1500 }]);
  assert.deepEqual(secs('Cook 2 to 3 minutes per side.'), [120]);
  assert.deepEqual(secs('Roast 1 - 1 1/2 hours.'), [3600]);
});

test('fractions, words and combined hours + minutes', () => {
  assert.deepEqual(secs('Bake 1 1/2 hours.'), [5400]);
  assert.deepEqual(secs('Rest 1/2 hour.'), [1800]);
  assert.deepEqual(secs('Let stand an hour.'), [3600]);
  assert.deepEqual(secs('Let rise half an hour.'), [1800]);
  assert.deepEqual(secs('Boil two minutes.'), [120]);
  assert.deepEqual(secs('Bake 1 hour 15 minutes.'), [4500]);
  assert.deepEqual(secs('Bake 1 hour and 30 minutes.'), [5400]);
});

test('not timers', () => {
  assert.deepEqual(secs('Marinate 2 days in the fridge.'), []);
  assert.deepEqual(secs('Serve with 2 cups rice.'), []);
  assert.deepEqual(secs('Makes 24 cookies; preheat to 175°C.'), []);
  assert.deepEqual(secs('Cut into 2-inch pieces.'), []);
  assert.deepEqual(secs('Cook about a minute.'), [60]);
});

test('duplicates are offered once', () => {
  assert.deepEqual(secs('Bake 10 minutes, turn, bake 10 minutes more.'), [600]);
});

test('countdown and labels', () => {
  assert.equal(formatCountdown(1500), '25:00');
  assert.equal(formatCountdown(9.2), '0:10');
  assert.equal(formatCountdown(3900), '1:05:00');
  assert.equal(formatCountdown(-3), '0:00');
  assert.equal(formatDuration(30, 'en'), '30 s');
  assert.equal(formatDuration(90, 'en'), '1 min 30 s');
  assert.equal(formatDuration(1500, 'en'), '25 min');
  assert.equal(formatDuration(5400, 'fr'), '1 h 30');
});
