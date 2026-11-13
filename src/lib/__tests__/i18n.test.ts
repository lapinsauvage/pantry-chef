/// <reference types="node" />
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { en } from '../../i18n/en.ts';
import { fr } from '../../i18n/fr.ts';

type Tree = { [key: string]: unknown };

/** Every leaf as [path, value]. */
function leaves(tree: Tree, prefix = ''): [string, unknown][] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v as Tree, `${prefix}${k}.`) : [[`${prefix}${k}`, v] as [string, unknown]],
  );
}

/** Call a translation function with plausible arguments for its parameters. */
function render(fn: (...args: never[]) => unknown): unknown {
  return (fn as (...args: unknown[]) => unknown)(...Array.from({ length: fn.length }, (_, i) => (i === 0 ? 2 : 4)));
}

test('French has exactly the same keys and kinds of values as English', () => {
  const enLeaves = new Map(leaves(en as unknown as Tree));
  const frLeaves = new Map(leaves(fr as unknown as Tree));
  assert.deepEqual([...frLeaves.keys()].sort(), [...enLeaves.keys()].sort());
  for (const [path, value] of enLeaves) {
    assert.equal(typeof frLeaves.get(path), typeof value, path);
  }
});

test('no empty strings; functions return text', () => {
  for (const dict of [en, fr]) {
    for (const [path, value] of leaves(dict as unknown as Tree)) {
      const text = typeof value === 'function' ? render(value as (...args: never[]) => unknown) : value;
      assert.equal(typeof text, 'string', path);
      assert.ok((text as string).trim().length > 0, path);
      assert.ok(!(text as string).includes('undefined'), path);
    }
  }
});

test('plurals', () => {
  assert.equal(en.recipe.servings(1), '1 serving');
  assert.equal(en.recipe.servings(4), '4 servings');
  assert.equal(fr.recipe.servings(1), '1 portion');
  assert.equal(fr.recipe.servings(6), '6 portions');
  assert.equal(fr.cook.missingChoice(1), 'Jusqu’à 1 manquant');
  assert.equal(fr.cook.missingChoice(3), 'Jusqu’à 3 manquants');
  assert.equal(en.recipe.added(0), 'Already on your shopping list');
  assert.equal(fr.settings.basicsCount(0), 'Aucun');
});

test('French uses a no-break space before double punctuation', () => {
  for (const [path, value] of leaves(fr as unknown as Tree)) {
    if (typeof value !== 'string') continue;
    assert.ok(!/ [?!:;]/.test(value), `${path}: use \\u00a0 before ? ! : ;`);
  }
});
