import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ingredientRaw, textKey, type TextKind } from '../../../data-pipeline/scripts/text-key.ts';

// Same fixture as data-pipeline/tests/test_machine_translation.py: both languages must agree.
const cases = JSON.parse(
  readFileSync(new URL('../../../data-pipeline/tests/fixtures/text_keys.json', import.meta.url), 'utf8'),
) as { kind: TextKind; raw: string; key: string }[];

test('translation memory keys match the Python pipeline', () => {
  assert.ok(cases.length >= 5);
  for (const c of cases) assert.equal(textKey(c.kind, c.raw), c.key);
});

test('ingredient raw string joins text and note with NUL', () => {
  assert.equal(ingredientRaw('butter', 'softened'), 'butter\u0000softened');
  assert.equal(ingredientRaw('flour', null), 'flour\u0000');
});
