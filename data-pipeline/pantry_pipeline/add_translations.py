"""Fill the French columns of a recipes.db from a translation memory (docs/TRANSLATOR.md).

  python -m pantry_pipeline.add_translations --db recipes.db --memory translations-fr.jsonl.gz

recipes.name_fr       French name (NULL when not translated)
recipes.steps_fr      JSON array, same length as steps; null for a step without a usable translation
recipes.ingredients_fr JSON array, same length as ingredients; French "text, note" or null
recipe_fts_fr         contentless FTS5 index of name_fr (no English stemmer)
All three columns are NULL when nothing of the recipe is translated.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys

from .machine_translation import ingredient_raw, read_memory, text_key, usable

FR_COLUMNS = ("name_fr", "steps_fr", "ingredients_fr")


def ensure_schema(db: sqlite3.Connection) -> None:
    """Add the French columns and index to a database built before schema 2."""
    have = {r[1] for r in db.execute("PRAGMA table_info(recipes)")}
    for col in FR_COLUMNS:
        if col not in have:
            db.execute(f"ALTER TABLE recipes ADD COLUMN {col} TEXT")
    db.execute("""CREATE VIRTUAL TABLE IF NOT EXISTS recipe_fts_fr USING fts5(
        name_fr, content='', tokenize='unicode61 remove_diacritics 2')""")


def _tuple_text(t: list, i: int) -> str | None:
    return t[i] if len(t) > i else None


def apply(db: sqlite3.Connection, memory: dict[str, dict]) -> dict:
    """Write the French texts of every recipe found in the memory; returns counts."""
    ensure_schema(db)
    updates, fts = [], []
    stats = {"recipes": 0, "translated": 0, "complete": 0}
    for rid, name, steps_json, ings_json in db.execute(
            "SELECT id, name, steps, ingredients FROM recipes").fetchall():
        stats["recipes"] += 1
        name_fr = usable(memory.get(text_key("name", name)))
        steps = json.loads(steps_json)
        steps_fr = [usable(memory.get(text_key("step", s))) for s in steps]
        lines = json.loads(ings_json)
        ings_fr = [usable(memory.get(text_key("ingredient", ingredient_raw(_tuple_text(t, 5), _tuple_text(t, 6)))))
                   if _tuple_text(t, 5) else None for t in lines]
        if name_fr is None and not any(steps_fr) and not any(ings_fr):
            updates.append((None, None, None, rid))
            continue
        stats["translated"] += 1
        if name_fr and all(steps_fr) and all(x for t, x in zip(lines, ings_fr) if _tuple_text(t, 5)):
            stats["complete"] += 1
        updates.append((name_fr,
                        json.dumps(steps_fr, ensure_ascii=False, separators=(",", ":")),
                        json.dumps(ings_fr, ensure_ascii=False, separators=(",", ":")), rid))
        if name_fr:
            fts.append((rid, name_fr))
    db.executemany("UPDATE recipes SET name_fr = ?, steps_fr = ?, ingredients_fr = ? WHERE id = ?", updates)
    db.execute("INSERT INTO recipe_fts_fr(recipe_fts_fr) VALUES ('delete-all')")
    db.executemany("INSERT INTO recipe_fts_fr(rowid, name_fr) VALUES (?, ?)", fts)
    db.execute("INSERT INTO recipe_fts_fr(recipe_fts_fr) VALUES ('optimize')")
    has_meta = db.execute("SELECT 1 FROM sqlite_master WHERE name = 'meta'").fetchone()
    if has_meta:
        db.executemany("INSERT OR REPLACE INTO meta VALUES (?, ?)",
                       [("translations_fr", str(stats["translated"])), ("schema_version", "2")])
    return stats


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", required=True)
    ap.add_argument("--memory", required=True)
    a = ap.parse_args(argv)
    db = sqlite3.connect(a.db)
    stats = apply(db, read_memory(a.memory))
    db.commit()
    db.execute("VACUUM")
    db.close()
    print(json.dumps(stats))


if __name__ == "__main__":
    sys.exit(main())
