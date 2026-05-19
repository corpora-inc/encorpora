#!/usr/bin/env python3
"""Extract the canonical Bismillah trajectory from Calliar's 62 recordings.

Bismillah ("بسم الله الرحمن الرحيم" — In the name of God, the Most
Gracious, the Most Merciful) is the Qur'anic opening phrase and the
first multi-letter phrase Arabic-calligraphy students traditionally
learn. Calliar's authors curated 62 recordings of it explicitly
(see upstream `notebooks/Collect bism allah.ipynb`).

Each recording is a 23-stroke trajectory with an identical primitive
sequence across writers:
    ٮ . س م ا ل ل ه ا ل ر ح م . ں ا ل ر ح ى . . م

This script:
  1. Loads all Bismillah sample JSONs.
  2. Filters to samples with the expected 23-stroke pattern (rejects
     truncated or extended recordings).
  3. Picks the median sample by total path length — biased toward
     the "typical" calligrapher, away from speed-typists and
     flourished masters.
  4. Normalizes the trajectory to a wide 2000×500 viewBox so the
     phrase reads as a horizontal line at the canvas's natural
     aspect ratio (rather than getting squished into the
     letter-square 1000×1000 viewBox).
  5. Writes `build/seed/phrases_seed.json` with the result, in a
     shape the lesson runner can consume:
        { phrase_ar, viewbox, strokes: [[ [x,y], ... ], ...] }
"""

import json
import math
import pathlib
import statistics
from typing import List, Optional, Tuple

HERE = pathlib.Path(__file__).resolve().parent
CALLIAR_ROOT = HERE / "vendor" / "calliar" / "extracted" / "dataset"
OUT_SEED = HERE / "seed" / "phrases_seed.json"

# Bismillah phrase — keep the Arabic verbatim so the lesson card
# can render it with Amiri at large size.
BISMILLAH_AR = "بسم الله الرحمن الرحيم"

# Calliar's primitive sequence for Bismillah (verified across 52+
# samples in the dataset). Used as a tag-multiset filter to reject
# samples that include extra strokes or have different annotation.
EXPECTED_SEQUENCE = [
    "ٮ", ".", "س", "م", "ا", "ل", "ل", "ه", "ا", "ل",
    "ر", "ح", "م", ".", "ں", "ا", "ل", "ر", "ح", "ى",
    ".", ".", "م",
]

# Output viewBox — wide-and-short to match the natural aspect of
# Arabic written across a line. The lesson card renders this with
# letterboxing if its native aspect doesn't match.
VBW = 2000.0
VBH = 500.0
PADDING = 60.0


def path_length(pts: List[List[float]]) -> float:
    return sum(
        math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1])
        for i in range(1, len(pts))
    )


def load_bismillah_samples() -> List[Tuple[str, list]]:
    """Walk all three splits, return (filename, sample) pairs for
    files whose name contains 'بسم الله الرحمن الرحيم'."""
    out = []
    for split in ("train", "valid", "test"):
        d = CALLIAR_ROOT / split
        if not d.exists():
            continue
        for jf in d.glob("*.json"):
            if "بسم الله الرحمن الرحيم" not in jf.name:
                continue
            try:
                data = json.loads(jf.read_text())
            except Exception:  # noqa: BLE001
                continue
            if isinstance(data, list):
                out.append((jf.name, data))
    return out


def sample_matches(sample: list, expected: list) -> Optional[List[List[List[float]]]]:
    """If the sample's stroke tags match the expected primitive
    sequence exactly, return the list of polylines (each a list of
    [x,y] points). Otherwise return None."""
    if not isinstance(sample, list) or len(sample) != len(expected):
        return None
    strokes = []
    for i, stroke in enumerate(sample):
        if not isinstance(stroke, dict) or len(stroke) != 1:
            return None
        (k, pts), = stroke.items()
        if k != expected[i]:
            return None
        if not isinstance(pts, list) or not pts:
            return None
        strokes.append(pts)
    return strokes


def normalize_to_viewbox(strokes, vbw=VBW, vbh=VBH, pad=PADDING):
    """Translate + uniformly scale so the combined bbox fits centered
    within the viewBox (minus padding), preserving aspect ratio.

    Calliar coords are screen-pixel (origin top-left, Y grows down) —
    same convention rasmapan uses. No Y-flip.
    """
    all_pts = [p for s in strokes for p in s]
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    w = max(1.0, x1 - x0)
    h = max(1.0, y1 - y0)
    inner_w = vbw - 2 * pad
    inner_h = vbh - 2 * pad
    scale = min(inner_w / w, inner_h / h)
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    tx = vbw / 2 - cx * scale
    ty = vbh / 2 - cy * scale
    return [
        [[p[0] * scale + tx, p[1] * scale + ty] for p in stroke]
        for stroke in strokes
    ]


def resample(stroke, n=18):
    """Even-arc-length resampling. Dots (single point) pass through
    unchanged."""
    if len(stroke) <= 1:
        return [[float(p[0]), float(p[1])] for p in stroke]
    if len(stroke) <= 2:
        return [[float(p[0]), float(p[1])] for p in stroke]
    total = path_length(stroke)
    if total < 1e-3:
        return [[float(stroke[0][0]), float(stroke[0][1])]]
    step = total / (n - 1)
    out = [[float(stroke[0][0]), float(stroke[0][1])]]
    target = step
    accum = 0.0
    for i in range(1, len(stroke)):
        ax, ay = stroke[i - 1]
        bx, by = stroke[i]
        seg = math.hypot(bx - ax, by - ay)
        while accum + seg >= target and len(out) < n - 1:
            t = (target - accum) / seg if seg > 1e-6 else 0
            out.append([ax + (bx - ax) * t, ay + (by - ay) * t])
            target += step
        accum += seg
    out.append([float(stroke[-1][0]), float(stroke[-1][1])])
    return out


def main() -> None:
    samples = load_bismillah_samples()
    print(f"Found {len(samples)} Bismillah recordings in Calliar")

    matched = []
    for name, sample in samples:
        strokes = sample_matches(sample, EXPECTED_SEQUENCE)
        if strokes is None:
            continue
        total = sum(path_length(s) for s in strokes)
        matched.append((total, name, strokes))
    print(f"  {len(matched)} samples match the expected 23-stroke sequence")

    if not matched:
        raise SystemExit("No Bismillah samples matched the expected primitive sequence")

    # Median sample by total path length — central calligrapher.
    matched.sort(key=lambda r: r[0])
    median_idx = len(matched) // 2
    _, canonical_name, canonical_strokes = matched[median_idx]
    print(f"  canonical pick (median path-length): {canonical_name}")

    # Normalize as a UNIT — preserve relative position of every stroke.
    normalized = normalize_to_viewbox(canonical_strokes)
    # Resample multi-point strokes; pass dots through.
    resampled = [
        resample(s, 22) if len(s) >= 3 else [[float(s[0][0]), float(s[0][1])]]
        for s in normalized
    ]

    out = {
        "phrases": [
            {
                "id": "bismillah",
                "phrase_ar": BISMILLAH_AR,
                "transliteration": "Bismillāh ar-Raḥmān ar-Raḥīm",
                "translation_en": "In the name of God, the Most Gracious, the Most Merciful",
                "viewbox": [VBW, VBH],
                "strokes": resampled,
                "primitive_sequence": EXPECTED_SEQUENCE,
                "source": "Calliar (MIT, https://github.com/ARBML/Calliar)",
            }
        ]
    }
    OUT_SEED.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    sizes = [len(s) for s in resampled]
    print(f"  wrote {len(resampled)} strokes, sizes={sizes}")
    print(f"  → {OUT_SEED.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    main()
