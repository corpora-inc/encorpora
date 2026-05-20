#!/usr/bin/env python3
"""Extract Calliar word + phrase recordings into a slim SQLite-ready
record set.

This is the v0.2 pivot: stop fighting Calliar's coord system, accept
their data on its own terms (native ~100-600px tablet coords) and
expose every recording as a playable calligraphic phrase. 2500 total
samples → ~1642 unique Arabic texts after dedup → a real gallery the
learner can scroll through.

Output is consumed by `build_arabic_pack.py` and lives in DB table
`arabic_calliar_recording` (columns: id, arabic_text,
arabic_text_norm, strokes_json, stroke_count, point_count, bbox_json,
category, source_split, source_file).

Resampling: each stroke is reduced to at most 60 evenly-spaced points
(arc-length resample) — visually identical to the raw recording but
shrinks the dataset from 79 MB to about 10-15 MB before sqlite
storage. Coordinates are rounded to 2 decimals.

Categorization (lightweight, for gallery sectioning):
- "letter"  : single Arabic base character
- "word"    : no spaces, 2-5 base characters
- "phrase"  : has spaces, <= 30 displayable characters
- "sentence": has spaces, > 30 displayable characters
"""
from __future__ import annotations

import json
import os
import pathlib
import re
import sys
import unicodedata
from typing import Dict, List, Optional, Tuple

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
DATASET = HERE / "vendor" / "calliar" / "extracted" / "dataset"

# Resample knob: max points per stroke. 60 captures all calligraphic
# curvature at 600x600 canvas resolution; larger doesn't improve
# perceived smoothness but bloats the bundle.
MAX_POINTS_PER_STROKE = 60

# Strip Arabic diacritics + tatweel during text normalization, so
# "بِسْمِ ٱللَّٰهِ" matches "بسم الله" for gallery dedup.
DIACRITICS_RE = re.compile(r"[ً-ٰٟـ]")

# Category thresholds — see module docstring.
WORD_MAX_CHARS = 5
PHRASE_MAX_CHARS = 30


def normalize_arabic(text: str) -> str:
    """NFKC + strip diacritics/tatweel + collapse whitespace."""
    s = unicodedata.normalize("NFKC", text or "")
    s = DIACRITICS_RE.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def categorize(text: str) -> str:
    """Bucket the Arabic text for gallery sectioning."""
    norm = normalize_arabic(text)
    if not norm:
        return "phrase"
    no_space = norm.replace(" ", "")
    if len(no_space) <= 1:
        return "letter"
    if " " not in norm and len(no_space) <= WORD_MAX_CHARS:
        return "word"
    if len(norm) <= PHRASE_MAX_CHARS:
        return "phrase"
    return "sentence"


def parse_filename_text(filename: str) -> Optional[str]:
    """Calliar filenames are '{arabic_text}_{index}.json'. Some have
    leading whitespace (e.g. ' اقرا_0.json'); strip them. Returns the
    Arabic portion before the final '_<digits>.json' tail."""
    m = re.match(r"^\s*(.+?)\s*_\d+\.json$", filename)
    if not m:
        return None
    return m.group(1).strip()


def resample_arc_length(pts: np.ndarray, n_max: int) -> np.ndarray:
    """Resample a polyline to at most `n_max` evenly-spaced points by
    arc length. Single-point and 2-point strokes pass through (they
    encode dots / very short marks that the renderer treats as ticks)."""
    if len(pts) <= 2:
        return pts
    if len(pts) <= n_max:
        return pts
    diffs = np.diff(pts, axis=0)
    seg_lens = np.sqrt((diffs ** 2).sum(axis=1))
    cum = np.concatenate([[0.0], np.cumsum(seg_lens)])
    total = cum[-1]
    if total < 1e-6:
        # Degenerate stroke (all points coincide); return the centroid.
        return pts[:1]
    target = np.linspace(0.0, total, n_max)
    xs = np.interp(target, cum, pts[:, 0])
    ys = np.interp(target, cum, pts[:, 1])
    return np.stack([xs, ys], axis=1)


def slim_strokes(raw_strokes: List[Dict[str, List[List[float]]]]) -> List[List[List[float]]]:
    """Calliar's format is a list of single-key dicts: each dict's key
    is a character/stroke label and the value is the [x, y] point array.
    We don't need the labels for playback — just the point arrays in
    order. Return [[ [x, y], ... ], ...]."""
    out: List[List[List[float]]] = []
    for entry in raw_strokes:
        if not isinstance(entry, dict) or not entry:
            continue
        # Take the first (and typically only) value.
        pts = next(iter(entry.values()))
        if not pts:
            continue
        arr = np.asarray(pts, dtype=float)
        if arr.ndim != 2 or arr.shape[1] < 2:
            continue
        # Drop any explicit z/pen-state column (Calliar's online
        # recordings sometimes carry one extra dimension).
        arr = arr[:, :2]
        arr = resample_arc_length(arr, MAX_POINTS_PER_STROKE)
        # Round to 2 decimal places to shrink JSON size.
        out.append([[round(float(x), 2), round(float(y), 2)] for x, y in arr])
    return out


def bbox_of(strokes: List[List[List[float]]]) -> List[float]:
    """[minX, minY, maxX, maxY] across all strokes."""
    xs: List[float] = []
    ys: List[float] = []
    for s in strokes:
        for x, y in s:
            xs.append(x)
            ys.append(y)
    if not xs:
        return [0.0, 0.0, 0.0, 0.0]
    return [min(xs), min(ys), max(xs), max(ys)]


def slug(text: str) -> str:
    """Lowercase Latin-only slug for the row id. Hashes if there's
    nothing Latin-y to lift out."""
    # Keep only Arabic-script alphanumerics that survive transliteration;
    # since this is for an SQL id we just hash the normalized text.
    import hashlib
    h = hashlib.sha1(normalize_arabic(text).encode("utf-8")).hexdigest()[:10]
    return f"cal_{h}"


def load_all_samples() -> List[Dict]:
    """Scan train/valid/test for every .json sample. Return parsed
    records ready to write to the DB. Picks ONE recording per
    normalized Arabic text — preferring train, then valid, then test;
    among those, the sample with the FEWEST strokes per character
    (most calligraphic; over-detailed renderings may have spurious
    repeats)."""
    if not DATASET.is_dir():
        print(f"[fatal] Calliar dataset not found at {DATASET}", file=sys.stderr)
        sys.exit(1)

    # First pass: group all candidate samples by normalized text.
    by_norm: Dict[str, List[Tuple[str, str, str]]] = {}
    for split in ("train", "valid", "test"):
        split_dir = DATASET / split
        if not split_dir.is_dir():
            continue
        for fname in sorted(os.listdir(split_dir)):
            if not fname.endswith(".json"):
                continue
            text = parse_filename_text(fname)
            if not text:
                continue
            norm = normalize_arabic(text)
            if not norm:
                continue
            by_norm.setdefault(norm, []).append((split, fname, text))

    # Second pass: pick the canonical sample per text and slim it.
    split_priority = {"train": 0, "valid": 1, "test": 2}
    records: List[Dict] = []
    skipped_empty = 0
    for norm, candidates in by_norm.items():
        candidates.sort(key=lambda c: (split_priority.get(c[0], 9), c[1]))
        best_record: Optional[Dict] = None
        best_score = -1.0
        for split, fname, display_text in candidates:
            path = DATASET / split / fname
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                print(f"[warn] failed to read {path}: {exc}", file=sys.stderr)
                continue
            if not isinstance(raw, list) or not raw:
                continue
            strokes = slim_strokes(raw)
            if not strokes:
                continue
            point_count = sum(len(s) for s in strokes)
            if point_count < 10:
                # Truncated or junk recording.
                continue
            # Prefer the recording with the highest point count per
            # stroke (smoother), capped to avoid favoring noise.
            score = min(point_count / max(len(strokes), 1), 60.0)
            if score > best_score:
                best_score = score
                best_record = {
                    "id": slug(display_text),
                    "arabic_text": display_text,
                    "arabic_text_norm": norm,
                    "strokes_json": json.dumps(strokes, ensure_ascii=False),
                    "stroke_count": len(strokes),
                    "point_count": point_count,
                    "bbox_json": json.dumps(bbox_of(strokes)),
                    "category": categorize(display_text),
                    "source_split": split,
                    "source_file": fname,
                }
        if best_record:
            records.append(best_record)
        else:
            skipped_empty += 1

    if skipped_empty:
        print(f"[info] skipped {skipped_empty} texts with no usable recording", file=sys.stderr)
    return records


def main() -> None:
    records = load_all_samples()
    print(f"Extracted {len(records)} unique Calliar recordings")
    counts = {}
    for r in records:
        counts[r["category"]] = counts.get(r["category"], 0) + 1
    print(f"  By category: {counts}")
    total_bytes = sum(len(r["strokes_json"].encode("utf-8")) for r in records)
    print(f"  Total strokes_json bytes: {total_bytes:,} (~{total_bytes / 1024 / 1024:.1f} MB)")

    # Write a JSON dump for build_arabic_pack.py to pick up.
    out = HERE / "vendor" / "calliar_recordings.json"
    out.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
