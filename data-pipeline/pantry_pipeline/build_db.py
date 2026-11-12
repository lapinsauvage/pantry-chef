"""Build the app's offline recipe database (SQLite) from the Food.com datasets.

Sources (both are Food.com scrapes, recipe ids match):
  A. recipes.parquet               - Kaggle "irkaal/foodcom-recipes-and-reviews"
     (times, photos, category, keywords, rating, nutrition, instructions)
  B. recipes_w_search_terms.csv    - Kaggle "shuyangli94/foodcom-recipes-with-search-terms-and-tags"
     (full ingredient lines with units, clean ingredient names, 600+ tags)

Usage:
  python -m pantry_pipeline.build_db --parquet A --csv B --out recipes.db
"""
from __future__ import annotations

import argparse
import ast
import csv
import hashlib
import json
import math
import os
import re
import sqlite3
import sys
import time
import unicodedata
from collections import Counter, defaultdict

import pyarrow.parquet as pq

from . import classify, ingredients as ingr, quantities
from .translations import ingredient_fr

IMAGE_PREFIX = ("https://img.sndimg.com/food/image/upload/"
                "w_555,h_416,c_fit,fl_progressive,q_95/v1/img/recipes/")
SCHEMA_VERSION = 1

# Short keyword chips shown on recipe cards (Food.com keyword -> chip id)
CHIP_KEYWORDS = {
    "Easy": "easy", "Kid Friendly": "kid_friendly", "Weeknight": "weeknight",
    "Inexpensive": "budget", "For Large Groups": "crowd", "One Dish Meal": "one_pot",
    "Healthy": "healthy", "Spicy": "spicy", "Comfort Food": "comfort", "Freezer": "freezer",
    "Potluck": "potluck", "Christmas": "christmas", "Summer": "summer", "Winter": "winter",
    "Camping": "camping", "Beginner Cook": "beginner",
}

_WS = re.compile(r"\s+")


def _literal_list(s: str) -> list:
    if not s:
        return []
    try:
        v = ast.literal_eval(s)
        return list(v) if isinstance(v, (list, tuple, set)) else []
    except (ValueError, SyntaxError):
        return []


def _clean_text(s: str | None) -> str:
    if not s:
        return ""
    return _WS.sub(" ", s.replace("&amp;", "&").replace("&quot;", '"')).strip()


def load_parquet(path: str) -> dict[int, dict]:
    cols = ["RecipeId", "Name", "CookTime", "PrepTime", "TotalTime", "Description", "Images",
            "RecipeCategory", "Keywords", "AggregatedRating", "ReviewCount", "Calories",
            "FatContent", "CarbohydrateContent", "ProteinContent", "RecipeServings",
            "RecipeYield", "RecipeInstructions"]
    table = pq.read_table(path, columns=cols)
    out: dict[int, dict] = {}
    for batch in table.to_batches(max_chunksize=50_000):
        for row in batch.to_pylist():
            rid = row["RecipeId"]
            if rid is None:
                continue
            out[int(rid)] = row
    return out


def search_key(name: str, name_fr: str | None) -> str:
    """Lower-case, accent-free text used for the pantry picker's type-ahead (EN + FR)."""
    text = f"{name} {name_fr or ''}".lower().replace("œ", "oe").replace("æ", "ae")
    text = unicodedata.normalize("NFKD", text)
    return " ".join("".join(c for c in text if not unicodedata.combining(c)).split())


def _shorten(s: str, n: int) -> str | None:
    if not s:
        return None
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:.") + "…"


def bayes_score(rating: float | None, reviews: int | None) -> float:
    r = rating or 0.0
    n = reviews or 0
    prior, weight = 4.2, 5
    bayes = (r * n + prior * weight) / (n + weight)
    return round(bayes + 0.15 * math.log10(1 + n), 4)


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:80]


def match_lines(names: list[str], lines: list[str]) -> list[int | None]:
    """For each raw line, the index of the ingredient name it corresponds to."""
    if len(names) == len(lines):
        return list(range(len(lines)))
    result: list[int | None] = []
    used: set[int] = set()
    lowered = [n.lower() for n in names]
    for line in lines:
        l = line.lower()
        best = None
        for i, n in enumerate(lowered):
            if i in used or not n:
                continue
            if n in l and (best is None or len(n) > len(lowered[best])):
                best = i
        if best is not None:
            used.add(best)
        result.append(best)
    return result


def build(parquet_path: str, csv_path: str, out_path: str, min_reviews: int,
          min_rating: float, max_recipes: int | None, log=print) -> dict:
    t0 = time.time()
    log(f"loading {parquet_path} ...")
    pa = load_parquet(parquet_path)
    log(f"  {len(pa):,} recipes in parquet ({time.time() - t0:.0f}s)")

    csv.field_size_limit(sys.maxsize)
    candidates = []
    stats = Counter()
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            stats["csv_rows"] += 1
            rid = int(row["id"])
            p = pa.get(rid)
            if p is None:
                stats["skip_not_in_parquet"] += 1
                continue
            reviews = p["ReviewCount"] or 0
            rating = p["AggregatedRating"]
            if reviews < min_reviews or (rating or 0) < min_rating:
                stats["skip_quality"] += 1
                continue
            total = quantities.iso_minutes(p["TotalTime"])
            if total is None or total > 2880:
                stats["skip_time"] += 1
                continue
            steps = [_clean_text(s) for s in (p["RecipeInstructions"] or []) if _clean_text(s)]
            if not steps:
                steps = [_clean_text(s) for s in _literal_list(row["steps"]) if _clean_text(s)]
            try:
                raw_lines = [l for l in json.loads(row["ingredients_raw_str"]) if l and l.strip()]
            except json.JSONDecodeError:
                raw_lines = []
            names = _literal_list(row["ingredients"])
            if not steps or len(names) < 2 or not raw_lines:
                stats["skip_incomplete"] += 1
                continue
            candidates.append((bayes_score(rating, reviews), rid, row, p, total, steps,
                               raw_lines, names))
    candidates.sort(key=lambda c: -c[0])
    if max_recipes:
        candidates = candidates[:max_recipes]
    log(f"  {len(candidates):,} recipes selected ({dict(stats)})")

    # ---- ingredient vocabulary
    ing_counts: Counter = Counter()
    per_recipe_canon: dict[int, list[tuple[str, ...]]] = {}
    for _, rid, row, *_rest in candidates:
        names = _rest[-1]
        canon_lists = [ingr.canonicalize(n) for n in names]
        per_recipe_canon[rid] = canon_lists
        seen = {c for cl in canon_lists for c in cl}
        ing_counts.update(seen)
    vocab = sorted(ing_counts, key=lambda n: (-ing_counts[n], n))
    ing_id = {name: i + 1 for i, name in enumerate(vocab)}
    log(f"  {len(vocab):,} canonical ingredients")

    # ---- write database
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    if os.path.exists(out_path):
        os.remove(out_path)
    db = sqlite3.connect(out_path)
    db.executescript(f"""
        PRAGMA page_size = 4096;
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) WITHOUT ROWID;
        CREATE TABLE ingredients (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, name_fr TEXT,
            recipes INTEGER NOT NULL, category TEXT NOT NULL, avoid INTEGER NOT NULL,
            staple INTEGER NOT NULL, search TEXT NOT NULL);
        CREATE TABLE recipes (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT,
            total_min INTEGER, prep_min INTEGER, cook_min INTEGER, servings INTEGER,
            yield TEXT, rating REAL, reviews INTEGER, score REAL, image TEXT,
            course TEXT NOT NULL, cuisine TEXT NOT NULL, equipment INTEGER NOT NULL,
            diet INTEGER NOT NULL, avoid INTEGER NOT NULL, difficulty INTEGER NOT NULL,
            kcal REAL, protein REAL, carbs REAL, fat REAL, n_ing INTEGER NOT NULL,
            n_core INTEGER NOT NULL, chips TEXT NOT NULL, steps TEXT NOT NULL,
            ingredients TEXT NOT NULL);
        CREATE TABLE recipe_ingredients (
            ingredient_id INTEGER NOT NULL, recipe_id INTEGER NOT NULL,
            PRIMARY KEY (ingredient_id, recipe_id)) WITHOUT ROWID;
        CREATE VIRTUAL TABLE recipe_fts USING fts5(
            name, ingredients, tags, content='',
            tokenize='porter unicode61 remove_diacritics 2');
    """)
    avoid_by_name = {n: ingr.avoid_mask(n) for n in vocab}
    db.executemany(
        "INSERT INTO ingredients VALUES (?,?,?,?,?,?,?,?)",
        [(ing_id[n], n, ingredient_fr(n), ing_counts[n], ingr.category(n), avoid_by_name[n],
          1 if n in ingr.HARD_STAPLES else 0, search_key(n, ingredient_fr(n))) for n in vocab])

    rows, links, fts = [], [], []
    for score, rid, row, p, total, steps, raw_lines, names in candidates:
        canon_lists = per_recipe_canon[rid]
        canon_set = {c for cl in canon_lists for c in cl}
        core = sorted({ing_id[c] for c in canon_set if c not in ingr.HARD_STAPLES})
        avoid = 0
        for c in canon_set:
            avoid |= avoid_by_name[c]
        tags = set(_literal_list(row["tags"]))
        keywords = set(p["Keywords"] or [])
        mapping = match_lines(names, raw_lines)
        ing_json = []
        for line, idx in zip(raw_lines, mapping):
            q = quantities.parse_line(line)
            cid = None
            if idx is not None and canon_lists[idx]:
                cid = ing_id[canon_lists[idx][0]]
            item = [q["qmin"], q["qmax"], q["unit"], q["pkg_q"], q["pkg_u"],
                    q["text"], q["note"] or None, cid]
            while item and item[-1] is None:  # trailing nulls are implied
                item.pop()
            ing_json.append(item)
        img = (p["Images"] or [None])[0]
        if img and img.startswith(IMAGE_PREFIX):
            img = img[len(IMAGE_PREFIX):]
        elif img:
            img = "!" + img  # full URL marker
        desc = _clean_text(row["description"]) or ""
        if desc.startswith("Make and share this"):
            desc = ""
        chips = sorted({CHIP_KEYWORDS[k] for k in keywords if k in CHIP_KEYWORDS})
        name = _clean_text(p["Name"]) or _clean_text(row["name"])
        rows.append((
            rid, name, slugify(name), _shorten(desc, 280), total,
            quantities.iso_minutes(p["PrepTime"]), quantities.iso_minutes(p["CookTime"]),
            p["RecipeServings"] or (int(row["servings"]) if row["servings"].isdigit() else None),
            p["RecipeYield"], p["AggregatedRating"], p["ReviewCount"], score, img,
            classify.course(tags), classify.cuisine(tags),
            classify.equipment_mask(tags, keywords, steps),
            classify.diet_mask(avoid, ingr.AVOID_BITS, p["Calories"], p["CarbohydrateContent"],
                               p["ProteinContent"]),
            avoid, classify.difficulty(tags, len(steps), len(raw_lines), total),
            p["Calories"], p["ProteinContent"], p["CarbohydrateContent"], p["FatContent"],
            len(raw_lines), len(core), json.dumps(chips, separators=(",", ":")),
            json.dumps(steps, ensure_ascii=False, separators=(",", ":")),
            json.dumps(ing_json, ensure_ascii=False, separators=(",", ":")),
        ))
        links.extend((i, rid) for i in core)
        fts.append((rid, name, " ".join(sorted(canon_set)),
                    " ".join(sorted({k.lower() for k in keywords if k} |
                                    {classify.course(tags), classify.cuisine(tags)}))))
    db.executemany(f"INSERT INTO recipes VALUES ({','.join('?' * 28)})", rows)
    db.executemany("INSERT INTO recipe_ingredients VALUES (?,?)", links)
    db.executemany("INSERT INTO recipe_fts(rowid, name, ingredients, tags) VALUES (?,?,?,?)", fts)
    db.executescript("""
        CREATE INDEX recipes_score ON recipes(score DESC);
        CREATE INDEX recipes_course ON recipes(course, score DESC);
        CREATE INDEX recipes_cuisine ON recipes(cuisine, score DESC);
        CREATE INDEX recipes_time ON recipes(total_min);
        INSERT INTO recipe_fts(recipe_fts) VALUES ('optimize');
    """)
    meta = {
        "schema_version": SCHEMA_VERSION,
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "recipes": len(rows),
        "ingredients": len(vocab),
        "image_prefix": IMAGE_PREFIX,
        "min_reviews": min_reviews,
        "min_rating": min_rating,
        "source": "Food.com via Kaggle datasets irkaal/foodcom-recipes-and-reviews + "
                  "shuyangli94/foodcom-recipes-with-search-terms-and-tags (personal use)",
    }
    db.executemany("INSERT INTO meta VALUES (?,?)", [(k, str(v)) for k, v in meta.items()])
    db.commit()
    db.execute("VACUUM")
    db.execute("ANALYZE")
    db.commit()
    db.close()
    meta["bytes"] = os.path.getsize(out_path)
    with open(out_path, "rb") as f:
        meta["sha256"] = hashlib.sha256(f.read()).hexdigest()
    meta["seconds"] = round(time.time() - t0)
    log(json.dumps(meta, indent=2))
    return meta


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--parquet", required=True)
    ap.add_argument("--csv", required=True)
    ap.add_argument("--out", default="recipes.db")
    ap.add_argument("--min-reviews", type=int, default=3)
    ap.add_argument("--min-rating", type=float, default=4.0)
    ap.add_argument("--max-recipes", type=int, default=None)
    ap.add_argument("--meta-json", default=None, help="also write build stats here")
    a = ap.parse_args(argv)
    meta = build(a.parquet, a.csv, a.out, a.min_reviews, a.min_rating, a.max_recipes)
    if a.meta_json:
        with open(a.meta_json, "w") as f:
            json.dump(meta, f, indent=2)


if __name__ == "__main__":
    main()
