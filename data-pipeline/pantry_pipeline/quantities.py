"""Parse Food.com ingredient lines into structured quantities.

Input lines look like (multiple spaces are part of the source format):
    "4   cups    blueberries, fresh or frozen "
    "1 -2   clove    garlic, minced "
    "1 (14   ounce) can   diced tomatoes, briefly drained "
    "  salt"

Output: dict(qmin, qmax, unit, pkg_q, pkg_u, text, note)
Units are canonical US/metric codes; the app converts them for display
(see src/lib/units.ts and shared/units_cases.json).
"""
from __future__ import annotations

import re
from fractions import Fraction

UNICODE_FRACTIONS = {
    "½": "1/2", "¼": "1/4", "¾": "3/4", "⅓": "1/3", "⅔": "2/3", "⅛": "1/8",
    "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅕": "1/5", "⅙": "1/6", "⁄": "/",
}

# canonical unit code -> spellings
UNIT_WORDS = {
    "cup": ["cup", "cups", "c", "c."],
    "tbsp": ["tablespoon", "tablespoons", "tbsp", "tbsp.", "tbs", "tbs.", "tbl", "tbl.", "T"],
    "tsp": ["teaspoon", "teaspoons", "tsp", "tsp.", "t"],
    "floz": ["fluid ounce", "fluid ounces", "fl oz", "fl. oz.", "fl.oz."],
    "oz": ["ounce", "ounces", "oz", "oz."],
    "lb": ["pound", "pounds", "lb", "lbs", "lb.", "lbs."],
    "pint": ["pint", "pints", "pt"],
    "quart": ["quart", "quarts", "qt"],
    "gallon": ["gallon", "gallons", "gal"],
    "ml": ["ml", "milliliter", "milliliters", "millilitre", "millilitres", "mL"],
    "l": ["liter", "liters", "litre", "litres", "l"],
    "g": ["g", "gram", "grams", "gr"],
    "kg": ["kg", "kilogram", "kilograms"],
    "inch": ["inch", "inches", "in"],
    "pinch": ["pinch", "pinches"],
    "dash": ["dash", "dashes"],
    "clove": ["clove", "cloves"],
    "can": ["can", "cans", "tin", "tins"],
    "package": ["package", "packages", "pkg", "pkgs", "packet", "packets", "envelope", "envelopes"],
    "jar": ["jar", "jars"],
    "bottle": ["bottle", "bottles"],
    "box": ["box", "boxes"],
    "stick": ["stick", "sticks"],
    "slice": ["slice", "slices"],
    "piece": ["piece", "pieces"],
    "bunch": ["bunch", "bunches"],
    "head": ["head", "heads"],
    "sprig": ["sprig", "sprigs"],
    "stalk": ["stalk", "stalks"],
    "drop": ["drop", "drops"],
    "handful": ["handful", "handfuls"],
    "container": ["container", "containers", "carton", "cartons", "tub", "tubs"],
    "bag": ["bag", "bags"],
    "loaf": ["loaf", "loaves"],
    "fillet": ["fillet", "fillets"],
    "whole": ["whole"],
}
_LOOKUP: dict[str, str] = {}
for code, words in UNIT_WORDS.items():
    for w in words:
        _LOOKUP[w] = code
# two-word units first
_MULTI = sorted([w for w in _LOOKUP if " " in w], key=len, reverse=True)

_NUM = r"(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|\.\d+)"
_QTY_RE = re.compile(rf"^\s*(?P<a>{_NUM})(?:\s*(?:-|to)\s*(?P<b>{_NUM}))?\s*")
_PKG_RE = re.compile(rf"^\(\s*(?P<q>{_NUM})(?:\s*-\s*{_NUM})?\s*(?P<u>[a-zA-Z. ]+?)\s*\)\s*")


def _num(s: str) -> float:
    s = s.strip()
    if " " in s:
        whole, frac = s.split(None, 1)
        return float(int(whole) + Fraction(frac))
    if "/" in s:
        return float(Fraction(s))
    return float(s)


def _unit_at(rest: str) -> tuple[str | None, str]:
    low = rest
    for w in _MULTI:
        if low.lower().startswith(w + " ") or low.lower() == w:
            return _LOOKUP[w], rest[len(w):].lstrip()
    m = re.match(r"^([A-Za-z.]+)\s*(.*)$", rest)
    if not m:
        return None, rest
    word, tail = m.group(1), m.group(2)
    if word in _LOOKUP and word in ("T", "t", "c", "c."):
        return _LOOKUP[word], tail          # case-sensitive short forms
    code = _LOOKUP.get(word.lower())
    if code and word not in ("T", "t", "c", "c."):
        # "whole" only counts as a unit when followed by something
        return code, tail
    return None, rest


def parse_line(line: str) -> dict:
    s = line
    for k, v in UNICODE_FRACTIONS.items():
        s = s.replace(k, v if k == "⁄" else " " + v)
    s = re.sub(r"(\d)\s*/\s*(\d)", r"\1/\2", s)
    s = re.sub(r"\s+", " ", s).strip()
    out = {"qmin": None, "qmax": None, "unit": None, "pkg_q": None, "pkg_u": None,
           "text": "", "note": ""}
    m = _QTY_RE.match(s)
    if m:
        try:
            out["qmin"] = round(_num(m.group("a")), 4)
            if m.group("b"):
                out["qmax"] = round(_num(m.group("b")), 4)
        except (ValueError, ZeroDivisionError):
            pass
        s = s[m.end():]
    m = _PKG_RE.match(s)
    if m:
        try:
            out["pkg_q"] = round(_num(m.group("q")), 4)
            code, _ = _unit_at(m.group("u").strip())
            out["pkg_u"] = code or m.group("u").strip().lower()
        except (ValueError, ZeroDivisionError):
            pass
        s = s[m.end():]
    code, s2 = _unit_at(s)
    if code and s2:  # never consume the whole line as a unit
        out["unit"] = code
        s = s2
    s = s.strip(" ,")
    to_taste = False
    if re.match(r"^to taste\b", s, re.I):
        s, to_taste = s[8:].strip(), True
    text, note = _split_note(s)
    if to_taste:
        note = (note + ", to taste").strip(" ,") if note else "to taste"
    out["text"] = text.strip()
    out["note"] = note.strip(" ,")
    return out


def _split_note(s: str) -> tuple[str, str]:
    """Split "item, note" on the first comma that is not inside parentheses."""
    depth = 0
    for i, ch in enumerate(s):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == "," and depth == 0:
            return s[:i], s[i + 1:].strip()
    if " -- " in s:
        a, b = s.split(" -- ", 1)
        return a, b
    return s, ""


# --------------------------------------------------------------------------
# Time parsing (ISO-8601 durations like "PT1H30M")
_DUR = re.compile(r"^P(?:(?P<d>\d+)D)?(?:T(?:(?P<h>\d+)H)?(?:(?P<m>\d+)M)?(?:(?P<s>\d+)S)?)?$")


def iso_minutes(value: str | None) -> int | None:
    if not value:
        return None
    m = _DUR.match(value.strip())
    if not m:
        return None
    d, h, mi = (int(m.group(k) or 0) for k in ("d", "h", "m"))
    total = d * 1440 + h * 60 + mi
    return total or None
