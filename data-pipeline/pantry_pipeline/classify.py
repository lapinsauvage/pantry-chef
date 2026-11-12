"""Recipe-level classification: equipment, course, cuisine, diet, difficulty."""
from __future__ import annotations

import re

# Bit values are shared with the app (see shared/constants.json).
EQUIPMENT_BITS = {
    "oven": 1, "stovetop": 2, "microwave": 4, "air_fryer": 8, "slow_cooker": 16,
    "pressure_cooker": 32, "blender": 64, "mixer": 128, "grill": 256, "deep_fryer": 512,
    "bread_machine": 1024,
}

_TAG_EQUIP = {
    "oven": "oven", "stove-top": "stovetop", "microwave": "microwave",
    "crock-pot-slow-cooker": "slow_cooker", "pressure-cooker": "pressure_cooker",
    "food-processor-blender": "blender", "mixer": "mixer", "grilling": "grill",
    "barbecue": "grill", "smoker": "grill", "bread-machine": "bread_machine", "broil": "oven",
}
_KW_EQUIP = {
    "Oven": "oven", "Stove Top": "stovetop", "Microwave": "microwave", "Mixer": "mixer",
    "Broil/Grill": "grill", "Bread Machine": "bread_machine", "Stir Fry": "stovetop",
}

_TEXT_EQUIP = [
    ("oven", re.compile(r"\b(pre-?heat(?:ed)?\s+(?:the\s+)?oven|in (?:the|a|your) (?:pre-?heated\s+)?oven|"
                        r"oven to|\bbake[sd]?\b|\bbaking (?:dish|sheet|pan|tray)|broil(?:er|ing)?\b|"
                        r"\d{3}\s*(?:°|º|degrees?)\s*f?\b|roasting pan|cookie sheet|sheet pan|"
                        r"muffin (?:tin|cups|pan)|loaf pan|cake pan|pie plate)", re.I)),
    ("stovetop", re.compile(r"\b(skillet|saucepan|sauce pan|frying pan|fry pan|wok|stockpot|"
                            r"stock pot|dutch oven|griddle|double boiler|over (?:low|medium|high|"
                            r"medium-low|medium-high|moderate) heat|bring (?:it |the \w+ )?to (?:a|the) boil|"
                            r"simmer|saut[eé]|stir-?fry|on the stove|stovetop|stove top|"
                            r"large pot|heavy pot|soup pot|in a pot|deep-?fry|pan-?fry|sear)\w*", re.I)),
    ("microwave", re.compile(r"\bmicrowav", re.I)),
    ("air_fryer", re.compile(r"\bair[- ]?fryer\b", re.I)),
    ("slow_cooker", re.compile(r"\b(slow[- ]cooker|crock[- ]?pot)\b", re.I)),
    ("pressure_cooker", re.compile(r"\b(pressure[- ]cooker|instant[- ]?pot|instapot)\b", re.I)),
    ("blender", re.compile(r"\b(blender|food processor|immersion blender|stick blender|"
                           r"process until|pulse until|blend until)\b", re.I)),
    ("mixer", re.compile(r"\b(electric mixer|stand mixer|hand mixer|mixer)\b", re.I)),
    ("grill", re.compile(r"\b(pre-?heat (?:the |a |your )?grill|on (?:the|a) grill|grill rack|"
                         r"grill grate|charcoal|barbecue|bbq|over (?:hot )?coals|gas grill|"
                         r"grill (?:over|for|until|on))\b", re.I)),
    ("deep_fryer", re.compile(r"\bdeep[- ]?fryer\b", re.I)),
    ("bread_machine", re.compile(r"\bbread machine\b", re.I)),
]
_DUTCH_OVEN_ONLY = re.compile(r"dutch oven", re.I)
_REAL_OVEN = re.compile(r"pre-?heat(?:ed)?\s+(?:the\s+)?oven|in (?:the|a|your) (?:pre-?heated\s+)?oven|"
                        r"oven to|\bbake|broil|\d{3}\s*(?:°|º|degrees?)", re.I)


def equipment_mask(tags: set[str], keywords: set[str], steps: list[str]) -> int:
    found: set[str] = set()
    for t in tags:
        if t in _TAG_EQUIP:
            found.add(_TAG_EQUIP[t])
    for k in keywords:
        if k in _KW_EQUIP:
            found.add(_KW_EQUIP[k])
    text = re.sub(r"\bno[- ]bake\b", "", " \n ".join(steps), flags=re.I)
    for name, rx in _TEXT_EQUIP:
        if rx.search(text):
            found.add(name)
    # "dutch oven" alone is a stovetop pot, not an oven
    if "oven" in found and _DUTCH_OVEN_ONLY.search(text) and not _REAL_OVEN.search(
            _DUTCH_OVEN_ONLY.sub("", text)) and "oven" not in tags and "Oven" not in keywords:
        found.discard("oven")
        found.add("stovetop")
    # a slow cooker / pressure cooker / air fryer recipe rarely needs the oven tag noise
    m = 0
    for name in found:
        m |= EQUIPMENT_BITS[name]
    return m


# --------------------------------------------------------------------------
COURSES = ["main", "side", "soup", "salad", "breakfast", "dessert", "baking", "snack",
           "sauce", "drink", "other"]
_COURSE_RULES = [
    ("drink", {"beverages", "cocktails", "smoothies", "shakes", "punch", "non-alcoholic"}),
    ("dessert", {"desserts", "cakes", "cookies-and-brownies", "pies-and-tarts", "candy",
                 "frozen-desserts", "puddings-and-mousses", "cheesecake", "cupcakes", "brownies",
                 "bar-cookies", "drop-cookies", "fudge", "cobblers-and-crisps", "tarts",
                 "ice-cream", "biscotti", "rolled-cookies", "hand-formed-cookies"}),
    ("baking", {"breads", "quick-breads", "yeast", "muffins", "rolls-biscuits", "scones",
                "coffee-cakes", "bread-machine"}),
    ("soup", {"soups-stews", "stews", "chowders", "bisques-cream-soups", "clear-soups",
              "gumbo", "chili", "stocks"}),
    ("salad", {"salads"}),
    ("breakfast", {"breakfast", "pancakes-and-waffles", "omelets-and-frittatas",
                   "granola-and-porridge"}),
    ("sauce", {"condiments-etc", "sauces", "salad-dressings", "marinades-and-rubs", "spreads",
               "salsas", "jams-and-preserves", "herb-and-spice-mixes", "savory-sauces",
               "sweet-sauces", "chutneys", "cooking-mixes"}),
    ("snack", {"appetizers", "finger-food", "dips", "snacks"}),
    ("side", {"side-dishes"}),
    ("main", {"main-dish", "one-dish-meal", "lunch", "sandwiches", "casseroles", "pizza",
              "burgers", "curries", "stir-fry", "meatloaf", "meatballs"}),
]


def course(tags: set[str]) -> str:
    for name, ts in _COURSE_RULES:
        if tags & ts:
            if name == "breakfast" and "main-dish" in tags and "breakfast" not in tags:
                continue
            return name
    return "other"


CUISINES = ["italian", "french", "spanish", "greek", "german", "british", "european",
            "mexican", "latin", "american", "chinese", "japanese", "korean", "thai",
            "vietnamese", "indian", "asian", "middle_eastern", "african", "other"]
_CUISINE_SPECIFIC = [
    ("italian", {"italian"}), ("french", {"french", "quebec"}),
    ("spanish", {"spanish", "portuguese"}), ("greek", {"greek"}),
    ("german", {"german", "austrian", "swiss", "hungarian", "polish", "dutch"}),
    ("british", {"english", "irish", "scottish", "welsh"}),
    ("mexican", {"mexican", "tex-mex", "baja"}),
    ("latin", {"caribbean", "cuban", "central-american", "south-american", "brazilian"}),
    ("chinese", {"chinese", "cantonese"}), ("japanese", {"japanese"}), ("korean", {"korean"}),
    ("thai", {"thai"}), ("vietnamese", {"vietnamese"}), ("indian", {"indian", "pakistani"}),
    ("middle_eastern", {"middle-eastern", "lebanese", "turkish", "iranian-persian",
                        "jewish-sephardi"}),
    ("african", {"african", "moroccan", "south-african"}),
    ("european", {"scandinavian", "swedish", "norwegian", "danish", "russian",
                  "jewish-ashkenazi", "european"}),
    ("asian", {"asian", "filipino", "indonesian", "polynesian", "hawaiian"}),
    ("american", {"american", "southern-united-states", "cajun", "creole", "midwestern",
                  "northeastern-united-states", "southwestern-united-states", "californian",
                  "pacific-northwest", "canadian", "ontario", "british-columbian",
                  "pennsylvania-dutch", "amish-mennonite", "soul", "native-american",
                  "north-american"}),
]


def cuisine(tags: set[str]) -> str:
    for name, ts in _CUISINE_SPECIFIC:
        if tags & ts:
            return name
    return "other"


DIET_BITS = {"vegetarian": 1, "vegan": 2, "gluten_free": 4, "dairy_free": 8,
             "low_carb": 16, "low_calorie": 32, "high_protein": 64, "nut_free": 128}


def diet_mask(avoid: int, avoid_bits: dict[str, int], calories: float | None,
              carbs: float | None, protein: float | None) -> int:
    """Diet flags derived from the recipe's ingredients (not the site's tags),
    so 'vegetarian' means no meat/fish ingredient was detected."""
    m = 0
    animal = avoid_bits["meat"] | avoid_bits["fish"] | avoid_bits["shellfish"]
    if not avoid & animal:
        m |= DIET_BITS["vegetarian"]
        if not avoid & (avoid_bits["dairy"] | avoid_bits["egg"] | avoid_bits["honey"]):
            m |= DIET_BITS["vegan"]
    if not avoid & avoid_bits["gluten"]:
        m |= DIET_BITS["gluten_free"]
    if not avoid & avoid_bits["dairy"]:
        m |= DIET_BITS["dairy_free"]
    if not avoid & (avoid_bits["tree_nuts"] | avoid_bits["peanut"]):
        m |= DIET_BITS["nut_free"]
    if carbs is not None and carbs <= 20:
        m |= DIET_BITS["low_carb"]
    if calories is not None and 0 < calories <= 400:
        m |= DIET_BITS["low_calorie"]
    if protein is not None and protein >= 25:
        m |= DIET_BITS["high_protein"]
    return m


def difficulty(tags: set[str], n_steps: int, n_ingredients: int, total_min: int | None) -> int:
    """1 = easy, 2 = medium, 3 = challenging."""
    score = 0
    score += 0 if n_steps <= 5 else (1 if n_steps <= 10 else 2)
    score += 0 if n_ingredients <= 8 else (1 if n_ingredients <= 14 else 2)
    if total_min and total_min > 120:
        score += 1
    if tags & {"easy", "beginner-cook", "3-steps-or-less", "5-ingredients-or-less"}:
        score -= 1
    return 1 if score <= 1 else (2 if score <= 3 else 3)
