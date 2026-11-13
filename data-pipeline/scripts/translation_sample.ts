/**
 * Export the N most popular recipes as the texts a French version would translate, already in
 * metric (same conversion as the app: src/lib/units.ts) — for the translation test workflow.
 *   node --experimental-strip-types data-pipeline/scripts/translation_sample.ts <recipes.db> <N> > sample.json
 */
import { DatabaseSync } from 'node:sqlite';

import { metricizeText, parseIngredientTuple, type IngredientTuple } from '../../src/lib/units.ts';

const [dbPath, count = '200'] = process.argv.slice(2);
const db = new DatabaseSync(dbPath, { readOnly: true });
const rows = db
  .prepare('SELECT id, name, description, ingredients, steps FROM recipes ORDER BY score DESC LIMIT ?')
  .all(Number(count)) as { id: number; name: string; description: string | null; ingredients: string; steps: string }[];

const recipes = rows.map((r) => ({
  id: r.id,
  name: r.name,
  description: r.description ?? '',
  // Quantities stay out of the translation (the app formats and scales them); only "text, note".
  ingredients: (JSON.parse(r.ingredients) as IngredientTuple[]).map((t) => {
    const line = parseIngredientTuple(t);
    const text = metricizeText(line.text);
    return line.note ? `${text}, ${metricizeText(line.note)}` : text;
  }),
  steps: (JSON.parse(r.steps) as string[]).map((s) => metricizeText(s)),
}));
process.stdout.write(JSON.stringify({ recipes }, null, 1));
