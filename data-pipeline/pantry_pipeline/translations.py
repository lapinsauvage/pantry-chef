"""French names for canonical ingredients (vocab/ingredients_fr.json)."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_VOCAB = Path(__file__).with_name("vocab") / "ingredients_fr.json"


@lru_cache(maxsize=1)
def _table() -> dict[str, str]:
    with open(_VOCAB, encoding="utf-8") as f:
        return json.load(f)


def ingredient_fr(name: str) -> str | None:
    return _table().get(name)
