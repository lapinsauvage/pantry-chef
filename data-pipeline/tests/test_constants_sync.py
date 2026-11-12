"""The app's src/lib/constants.ts must use the same codes/bits as the pipeline."""
import re
from pathlib import Path

from pantry_pipeline import classify, ingredients

TS = (Path(__file__).resolve().parents[2] / "src" / "lib" / "constants.ts").read_text(encoding="utf-8")


def _flags(block_name: str) -> dict[str, int]:
    block = re.search(rf"export const {block_name}: Flag\[\] = \[(.*?)\];", TS, re.S).group(1)
    return {k: int(b) for k, b in re.findall(r"key: '(\w+)', bit: (\d+)", block)}


def _keys(block_name: str) -> list[str]:
    block = re.search(rf"export const {block_name}[^=]*= \[(.*?)\];", TS, re.S).group(1)
    return re.findall(r"key: '(\w+)'", block)


def test_bits_match():
    assert _flags("EQUIPMENT") == classify.EQUIPMENT_BITS
    assert _flags("DIETS") == classify.DIET_BITS
    assert _flags("AVOID") == ingredients.AVOID_BITS


def test_codes_match():
    assert set(_keys("COURSES")) == set(classify.COURSES)
    assert set(_keys("CUISINES")) == set(classify.CUISINES)
    assert set(_keys("INGREDIENT_CATEGORIES")) == set(ingredients.CATEGORIES)


def test_staples_match():
    ts = re.search(r"HARD_STAPLES = \[(.*?)\]", TS, re.S).group(1)
    assert set(re.findall(r"'([^']+)'", ts)) == ingredients.HARD_STAPLES


def test_image_prefix_matches():
    from pantry_pipeline.build_db import IMAGE_PREFIX
    assert f"'{IMAGE_PREFIX}'" in TS
