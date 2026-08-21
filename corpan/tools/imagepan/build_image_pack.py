#!/usr/bin/env python3
"""Build the shippable ``imagepan`` pack from curation verdicts + candidates.

Pipeline (mirrors ``dja/word_pack/build_word_pack.py`` for the SQLite side):

  verdicts.json  +  candidate PNGs  ->  dist/imagepan/
      images/<key>.webp            (384x384, subject fit, transparent pad)
      data/index.sqlite3           (pack_meta + concept + concept_word index)
      manifest.json
      ATTRIBUTION.md

Only concepts whose verdict is ``pick`` are shipped, and only if the picked
candidate PNG actually exists and its webp gets written. Distractor lists are
pruned to siblings that also shipped.

Pillow (PIL) is REQUIRED for image processing. ``rembg`` is OPTIONAL — if it is
not installed we skip background removal and print a note (the subject is still
fit onto the transparent canvas from the source's own alpha, if any).
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Hard dependency: Pillow ------------------------------------------------ #
try:
    from PIL import Image
except ImportError:
    print(
        "ERROR: Pillow (PIL) is required for build_image_pack.py.\n"
        "Install it with:  python3 -m pip install pillow",
        file=sys.stderr,
    )
    sys.exit(2)

# --- Optional dependency: rembg (background removal) ------------------------ #
try:
    from rembg import remove as _rembg_remove  # type: ignore
    _HAVE_REMBG = True
except Exception:  # ImportError, or heavy import-time failure (onnxruntime etc.)
    _rembg_remove = None
    _HAVE_REMBG = False

# The locked house style id, imported so the pack records exactly what shipped.
try:
    from style import STYLE_ID
except ImportError:
    # Allow running from another cwd by falling back to the sibling file.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from style import STYLE_ID  # type: ignore


CANVAS = 384              # output square edge, px
WEBP_QUALITY = 78         # in the requested 75-80 range
MAX_DISTRACTORS = 5

# Hard contract with the app resolver — do NOT rename columns.
SCHEMA_SQL = """
CREATE TABLE pack_meta(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE concept(
  key TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  sense_gloss TEXT,
  cefr TEXT,
  domain TEXT,
  file TEXT NOT NULL,
  distractors_json TEXT NOT NULL
);

CREATE INDEX concept_word ON concept(word);
"""

MANIFEST = {
    "id": "imagepan",
    "name": "Picture concepts",
    "version": "0.1.0",
    "entryType": "data",
    "sdkVersion": "0.1.0",
    "databases": {"main": "data/index.sqlite3"},
    "languages": [],
}

ATTRIBUTION = """\
# Attribution — imagepan (Picture concepts)

## Images

The concept illustrations in this pack were generated with **Stable Diffusion
3.5 Large** (Stability AI) under the **Stability AI Community License**. Under
that license the outputs are owned by us, and commercial use is permitted for
organizations with under US$1,000,000 in annual revenue. See
https://stability.ai/community-license-agreement for the license terms.

Each image was produced from a fixed house-style prompt and negative prompt
(style id below), then **human-curated**: a person reviewed four candidates per
concept and selected one. Selected images were background-removed, fit onto a
384x384 transparent canvas, and compiled into this pack. The selection,
curation, and compilation are our own editorial work.

## Concreteness norms (build-time only, not shipped)

Concept selection used the concreteness ratings of Brysbaert, Warriner &
Kuperman (2014), "Concreteness ratings for 40 thousand generally known English
word lemmas," *Behavior Research Methods* 46(3), 904-911. These ratings were
consulted only at build time to help choose concrete, picturable concepts; the
norms themselves are **not distributed** in this pack.
"""


def _log(msg: str) -> None:
    print(msg)


def fit_to_canvas(img: Image.Image) -> Image.Image:
    """Fit ``img`` onto a CANVAS x CANVAS transparent RGBA square.

    Preserve aspect ratio (longest side = CANVAS), center, transparent pad.
    """
    img = img.convert("RGBA")
    w, h = img.size
    if w == 0 or h == 0:
        raise ValueError("source image has zero dimension")
    scale = CANVAS / max(w, h)
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(resized, ((CANVAS - new_w) // 2, (CANVAS - new_h) // 2),
                 resized)
    return canvas


def process_image(src: Path, dst: Path) -> bool:
    """Load src, optionally strip background, fit, save WebP. True on success."""
    try:
        with Image.open(src) as im:
            im.load()
            subject = im.convert("RGBA")
    except Exception as exc:  # noqa: BLE001 — report and skip, never crash
        _log(f"  ! failed to open {src.name}: {exc}")
        return False

    if _HAVE_REMBG:
        try:
            subject = _rembg_remove(subject)
            if subject.mode != "RGBA":
                subject = subject.convert("RGBA")
        except Exception as exc:  # noqa: BLE001
            _log(f"  ! rembg failed on {src.name} ({exc}); using original")

    try:
        canvas = fit_to_canvas(subject)
        dst.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)
    except Exception as exc:  # noqa: BLE001
        _log(f"  ! failed to write {dst.name}: {exc}")
        return False
    return True


def load_concepts(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("concepts file must be a JSON array")
    return [c for c in raw if isinstance(c, dict) and c.get("key")]


def load_verdicts(path: Path) -> dict:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("verdicts file must be a JSON object")
    return raw


def build_database(out_db: Path, concepts_by_key: dict, shipped: dict,
                   style_id: str) -> None:
    """Write the pack SQLite. ``shipped`` maps key -> written webp rel path."""
    out_db.parent.mkdir(parents=True, exist_ok=True)
    if out_db.exists():
        out_db.unlink()

    conn = sqlite3.connect(str(out_db))
    conn.isolation_level = None
    conn.execute("PRAGMA journal_mode=OFF;")
    conn.execute("PRAGMA synchronous=OFF;")
    conn.execute("PRAGMA temp_store=MEMORY;")
    conn.executescript(SCHEMA_SQL)

    now = datetime.now(timezone.utc).isoformat()
    conn.executemany(
        "INSERT INTO pack_meta(key, value) VALUES(?, ?)",
        [
            ("schema_version", "1"),
            ("id", "imagepan"),
            ("version", "0.1.0"),
            ("style_id", style_id),
            ("image_count", str(len(shipped))),
            ("generated_at", now),
        ],
    )

    conn.execute("BEGIN")
    for key in sorted(shipped):
        concept = concepts_by_key[key]
        # Build distractors from the sibling group, keeping only shipped ones.
        distractors = []
        for sib in concept.get("distractor_group", []):
            if sib in shipped and sib != key:
                sib_concept = concepts_by_key.get(sib, {})
                distractors.append({
                    "key": sib,
                    "word": sib_concept.get("word", sib),
                    "file": f"images/{sib}.webp",
                })
            if len(distractors) >= MAX_DISTRACTORS:
                break
        conn.execute(
            "INSERT INTO concept(key, word, sense_gloss, cefr, domain, file, "
            "distractors_json) VALUES(?, ?, ?, ?, ?, ?, ?)",
            (
                key,
                concept.get("word", key),
                concept.get("sense_gloss"),
                concept.get("cefr"),
                concept.get("domain"),
                f"images/{key}.webp",
                json.dumps(distractors, ensure_ascii=False),
            ),
        )
    conn.execute("COMMIT")

    conn.execute("ANALYZE;")
    conn.execute("VACUUM;")
    conn.close()


def validate(out: Path, db: Path, total_concepts: int, shipped: dict) -> int:
    """Post-build checks. Return process exit code (0 ok, non-zero on failure)."""
    _log("\n== Validation ==")
    hard_failures = 0

    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT key, file, distractors_json FROM concept").fetchall()

    low_distractor = 0
    for row in rows:
        # Every concept row's file must exist on disk.
        if not (out / row["file"]).is_file():
            _log(f"  HARD: concept '{row['key']}' file missing: {row['file']}")
            hard_failures += 1
        distractors = json.loads(row["distractors_json"])
        if len(distractors) < 3:
            low_distractor += 1
        for d in distractors:
            if not (out / d["file"]).is_file():
                _log(f"  HARD: distractor file missing for '{row['key']}': "
                     f"{d['file']}")
                hard_failures += 1
    conn.close()

    # Total pack size = webp + sqlite.
    total_bytes = db.stat().st_size if db.is_file() else 0
    images_dir = out / "images"
    if images_dir.is_dir():
        for f in images_dir.glob("*.webp"):
            total_bytes += f.stat().st_size
    size_mb = total_bytes / (1024 * 1024)

    _log(f"  coverage: {len(shipped)} / {total_concepts} concepts shipped")
    _log(f"  concepts with <3 distractors: {low_distractor}")
    _log(f"  pack size (webp + sqlite): {size_mb:.2f} MB")

    if hard_failures:
        _log(f"  RESULT: FAILED ({hard_failures} hard failure(s))")
    else:
        _log("  RESULT: OK")
    return 1 if hard_failures else 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--candidates", type=Path, default=Path("./candidates_a0a1"))
    ap.add_argument("--verdicts", type=Path, default=Path("verdicts.json"))
    ap.add_argument("--concepts", type=Path, default=Path("concepts_a0a1.json"))
    ap.add_argument("--out", type=Path, default=Path("./dist/imagepan"))
    args = ap.parse_args()

    candidates = args.candidates.resolve()
    out = args.out.resolve()

    if not _HAVE_REMBG:
        _log("NOTE: rembg not installed — skipping background removal. "
             "Install with `pip install rembg` for cutouts.")

    try:
        concepts = load_concepts(args.concepts.resolve())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        _log(f"ERROR: could not load concepts: {exc}")
        sys.exit(2)
    try:
        verdicts = load_verdicts(args.verdicts.resolve())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        _log(f"ERROR: could not load verdicts: {exc}")
        sys.exit(2)

    concepts_by_key = {c["key"]: c for c in concepts}

    _log(f"== Building imagepan → {out} ==")
    _log(f"concepts: {len(concepts)} · verdicts: {len(verdicts)}")

    # Process every picked concept into a webp.
    shipped: dict[str, str] = {}   # key -> 'images/<key>.webp'
    picks = 0
    for key, verdict in verdicts.items():
        if not isinstance(verdict, dict) or verdict.get("verdict") != "pick":
            continue
        picks += 1
        if key not in concepts_by_key:
            _log(f"  ! verdict for unknown concept '{key}'; skipping")
            continue
        cand = verdict.get("candidate")
        if not isinstance(cand, int) or cand < 0 or cand > 3:
            _log(f"  ! '{key}' pick has invalid candidate {cand!r}; skipping")
            continue
        src = candidates / f"{key}_{cand}.png"
        if not src.is_file():
            _log(f"  ! '{key}' source missing: {src.name}; skipping")
            continue
        dst = out / "images" / f"{key}.webp"
        if process_image(src, dst):
            shipped[key] = f"images/{key}.webp"
            _log(f"  + {key}  (candidate {cand})")

    _log(f"\nshipped {len(shipped)} / {picks} picked "
         f"({len(concepts)} total concepts)")

    # Build the SQLite database.
    db = out / "data" / "index.sqlite3"
    build_database(db, concepts_by_key, shipped, STYLE_ID)

    # Manifest + attribution.
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(
        json.dumps(MANIFEST, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    (out / "ATTRIBUTION.md").write_text(ATTRIBUTION, encoding="utf-8")

    code = validate(out, db, len(concepts), shipped)
    _log(f"\nOutput: {out}")
    sys.exit(code)


if __name__ == "__main__":
    main()
