/**
 * Keys of the translation memory (docs/TRANSLATOR.md). Must give the same result as
 * text_key / ingredient_raw in data-pipeline/pantry_pipeline/machine_translation.py —
 * both are checked against data-pipeline/tests/fixtures/text_keys.json.
 */
import { createHash } from 'node:crypto';

export type TextKind = 'name' | 'step' | 'ingredient';

/** sha1 of kind + newline + the exact string stored in recipes.db. */
export function textKey(kind: TextKind, raw: string): string {
  return createHash('sha1').update(`${kind}\n${raw}`, 'utf8').digest('hex');
}

/** The raw string of an ingredient line: text NUL note (tuple fields 5 and 6). */
export function ingredientRaw(text: string | null | undefined, note: string | null | undefined): string {
  return `${text ?? ''}\u0000${note ?? ''}`;
}
