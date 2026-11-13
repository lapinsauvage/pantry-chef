"""Machine translation helpers and the French columns, with a fake translator (no model in CI)."""
import gzip
import json
import sqlite3
from pathlib import Path

from pantry_pipeline import add_translations as at
from pantry_pipeline import machine_translation as mt

FIXTURES = Path(__file__).with_name("fixtures")
G = mt.default_glossary()


class FakeTranslator:
    """Looks sentences up in a table; `beam4` answers replace them when beam >= 4."""
    model_id = "fake/en-fr"

    def __init__(self, table, beam4=None):
        self.table, self.beam4, self.calls = table, beam4 or {}, []

    def translate(self, sentences, beam):
        self.calls.append((list(sentences), beam))
        pick = self.beam4 if beam >= 4 else {}
        return [pick.get(s, self.table.get(s, f"<{s}>")) for s in sentences]


def test_keys_match_the_shared_fixture():
    for case in json.loads((FIXTURES / "text_keys.json").read_text(encoding="utf-8")):
        assert mt.text_key(case["kind"], case["raw"]) == case["key"]
    assert mt.ingredient_raw("butter", None) == "butter\u0000"


def test_glossary_loads_and_has_a_version():
    assert G.version >= 1 and G.pre and G.post


def test_prepare_names_caps_and_pre_rules():
    assert mt.prepare("name", "Best Ever Banana Bread", G) == "Best ever banana bread"
    assert mt.prepare("name", "Grandma's BBQ Ribs", G) == "Grandma's bbq ribs"
    assert mt.prepare("name", "Chicken and rice", G) == "Chicken and rice"  # already sentence case
    assert mt.prepare("step", "Cook on LOW for 8 hours.  ENJOY!", G) == "Cook on low for 8 hours. enjoy!"
    assert mt.prepare("step", "Put everything in a Crock-Pot.", G) == "Put everything in a slow cooker."


def test_finish_belgian_words_and_typography():
    en = "Mix the sour cream and brown sugar."
    assert mt.finish("step", en, "mélanger la crème sure et le sucre brun.", G) == \
        "Mélanger la crème aigre et la cassonade."
    assert mt.finish("ingredient", "light brown sugar", "sucre brun clair", G) == "cassonade blonde"
    assert mt.finish("step", "Melt in the skillet.", "Faire fondre dans le poêlon.", G) == "Faire fondre dans la poêle."
    assert mt.finish("ingredient", "butter, softened", "Beurre adouci", G) == "beurre ramolli"
    assert mt.finish("ingredient", "loaf pan", "miche de pain", G) == "moule à cake"
    assert mt.finish("ingredient", "loaf of bread", "miche de pain", G) == "miche de pain"  # rule needs "loaf pan"
    assert mt.finish("step", "Cook in a slow cooker.", "Cuire dans une casserole.", G) == "Cuire dans une mijoteuse."
    assert mt.finish("step", "Heat a saucepan.", "Chauffer une casserole.", G) == "Chauffer une casserole."
    assert mt.finish("step", "Add 2 tablespoons.", "Ajouter 2 cuillères à table.", G) == "Ajouter 2 cuillères à soupe."
    assert mt.finish("step", "Cut 2.5 cm pieces.", "Couper des morceaux de 2.5 cm.", G) == "Couper des morceaux de 2,5 cm."
    assert mt.finish("step", "Ready?", "Prêt?", G) == "Prêt ?"
    assert mt.finish("step", "Note: serve hot.", "Remarque : servir chaud.", G) == "Remarque : servir chaud."
    assert mt.finish("step", "Bake 1:30.", "Cuire 1:30.", G) == "Cuire 1:30."
    assert mt.finish("name", "Easy pie", "tarte facile", G) == "Tarte facile"


def test_check_flags_bad_output():
    assert mt.check("Bake 25 minutes at 180 °C.", "Cuire 25 minutes à 180 °C.") is None
    assert mt.check("Cut 2.5 cm pieces.", "Couper des morceaux de 2,5 cm.") is None
    assert mt.check("Bake 25 minutes.", "Cuire 35 minutes.") == "numbers"
    assert mt.check("Bake 25 minutes.", "") == "empty"
    assert mt.check("Stir the sauce well and serve it hot.", "Remuer.") == "length"
    assert mt.check("Stir well.", "remuer la sauce remuer la sauce remuer la sauce remuer la sauce") == "loop"
    assert mt.check("Add the eggs and stir with a spoon.", "Add the eggs and stir with a cuillère.") == "english"


def test_translate_items_sentences_retry_and_failures():
    table = {"Preheat the oven.": "Préchauffer le four.", "Bake 25 minutes.": "Cuire 35 minutes.",
             "butter, softened": "beurre adouci", "Best ever banana bread": "meilleur pain aux bananes"}
    beam4 = {"Bake 25 minutes.": "Cuire 25 minutes."}
    tr = FakeTranslator(table, beam4)
    items = [
        {"key": "a", "kind": "step", "en": "Preheat the oven. Bake 25 minutes."},
        {"key": "b", "kind": "ingredient", "en": "butter, softened"},
        {"key": "c", "kind": "name", "en": "Best Ever Banana Bread"},
        {"key": "d", "kind": "step", "en": "Chill 2 hours."},
    ]
    out = {e["key"]: e for e in mt.translate_items(items, tr, G)}
    assert out["a"]["fr"] == "Préchauffer le four. Cuire 25 minutes." and out["a"]["qa"] == "retried"
    assert out["b"]["fr"] == "beurre ramolli" and out["b"]["qa"] == "ok"
    assert out["c"]["fr"] == "Meilleur pain aux bananes" and out["c"]["src"] == "Best ever banana bread"
    assert "src" not in out["b"]
    assert tr.calls[0][1] == 2 and tr.calls[1][1] == 4
    bad = mt.translate_items([{"key": "x", "kind": "step", "en": "Bake 25 minutes."}],
                             FakeTranslator({"Bake 25 minutes.": "Cuire 35 minutes."}), G)[0]
    assert bad["qa"] == "failed:numbers" and mt.usable(bad) is None


def test_memory_roundtrip_and_plan(tmp_path):
    entry = {"key": "k1", "kind": "step", "en": "Mix.", "mt": "Mélanger.", "fr": "Mélanger.",
             "model": "fake/en-fr", "glossary": G.version, "qa": "ok"}
    path = tmp_path / "m.jsonl.gz"
    mt.write_memory(path, {"k1": entry})
    memory = mt.read_memory(path)
    assert memory == {"k1": entry}
    assert mt.read_memory(tmp_path / "missing.jsonl.gz") == {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        assert len(f.readlines()) == 1

    texts = [{"key": "k1", "kind": "step", "en": "Mix."}, {"key": "k2", "kind": "step", "en": "Stir."}]
    todo, refresh = mt.plan(texts, memory, G, "fake/en-fr")
    assert [t["key"] for t in todo] == ["k2"] and refresh == []
    todo, _ = mt.plan(texts, memory, G, "other/model")
    assert len(todo) == 2  # new model: everything again
    old = dict(entry, glossary=G.version - 1)
    todo, refresh = mt.plan(texts, {"k1": old}, G, "fake/en-fr")
    assert [t["key"] for t in todo] == ["k2"] and refresh == [old]
    assert mt.refinish(old, G)["glossary"] == G.version
    changed = dict(entry, en="Mix well.")  # metric conversion changed the English: translate again
    todo, _ = mt.plan(texts, {"k1": changed}, G, "fake/en-fr")
    assert len(todo) == 2


def _recipes_db():
    db = sqlite3.connect(":memory:")
    db.executescript("""
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE recipes (id INTEGER PRIMARY KEY, name TEXT, steps TEXT, ingredients TEXT);
    """)
    rows = [
        (1, "Easy Pie", ["Mix.", "Bake 25 minutes."], [[1, None, "cup", None, None, "flour"],
                                                        [2, None, "tbsp", None, None, "butter", "softened"]]),
        (2, "Plain Toast", ["Toast the bread."], [[1, None, None, None, None, "bread"]]),
    ]
    db.executemany("INSERT INTO recipes VALUES (?,?,?,?)",
                   [(i, n, json.dumps(s), json.dumps(ing)) for i, n, s, ing in rows])
    return db


def test_add_translations_fills_columns_and_french_index():
    def e(kind, raw, fr, qa="ok"):
        return {"key": mt.text_key(kind, raw), "kind": kind, "en": raw, "mt": fr, "fr": fr, "qa": qa}
    memory = {x["key"]: x for x in [
        e("name", "Easy Pie", "Tarte facile"),
        e("step", "Mix.", "Mélanger."),
        e("step", "Bake 25 minutes.", "Cuire 35 minutes.", qa="failed:numbers"),
        e("ingredient", mt.ingredient_raw("flour", None), "farine"),
        e("ingredient", mt.ingredient_raw("butter", "softened"), "beurre, ramolli"),
    ]}
    db = _recipes_db()
    stats = at.apply(db, memory)
    assert stats == {"recipes": 2, "translated": 1, "complete": 0}
    name_fr, steps_fr, ings_fr = db.execute(
        "SELECT name_fr, steps_fr, ingredients_fr FROM recipes WHERE id = 1").fetchone()
    assert name_fr == "Tarte facile"
    assert json.loads(steps_fr) == ["Mélanger.", None]  # failed check -> English kept
    assert json.loads(ings_fr) == ["farine", "beurre, ramolli"]
    assert db.execute("SELECT name_fr, steps_fr FROM recipes WHERE id = 2").fetchone() == (None, None)
    assert db.execute("SELECT rowid FROM recipe_fts_fr WHERE recipe_fts_fr MATCH 'tarte'").fetchall() == [(1,)]
    assert dict(db.execute("SELECT key, value FROM meta").fetchall()) == {"translations_fr": "1", "schema_version": "2"}
    at.apply(db, memory)  # running again replaces, no duplicates in the index
    assert db.execute("SELECT count(*) FROM recipe_fts_fr WHERE recipe_fts_fr MATCH 'tarte'").fetchone() == (1,)
