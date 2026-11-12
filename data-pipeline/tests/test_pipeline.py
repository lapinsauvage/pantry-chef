import json
from pathlib import Path

import pytest

from pantry_pipeline import classify
from pantry_pipeline.ingredients import AVOID_BITS, avoid_mask, canonicalize, category
from pantry_pipeline.quantities import iso_minutes, parse_line

VOCAB = Path(__file__).resolve().parents[1] / "pantry_pipeline" / "vocab" / "ingredients_fr.json"


@pytest.mark.parametrize("raw,expected", [
    ("boneless skinless chicken breasts", ("chicken breast",)),
    ("salt and pepper", ("salt", "black pepper")),
    ("salt %26 freshly ground black pepper", ("salt", "black pepper")),
    ("confectioners%27 sugar", ("powdered sugar",)),
    ("2% low-fat milk", ("milk",)),
    ("thyme leaves", ("thyme",)),
    ("bay leaves", ("bay leaf",)),
    ("green chilies", ("chili pepper",)),
    ("old bay seasoning", ("old bay seasoning",)),
    ("lean ground beef", ("ground beef",)),
    ("extra virgin olive oil", ("olive oil",)),
    ("tomatoes", ("tomato",)),
    ("cherry tomatoes", ("cherry tomatoes",)),
    ("eggplant", ("eggplant",)),
    ("hot dogs", ("hot dogs",)),
    ("cilantro or mint", ("cilantro",)),
    ("condensed cream of mushroom soup", ("cream of mushroom soup",)),
])
def test_canonicalize(raw, expected):
    assert canonicalize(raw) == expected


def _flags(name):
    m = avoid_mask(name)
    return {k for k, v in AVOID_BITS.items() if m & v}


@pytest.mark.parametrize("name,must,must_not", [
    ("peanut butter", {"peanut"}, {"dairy"}),
    ("butternut squash", set(), {"dairy", "tree_nuts"}),
    ("cream of tartar", set(), {"dairy"}),
    ("coconut milk", set(), {"dairy", "tree_nuts"}),
    ("eggplant", set(), {"egg"}),
    ("rice flour", set(), {"gluten"}),
    ("corn tortillas", set(), {"gluten"}),
    ("soy sauce", {"gluten", "soy"}, set()),
    ("worcestershire sauce", {"fish"}, set()),
    ("chicken broth", {"meat"}, set()),
    ("vegetable broth", set(), {"meat"}),
    ("nutmeg", set(), {"tree_nuts"}),
    ("red wine vinegar", set(), {"alcohol"}),
    ("white wine", {"alcohol"}, set()),
    ("ham", {"pork", "meat"}, set()),
    ("honeydew melon", set(), {"honey"}),
    ("mayonnaise", {"egg"}, set()),
    ("tahini", {"sesame"}, set()),
])
def test_avoid_flags(name, must, must_not):
    f = _flags(name)
    assert must <= f, f
    assert not (must_not & f), f


@pytest.mark.parametrize("name,cat", [
    ("onion", "produce"), ("cornstarch", "baking_sweets"), ("coconut milk", "canned_jarred"),
    ("egg noodles", "grains_bakery"), ("butter", "dairy_eggs"), ("bacon", "meat"),
    ("shrimp", "fish"), ("chicken broth", "canned_jarred"), ("basil", "spices_herbs"),
])
def test_category(name, cat):
    assert category(name) == cat


@pytest.mark.parametrize("line,qmin,qmax,unit,text,note", [
    ("4   cups    blueberries, fresh or frozen ", 4, None, "cup", "blueberries", "fresh or frozen"),
    ("1 -2   clove    garlic, minced ", 1, 2, "clove", "garlic", "minced"),
    ("2 1/2  cups    milk", 2.5, None, "cup", "milk", ""),
    ("1/4  teaspoon    salt", 0.25, None, "tsp", "salt", ""),
    ("1½ cups flour", 1.5, None, "cup", "flour", ""),
    ("1⁄4 teaspoon salt", 0.25, None, "tsp", "salt", ""),
    ("  salt", None, None, None, "salt", ""),
    ("  to taste    vanilla ice cream", None, None, None, "vanilla ice cream", "to taste"),
    ("4   stalks    celery (if small, or two large stalks)", 4, None, "stalk",
     "celery (if small, or two large stalks)", ""),
    ("2   medium    onions, finely chopped ", 2, None, None, "medium onions", "finely chopped"),
])
def test_parse_line(line, qmin, qmax, unit, text, note):
    q = parse_line(line)
    assert (q["qmin"], q["qmax"], q["unit"], q["text"], q["note"]) == (qmin, qmax, unit, text, note)


def test_parse_package():
    q = parse_line("1 (14   ounce) can   diced tomatoes, briefly drained ")
    assert (q["qmin"], q["unit"], q["pkg_q"], q["pkg_u"], q["text"]) == (1, "can", 14, "oz", "diced tomatoes")


@pytest.mark.parametrize("iso,mins", [("PT45M", 45), ("PT4H25M", 265), ("PT24H", 1440),
                                      ("P1DT2H", 1560), ("", None), (None, None), ("PT0S", None)])
def test_iso_minutes(iso, mins):
    assert iso_minutes(iso) == mins


def test_equipment():
    E = classify.EQUIPMENT_BITS
    m = classify.equipment_mask(set(), set(), ["Preheat oven to 350°F.", "Bake 30 minutes."])
    assert m == E["oven"]
    m = classify.equipment_mask(set(), set(), ["Heat oil in a dutch oven over medium heat."])
    assert m == E["stovetop"]
    m = classify.equipment_mask({"crock-pot-slow-cooker"}, set(), ["Cook on low 8 hours."])
    assert m & E["slow_cooker"]
    m = classify.equipment_mask(set(), set(), ["Mix and chill. No-bake and easy!"])
    assert m == 0
    m = classify.equipment_mask(set(), set(), ["Microwave on high 2 minutes, then blend until smooth in a blender."])
    assert m == E["microwave"] | E["blender"]


def test_course_and_cuisine():
    assert classify.course({"main-dish", "soups-stews"}) == "soup"
    assert classify.course({"desserts", "cakes"}) == "dessert"
    assert classify.course({"time-to-make"}) == "other"
    assert classify.cuisine({"asian", "thai"}) == "thai"
    assert classify.cuisine({"european", "italian"}) == "italian"


def test_diet_from_ingredients():
    A = AVOID_BITS
    D = classify.DIET_BITS
    m = classify.diet_mask(A["dairy"], A, 300, 10, 30)
    assert m & D["vegetarian"] and not m & D["vegan"] and not m & D["dairy_free"]
    assert m & D["low_carb"] and m & D["low_calorie"] and m & D["high_protein"]
    m = classify.diet_mask(A["meat"], A, None, None, None)
    assert not m & D["vegetarian"]


def test_french_vocab_is_valid_json():
    data = json.loads(VOCAB.read_text(encoding="utf-8"))
    assert data["powdered sugar"] == "sucre impalpable"
    assert all(isinstance(v, str) and v for v in data.values())
