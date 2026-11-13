"""Machine translation of recipe texts EN→FR with a free open-source Opus-MT model (CTranslate2).

Spec: docs/TRANSLATOR.md. The pure parts (keys, glossary, pre/post-processing, quality checks,
memory files, the translate loop) are unit-tested with a fake translator; the real model is only
loaded by the CLI, on GitHub Actions (.github/workflows/translate.yml):

  python -m pantry_pipeline.machine_translation --texts texts.jsonl --memory old.jsonl.gz \\
      --out new.jsonl.gz --model Helsinki-NLP/opus-mt-tc-big-en-fr=models/tc-big --report report.md

texts.jsonl comes from data-pipeline/scripts/export_texts.ts: one unique text per line,
{"key", "kind", "en", "score"}, with `en` already metric (src/lib/units.ts metricizeText).
The memory (gzip JSONL) keeps one entry per key and is the single source of truth for French texts.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import random
import re
import sys
import time
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable, Protocol, Sequence

GLOSSARY_PATH = Path(__file__).with_name("vocab") / "glossary_fr.json"
KINDS = ("name", "step", "ingredient")

# Sentence split used by the test run: after . ! ? when the next sentence starts with a capital/digit.
SENTENCE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9(])")
MAX_TOKENS = 500


# ---------------------------------------------------------------------------
# Keys (must match data-pipeline/scripts/text-key.ts; shared fixture tests/fixtures/text_keys.json)

def text_key(kind: str, raw: str) -> str:
    """sha1 of kind + newline + the exact string stored in recipes.db."""
    return hashlib.sha1(f"{kind}\n{raw}".encode("utf-8")).hexdigest()


def ingredient_raw(text: str | None, note: str | None) -> str:
    """The raw string of an ingredient line for its key: text NUL note (tuple fields 5 and 6)."""
    return f"{text or ''}\u0000{note or ''}"


# ---------------------------------------------------------------------------
# Glossary

@dataclass(frozen=True)
class Rule:
    pattern: re.Pattern
    to: str
    when_en: re.Pattern | None = None  # post rules: only when the English text matches this


@dataclass(frozen=True)
class Glossary:
    version: int
    pre: tuple[Rule, ...]
    post: tuple[Rule, ...]


def load_glossary(path: str | Path = GLOSSARY_PATH) -> Glossary:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    flags = re.IGNORECASE
    pre = tuple(Rule(re.compile(r["en"], flags), r["to"]) for r in data.get("pre", []))
    post = tuple(Rule(re.compile(r["fr"], flags), r["to"],
                      re.compile(r["en"], flags) if r.get("en") else None)
                 for r in data.get("post", []))
    return Glossary(int(data["version"]), pre, post)


@lru_cache(maxsize=1)
def default_glossary() -> Glossary:
    return load_glossary()


def _replace(rule: Rule, text: str) -> str:
    """Apply a rule; the replacement starts with a capital only where a sentence starts."""
    def sub(m: re.Match) -> str:
        out = m.expand(rule.to)
        starts = m.start() == 0 or text[:m.start()].rstrip().endswith((".", "!", "?"))
        return out[:1].upper() + out[1:] if starts and m.group(0)[:1].isupper() else out
    return rule.pattern.sub(sub, text)


# ---------------------------------------------------------------------------
# Before the model (English)

_CAPS = re.compile(r"\b[A-Z]{3,}\b")
_SPACES = re.compile(r"\s+")


def sentence_case(name: str) -> str:
    """'Best Ever Banana Bread' -> 'Best ever banana bread' (Title Case names translate poorly)."""
    words = name.split(" ")
    capitalised = sum(1 for w in words if w[:1].isupper())
    if len(words) < 2 or capitalised < len(words) - 1:
        return name
    return " ".join([words[0]] + [w if len(w) > 1 and w.isupper() else w[:1].lower() + w[1:]
                                  for w in words[1:]])


def prepare(kind: str, en: str, glossary: Glossary) -> str:
    """The English text actually sent to the model."""
    text = _SPACES.sub(" ", en).strip()
    text = _CAPS.sub(lambda m: m.group(0).lower(), text)  # "ENJOY!" -> "enjoy!", "on LOW" -> "on low"
    if kind == "name":
        text = sentence_case(text)
    for rule in glossary.pre:
        text = _replace(rule, text)
    return text


def split_sentences(text: str) -> list[str]:
    return [s for s in SENTENCE.split(text.strip()) if s] or [""]


# ---------------------------------------------------------------------------
# After the model (French)

_DECIMAL = re.compile(r"(?<=\d)\.(?=\d)")
_HIGH_PUNCT = re.compile(r"(?<=[^\s\d ])[  ]?([?!:;])(?=\s|$)")


def finish(kind: str, en: str, mt: str, glossary: Glossary) -> str:
    """Model output -> Belgian French as shown in the app."""
    text = _SPACES.sub(" ", mt).strip()
    for rule in glossary.post:
        if rule.when_en is None or rule.when_en.search(en):
            text = _replace(rule, text)
    text = _DECIMAL.sub(",", text)  # 2.5 cm -> 2,5 cm
    text = _HIGH_PUNCT.sub(" \\1", text)  # no-break space before ? ! : ; (as in src/i18n/fr.ts)
    if not text:
        return text
    if kind == "ingredient" and en[:1].islower():
        text = text[:1].lower() + text[1:]
    elif kind in ("name", "step") or en[:1].isupper():
        text = text[:1].upper() + text[1:]
    return text


# ---------------------------------------------------------------------------
# Quality checks

_NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
_WORD = re.compile(r"[a-zà-ÿœæ']+", re.IGNORECASE)
# Words that only exist in English: many of them in a "French" output means it wasn't translated.
ENGLISH_ONLY = frozenset(
    "the and with until into then of to add stir bake heat your you it is are from over remove "
    "mixture".split())


def numbers(text: str) -> list[str]:
    return sorted(n.replace(",", ".") for n in _NUMBER.findall(text))


def _max_trigram(words: list[str]) -> int:
    grams = Counter(tuple(words[i:i + 3]) for i in range(len(words) - 2))
    return max(grams.values(), default=0)


def check(en: str, fr: str) -> str | None:
    """None when the translation looks fine, else the reason it doesn't."""
    if en.strip() and not fr.strip():
        return "empty"
    if numbers(en) != numbers(fr):
        return "numbers"
    if len(en) >= 20 and not 0.5 <= len(fr) / len(en) <= 2.5:
        return "length"
    fr_words = [w.lower() for w in _WORD.findall(fr)]
    if _max_trigram(fr_words) >= 4 and _max_trigram(fr_words) > _max_trigram([w.lower() for w in _WORD.findall(en)]) + 1:
        return "loop"
    if len(fr_words) >= 4 and sum(w in ENGLISH_ONLY for w in fr_words) / len(fr_words) >= 0.3:
        return "english"
    return None


# ---------------------------------------------------------------------------
# Translating

class Translator(Protocol):
    model_id: str

    def translate(self, sentences: list[str], beam: int) -> list[str]:
        """Translate sentences (any order, any length up to MAX_TOKENS tokens)."""


def translate_texts(translator: Translator, texts: Sequence[str], beam: int) -> list[str]:
    """Translate whole texts sentence by sentence (short inputs translate better and faster)."""
    pieces, owner = [], []
    for i, text in enumerate(texts):
        for s in split_sentences(text):
            pieces.append(s)
            owner.append(i)
    todo = [k for k, p in enumerate(pieces) if p.strip()]
    done = translator.translate([pieces[k] for k in todo], beam) if todo else []
    out_pieces = [""] * len(pieces)
    for k, t in zip(todo, done):
        out_pieces[k] = t
    parts: list[list[str]] = [[] for _ in texts]
    for k, t in enumerate(out_pieces):
        if t:
            parts[owner[k]].append(t)
    return [" ".join(p) for p in parts]


def translate_items(items: Sequence[dict], translator: Translator, glossary: Glossary,
                    beam: int = 2, retry_beam: int = 4) -> list[dict]:
    """Translate export items {key, kind, en}; failed checks get one retry with a wider beam."""
    sources = [prepare(it["kind"], it["en"], glossary) for it in items]
    mts = translate_texts(translator, sources, beam)
    entries, retry = [], []
    for i, (it, src, mt) in enumerate(zip(items, sources, mts)):
        fr = finish(it["kind"], it["en"], mt, glossary)
        problem = check(it["en"], fr)
        entry = {"key": it["key"], "kind": it["kind"], "en": it["en"], "mt": mt, "fr": fr,
                 "model": translator.model_id, "glossary": glossary.version,
                 "qa": "ok" if problem is None else f"failed:{problem}"}
        if src != it["en"]:
            entry["src"] = src
        entries.append(entry)
        if problem is not None:
            retry.append(i)
    if retry and retry_beam > beam:
        again = translate_texts(translator, [sources[i] for i in retry], retry_beam)
        for i, mt in zip(retry, again):
            fr = finish(items[i]["kind"], items[i]["en"], mt, glossary)
            problem = check(items[i]["en"], fr)
            if problem is None:
                entries[i].update(mt=mt, fr=fr, qa="retried")
    return entries


def refinish(entry: dict, glossary: Glossary) -> dict:
    """Re-apply the current post-processing to a stored model output (glossary change, no model)."""
    fr = finish(entry["kind"], entry["en"], entry["mt"], glossary)
    problem = check(entry["en"], fr)
    out = dict(entry, fr=fr, glossary=glossary.version)
    if out["qa"] != "retried" or problem is not None:
        out["qa"] = "ok" if problem is None else f"failed:{problem}"
    return out


def usable(entry: dict | None) -> str | None:
    """The French text of a memory entry, or None when it failed its checks."""
    if not entry or not entry.get("fr") or str(entry.get("qa", "")).startswith("failed"):
        return None
    return entry["fr"]


# ---------------------------------------------------------------------------
# Memory files (gzip JSONL, one entry per key)

def read_memory(path: str | Path | None) -> dict[str, dict]:
    if not path or not os.path.exists(path):
        return {}
    out: dict[str, dict] = {}
    with gzip.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                e = json.loads(line)
                out[e["key"]] = e
    return out


def write_memory(path: str | Path, memory: dict[str, dict]) -> None:
    tmp = f"{path}.tmp"
    with gzip.open(tmp, "wt", encoding="utf-8", compresslevel=9) as f:
        for key in sorted(memory):
            f.write(json.dumps(memory[key], ensure_ascii=False, separators=(",", ":")) + "\n")
    os.replace(tmp, path)


def read_texts(path: str | Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def plan(texts: Sequence[dict], memory: dict[str, dict], glossary: Glossary, model_id: str,
         retranslate: bool = False) -> tuple[list[dict], list[dict]]:
    """Split export items into (to translate, memory entries to re-finish with the new glossary)."""
    todo, refresh = [], []
    for it in texts:
        old = memory.get(it["key"])
        if old is None or retranslate or old.get("model") != model_id or old.get("en") != it["en"]:
            todo.append(it)
        elif old.get("src", old["en"]) != prepare(it["kind"], it["en"], glossary):
            todo.append(it)  # a pre-replacement changed what the model would read
        elif old.get("glossary") != glossary.version:
            refresh.append(old)
    return todo, refresh


# ---------------------------------------------------------------------------
# CTranslate2 model (only on the runner: needs ctranslate2, sentencepiece, transformers<5)

class CTranslate2Translator:
    def __init__(self, hf_id: str, ct2_dir: str, threads: int | None = None):
        import ctranslate2  # noqa: PLC0415 (lazy: not installed in CI)
        from transformers import AutoTokenizer  # noqa: PLC0415

        self.model_id = hf_id
        self.tok = AutoTokenizer.from_pretrained(hf_id)
        self.translator = ctranslate2.Translator(
            ct2_dir, device="cpu", compute_type="int8", intra_threads=threads or os.cpu_count() or 2)

    def translate(self, sentences: list[str], beam: int) -> list[str]:
        order = sorted(range(len(sentences)), key=lambda k: len(sentences[k]))
        tokens = []
        for k in order:
            t = self.tok.convert_ids_to_tokens(self.tok.encode(sentences[k]))
            tokens.append(t if len(t) <= MAX_TOKENS else t[:MAX_TOKENS - 1] + t[-1:])
        results = self.translator.translate_batch(
            tokens, max_batch_size=2048, batch_type="tokens", beam_size=beam, max_decoding_length=512)
        out = [""] * len(sentences)
        for k, r in zip(order, results):
            out[k] = self.tok.decode(self.tok.convert_tokens_to_ids(r.hypotheses[0]), skip_special_tokens=True)
        return out


# ---------------------------------------------------------------------------
# CLI

def report(entries: Sequence[dict], stats: dict, examples: int = 30) -> str:
    qa = Counter(e["qa"] for e in entries)
    lines = [
        "# Translation run",
        "",
        f"- Model: `{stats['model']}`, beam {stats['beam']}, glossary v{stats['glossary']}",
        f"- Texts translated: {len(entries):,} ({stats['chars']:,} characters) in {stats['seconds']:,.0f} s "
        f"→ {stats['chars'] / max(stats['seconds'], 1):,.0f} characters/s",
        f"- Re-finished with the new glossary (no model): {stats['refinished']:,}",
        f"- Already in the memory: {stats['known']:,}; left for a later run: {stats['left']:,}",
        f"- Checks: " + ", ".join(f"{k} {v:,}" for k, v in sorted(qa.items())),
        f"- Memory now holds {stats['memory']:,} texts",
        "",
    ]
    rng = random.Random(7)
    picks = rng.sample(list(entries), min(examples, len(entries)))
    if picks:
        lines += ["| Kind | English | French | Check |", "|---|---|---|---|"]
        for e in picks:
            cells = [e["kind"], e["en"], e["fr"], e["qa"]]
            lines.append("| " + " | ".join(c.replace("|", "/").replace("\n", " ") for c in cells) + " |")
    failed = [e for e in entries if e["qa"].startswith("failed")][:15]
    if failed:
        lines += ["", "## Failed checks (English kept in the app)", "", "| Check | English | Model output |", "|---|---|---|"]
        for e in failed:
            lines.append(f"| {e['qa']} | {e['en'].replace('|', '/')} | {e['fr'].replace('|', '/')} |")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--texts", required=True, help="export_texts.ts output (JSONL)")
    ap.add_argument("--memory", help="existing memory (gzip JSONL), if any")
    ap.add_argument("--out", required=True, help="memory to write (existing + new entries)")
    ap.add_argument("--model", required=True, help="<hugging-face-id>=<ctranslate2-dir>")
    ap.add_argument("--beam", type=int, default=2)
    ap.add_argument("--max-chars", type=int, default=0, help="translate at most this many characters (0 = all)")
    ap.add_argument("--deadline-minutes", type=float, default=0, help="stop starting new chunks after this")
    ap.add_argument("--chunk", type=int, default=2000)
    ap.add_argument("--retranslate", action="store_true")
    ap.add_argument("--report")
    a = ap.parse_args(argv)

    start = time.time()
    glossary = default_glossary()
    hf_id, ct2_dir = a.model.split("=", 1)
    texts = read_texts(a.texts)  # best recipe score first
    memory = read_memory(a.memory)
    todo, refresh = plan(texts, memory, glossary, hf_id, a.retranslate)
    known = len(texts) - len(todo) - len(refresh)
    for e in refresh:
        memory[e["key"]] = refinish(e, glossary)
    if a.max_chars:
        kept, total = [], 0
        for it in todo:
            if total + len(it["en"]) > a.max_chars:
                break
            kept.append(it)
            total += len(it["en"])
        left = len(todo) - len(kept)
        todo = kept
    else:
        left = 0
    print(f"{len(texts):,} texts, {len(todo):,} to translate ({sum(len(t['en']) for t in todo):,} chars), "
          f"{len(refresh):,} to re-finish", flush=True)

    translator = CTranslate2Translator(hf_id, ct2_dir)
    done: list[dict] = []
    t0 = time.time()
    for i in range(0, len(todo), a.chunk):
        if a.deadline_minutes and time.time() - start > a.deadline_minutes * 60:
            left += len(todo) - i
            print(f"deadline reached, {len(todo) - i:,} texts left for the next run", flush=True)
            break
        batch = translate_items(todo[i:i + a.chunk], translator, glossary, beam=a.beam)
        done += batch
        for e in batch:
            memory[e["key"]] = e
        write_memory(a.out, memory)  # checkpoint
        print(f"  {i + len(batch):,}/{len(todo):,} texts, {time.time() - t0:,.0f} s", flush=True)
    write_memory(a.out, memory)
    stats = {"model": hf_id, "beam": a.beam, "glossary": glossary.version,
             "chars": sum(len(e["en"]) for e in done), "seconds": time.time() - t0,
             "refinished": len(refresh), "known": known,
             "left": left, "memory": len(memory)}
    text = report(done, stats)
    print(text)
    if a.report:
        with open(a.report, "w", encoding="utf-8") as f:
            f.write(text)


if __name__ == "__main__":
    sys.exit(main())
