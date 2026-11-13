/**
 * Export the texts to translate from a recipes.db as JSONL, one unique text per line:
 *   {"key", "kind": "name" | "step" | "ingredient", "en", "score"}
 * `en` is metric English, converted like the app does (src/lib/units.ts metricizeText); cups and
 * spoons stay as written. Ingredient lines are "text, note" (quantities stay out: the app formats
 * and scales them). Lines come in recipe popularity order, so `score` is the best recipe using the text.
 *   node --experimental-strip-types data-pipeline/scripts/export_texts.ts <recipes.db> > texts.jsonl
 */
import { DatabaseSync } from 'node:sqlite';

import { type IngredientTuple, metricizeText } from '../../src/lib/units.ts';
import { ingredientRaw, type TextKind, textKey } from './text-key.ts';

const [dbPath] = process.argv.slice(2);
const db = new DatabaseSync(dbPath, { readOnly: true });
const rows = db.prepare('SELECT name, score, ingredients, steps FROM recipes ORDER BY score DESC').all() as {
  name: string;
  score: number;
  ingredients: string;
  steps: string;
}[];

const seen = new Set<string>();
const out: string[] = [];
const emit = (kind: TextKind, raw: string, en: string, score: number) => {
  const key = textKey(kind, raw);
  if (seen.has(key) || !en.trim()) return;
  seen.add(key);
  out.push(JSON.stringify({ key, kind, en, score }));
};

for (const r of rows) {
  emit('name', r.name, metricizeText(r.name), r.score);
  for (const t of JSON.parse(r.ingredients) as IngredientTuple[]) {
    const text = t[5] ?? '';
    const note = t[6] ?? '';
    if (!text) continue;
    const en = note ? `${metricizeText(text)}, ${metricizeText(note)}` : metricizeText(text);
    emit('ingredient', ingredientRaw(text, note), en, r.score);
  }
  for (const s of JSON.parse(r.steps) as string[]) emit('step', s, metricizeText(s), r.score);
}
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`${rows.length} recipes, ${out.length} unique texts\n`);
