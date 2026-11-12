#!/usr/bin/env bash
# Download the two Food.com source files into DEST (default: data-raw).
#   - With a Kaggle token (env KAGGLE_API_TOKEN, or KAGGLE_USERNAME + KAGGLE_KEY):
#     downloads from Kaggle, the original publisher.
#   - Without: downloads byte-identical copies hosted in public GitHub repos (Git LFS)
#     and verifies their sha256.
set -euo pipefail
DEST="${1:-data-raw}"
mkdir -p "$DEST"

PARQUET_SHA=9f591abe9f8d1c691bbc630b0431ec6613f09fabe93f1789af87a06484aae9fb
CSV_SHA=1a26bcbcf6983ec108fb9b75ff2390abd32c070162d8d9afd28c94ac400c99dc
PARQUET_MIRRORS=(
  "https://media.githubusercontent.com/media/nhajouji/foodrecs/main/data/recipes.parquet"
  "https://media.githubusercontent.com/media/armanshakeri79/MMSSL/main/dataset/archive-4/recipes.parquet"
)
CSV_MIRRORS=(
  "https://media.githubusercontent.com/media/closed-ay-eye/experiments/main/dataset/recipes_w_search_terms.csv"
)

verify() { # file sha
  local got; got=$(sha256sum "$1" | cut -c1-64)
  if [[ "$got" != "$2" ]]; then echo "::warning::$1 sha256 $got (expected $2)"; return 1; fi
}

fetch_mirror() { # out sha urls...
  local out="$1" sha="$2"; shift 2
  if [[ -f "$out" ]] && verify "$out" "$sha" 2>/dev/null; then echo "✓ $out already present"; return 0; fi
  for url in "$@"; do
    echo "↓ $url"
    if curl -fL --retry 3 --retry-delay 5 -o "$out.part" "$url" && verify "$out.part" "$sha"; then
      mv "$out.part" "$out"; echo "✓ $out"; return 0
    fi
  done
  echo "::error::Could not download $out from any mirror. Add a KAGGLE_API_TOKEN secret (see docs/BUILD.md)."
  return 1
}

if [[ -n "${KAGGLE_API_TOKEN:-}" || ( -n "${KAGGLE_USERNAME:-}" && -n "${KAGGLE_KEY:-}" ) ]]; then
  echo "Using Kaggle API"
  pip install --quiet kaggle
  kaggle datasets download -d irkaal/foodcom-recipes-and-reviews -f recipes.parquet -p "$DEST" --force
  kaggle datasets download -d shuyangli94/foodcom-recipes-with-search-terms-and-tags \
    -f recipes_w_search_terms.csv -p "$DEST" --force
  for z in "$DEST"/*.zip; do [[ -f "$z" ]] && unzip -o -q "$z" -d "$DEST" && rm "$z"; done
  verify "$DEST/recipes.parquet" "$PARQUET_SHA" || echo "(Kaggle version differs from the tested one — fine if the build passes)"
  verify "$DEST/recipes_w_search_terms.csv" "$CSV_SHA" || true
else
  fetch_mirror "$DEST/recipes.parquet" "$PARQUET_SHA" "${PARQUET_MIRRORS[@]}"
  fetch_mirror "$DEST/recipes_w_search_terms.csv" "$CSV_SHA" "${CSV_MIRRORS[@]}"
fi
ls -la "$DEST"
