/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createStore } from '../store.ts';

test('loads lazily once, set and reload notify subscribers', () => {
  let source = 1;
  let loads = 0;
  const store = createStore(() => {
    loads++;
    return source;
  });
  assert.equal(loads, 0);
  assert.equal(store.get(), 1);
  assert.equal(store.get(), 1);
  assert.equal(loads, 1);

  let calls = 0;
  const unsubscribe = store.subscribe(() => calls++);
  store.set(5);
  assert.equal(store.get(), 5);
  source = 9;
  store.reload();
  assert.equal(store.get(), 9);
  assert.equal(calls, 2);

  unsubscribe();
  store.set(10);
  assert.equal(calls, 2);
});
