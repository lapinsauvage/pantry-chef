"""Translation test: translate a sample of recipes EN→FR with one or more CTranslate2 models,
measure speed, estimate the time for the whole database and print side-by-side examples.

    python translate_sample.py sample.json --model <hf-id>=<ct2-dir> [--model ...] --report report.md
"""
import argparse
import json
import os
import random
import re
import time

import ctranslate2
from transformers import AutoTokenizer

# Characters to translate in the full database (measured on the 106,929-recipe build).
FULL_DB_CHARS = {"names": 2.9e6, "descriptions": 17.2e6, "steps": 57.0e6, "ingredients": 18.1e6}
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(])")


def segments(recipe):
    """All texts of a recipe as (kind, index, text)."""
    yield ("name", 0, recipe["name"])
    if recipe["description"]:
        yield ("description", 0, recipe["description"])
    for i, line in enumerate(recipe["ingredients"]):
        yield ("ingredient", i, line)
    for i, step in enumerate(recipe["steps"]):
        yield ("step", i, step)


class Model:
    def __init__(self, hf_id, ct2_dir, threads):
        self.name = hf_id
        self.tok = AutoTokenizer.from_pretrained(hf_id)
        self.translator = ctranslate2.Translator(ct2_dir, device="cpu", compute_type="int8", intra_threads=threads)

    def translate(self, texts, beam=2):
        """Translate texts sentence by sentence (keeps inputs short), longest-first batching."""
        pieces, owner = [], []
        for i, text in enumerate(texts):
            for sentence in SENTENCE.split(text.strip()) or [""]:
                pieces.append(sentence)
                owner.append(i)
        order = sorted(range(len(pieces)), key=lambda k: len(pieces[k]))
        tokens = [self.tok.convert_ids_to_tokens(self.tok.encode(pieces[k]))[:500] for k in order]
        results = self.translator.translate_batch(
            tokens, max_batch_size=2048, batch_type="tokens", beam_size=beam, max_decoding_length=512)
        translated = [""] * len(pieces)
        for k, r in zip(order, results):
            translated[k] = self.tok.decode(self.tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True)
        out = [[] for _ in texts]
        for k, text in enumerate(translated):
            out[owner[k]].append(text)
        return [" ".join(parts) for parts in out]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sample")
    ap.add_argument("--model", action="append", required=True, help="<hugging-face-id>=<ctranslate2-dir>")
    ap.add_argument("--report", required=True)
    ap.add_argument("--examples", type=int, default=3)
    a = ap.parse_args()

    recipes = json.load(open(a.sample, encoding="utf-8"))["recipes"]
    segs = [s for r in recipes for s in segments(r)]
    texts = [t for _, _, t in segs]
    chars = sum(len(t) for t in texts)
    threads = os.cpu_count() or 2
    total_chars = sum(FULL_DB_CHARS.values())

    lines = [f"# Translation test — {len(recipes)} popular recipes, {len(texts):,} texts, {chars:,} characters",
             f"Runner: {threads} CPU threads. Full database: {total_chars / 1e6:.0f} M characters.", "",
             "| Model | Seconds | Characters/s | Full DB, 1 job | Full DB, 4 parallel jobs |",
             "|---|---|---|---|---|"]
    outputs = {}
    for spec in a.model:
        hf_id, ct2_dir = spec.split("=", 1)
        model = Model(hf_id, ct2_dir, threads)
        model.translate(texts[:20])  # warm-up
        start = time.perf_counter()
        outputs[hf_id] = model.translate(texts)
        secs = time.perf_counter() - start
        cps = chars / secs
        hours = total_chars / cps / 3600
        lines.append(f"| {hf_id} | {secs:,.0f} | {cps:,.0f} | {hours:,.1f} h | {hours / 4:,.1f} h |")
        print(f"{hf_id}: {secs:.0f} s, {cps:.0f} chars/s, full DB {hours:.1f} h", flush=True)

    names = list(outputs)
    header = "| English | " + " | ".join(names) + " |"
    rule = "|---|" + "---|" * len(names)
    index = {seg: i for i, seg in enumerate((r["id"], k, n) for r in recipes for k, n, _ in segments(r))}

    def row(i):
        cells = [texts[i]] + [outputs[n][i] for n in names]
        return "| " + " | ".join(c.replace("|", "/").replace("\n", " ") for c in cells) + " |"

    for r in recipes[: a.examples]:
        lines += ["", f"## {r['name']} (recipe {r['id']})", "", header, rule]
        lines += [row(index[(r["id"], k, n)]) for k, n, _ in segments(r)]

    random.seed(7)
    steps = [i for i, (k, _, _) in enumerate(segs) if k == "step"]
    lines += ["", "## Random steps from other recipes", "", header, rule]
    lines += [row(i) for i in random.sample(steps, min(15, len(steps)))]

    report = "\n".join(lines) + "\n"
    open(a.report, "w", encoding="utf-8").write(report)
    json.dump({n: outputs[n] for n in names} | {"english": texts}, open(a.report + ".json", "w", encoding="utf-8"), ensure_ascii=False)
    print(report)


if __name__ == "__main__":
    main()
