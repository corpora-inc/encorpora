#!/usr/bin/env python3
"""
Build a Corpán phrase pack (data.sqlite3 + manifest.json) from a flat
input directory.

Input layout
------------
    <input>/
        pack.json                # pack metadata (see PACK_FIELDS below)
        phrases.json             # list of {"english": "...", "level": "A1"}
        translations/
            es.json              # optional per-language translation files
            fr.json
            ...

Each translation file is keyed by the *index* of the phrase in phrases.json
(as a JSON string):
    { "0": {"text": "...", "romanization": null}, "1": {...}, ... }

Missing translations are filled by `--placeholder` (a debug-only marker)
or hard-fail with `--strict`.

Output
------
    <out>/
        data.sqlite3             # phrase pack DB per the canonical schema
        manifest.json            # mirror of pack_meta + databases map

CLI
---
    python build_phrase_pack.py <input-dir>
        [--out <output-dir>]            # default: <input-dir>/build
        [--placeholder | --strict]      # how to handle missing translations
        [--langs en,es,fr,...]          # override target language coverage
                                          (default: full 54-language set)
        [--quiet]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import sys
import time
from pathlib import Path
from typing import Iterable

SCHEMA_VERSION = 2  # v2 (2026-05-31): adds entries_fts (FTS5 over english).
                   # v1 packs still readable — clients fall back to LIKE search
                   # when entries_fts is absent. See Tutomaton phrase-bridge for
                   # the dual-mode consumer pattern.
APPLICATION_ID = 0x434F5250  # "CORP"

# Mirrors corpan-app/src/store/settings.ts :: ALL_LANGUAGES.
# If that list grows, update here too — `--langs` overrides for one-off packs.
DEFAULT_LANGS: tuple[str, ...] = (
    "en", "es", "ca", "fr", "it", "ro", "pt-PT", "pt-BR",
    "de", "nl", "no", "sv", "da", "fi", "hu",
    "lt", "pl", "cs", "sk", "sl", "hr", "sr", "bg", "uk", "ru",
    "el", "tr",
    "he", "ar", "fa", "ur", "pa-Arab",
    "pa-Guru", "hi", "ne", "bn", "mr", "gu", "kn", "te", "ta",
    "th", "vi", "id", "jv", "su", "ms", "tl",
    "sw",
    "zh-Hans", "zh-Hant", "yue-Hant-HK", "ko-polite", "ja",
)

REQUIRED_PACK_FIELDS = ("id", "version", "name")
OPTIONAL_PACK_FIELDS = (
    "description",
    "category",
    "topic",
    "level_min",
    "level_max",
    "icon",
    "accent_color",
)


def build_pack(
    input_dir: Path,
    out_dir: Path,
    *,
    placeholder: bool,
    strict: bool,
    target_langs: tuple[str, ...],
    quiet: bool = False,
) -> Path:
    log = (lambda *_a, **_k: None) if quiet else print

    meta = _read_json(input_dir / "pack.json")
    _validate_meta(meta)
    phrases = _read_json(input_dir / "phrases.json")
    _validate_phrases(phrases)

    translations_dir = input_dir / "translations"
    per_lang: dict[str, dict[str, dict]] = {}
    for lang in target_langs:
        candidate = translations_dir / f"{lang}.json"
        if candidate.is_file():
            per_lang[lang] = _read_json(candidate)
        else:
            per_lang[lang] = {}

    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "data.sqlite3"
    manifest_path = out_dir / "manifest.json"
    if db_path.exists():
        db_path.unlink()

    levels = sorted({p["level"] for p in phrases if p.get("level")})
    level_min = meta.get("level_min") or (levels[0] if levels else "A1")
    level_max = meta.get("level_max") or (levels[-1] if levels else "C2")

    log(f"[build] {meta['id']} {meta['version']}  "
        f"phrases={len(phrases)}  langs={len(target_langs)}")

    conn = sqlite3.connect(str(db_path))
    try:
        _write_schema(conn)
        conn.executemany(
            "INSERT INTO entries (id, english, level) VALUES (?, ?, ?)",
            [
                (i, p["english"], p.get("level"))
                for i, p in enumerate(phrases)
            ],
        )
        # Populate the FTS5 mirror of entries.english. Contentless table reads
        # source from `entries` (content='entries' in the CREATE), so the
        # `INSERT INTO entries_fts(entries_fts) VALUES('rebuild')` command
        # builds the inverted index in one shot. Adds ~5-15% to pack size.
        conn.execute("INSERT INTO entries_fts(entries_fts) VALUES('rebuild')")
        rows: list[tuple[int, str, str, str | None]] = []
        missing: list[tuple[int, str]] = []
        for i, phrase in enumerate(phrases):
            english = phrase["english"]
            for lang in target_langs:
                tr = per_lang[lang].get(str(i))
                if tr is None:
                    if strict:
                        missing.append((i, lang))
                        continue
                    if placeholder:
                        rows.append((i, lang, f"[{lang}] {english}", None))
                    # else: silently skip — pack ships partial language coverage
                    continue
                text = tr.get("text")
                if not text:
                    if strict:
                        missing.append((i, lang))
                        continue
                    if placeholder:
                        rows.append((i, lang, f"[{lang}] {english}", None))
                    continue
                rom = tr.get("romanization") or None
                rows.append((i, lang, text, rom))

        if strict and missing:
            head = ", ".join(f"{i}/{lang}" for i, lang in missing[:5])
            raise SystemExit(
                f"--strict: {len(missing)} missing translation(s); "
                f"first 5: {head}"
            )

        conn.executemany(
            "INSERT INTO translations (entry_id, language_code, text, romanization) "
            "VALUES (?, ?, ?, ?)",
            rows,
        )

        # Authored language coverage = the langs we actually wrote rows for.
        # In placeholder mode this is all of target_langs; in real-translation
        # mode it's whatever the author provided.
        covered = sorted({r[1] for r in rows})
        conn.execute(
            """
            INSERT INTO pack_meta (
                id, version, schema_version, name, description,
                category, topic, level_min, level_max,
                entry_count, language_codes, authored_at, icon, accent_color
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                meta["id"],
                meta["version"],
                SCHEMA_VERSION,
                meta["name"],
                meta.get("description", ""),
                meta.get("category", "uncategorized"),
                meta.get("topic", meta["name"]),
                level_min,
                level_max,
                len(phrases),
                json.dumps(covered),
                time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                meta.get("icon"),
                meta.get("accent_color"),
            ),
        )
        conn.commit()
        conn.execute("ANALYZE")
        conn.execute("VACUUM")
    finally:
        conn.close()

    # Open in append mode after VACUUM (which would have rebuilt the DB) to
    # set the PRAGMAs we care about. application_id + user_version must be
    # set on the live file; page_size is set at create time but we re-state
    # it for clarity in case the source-tree default differs.
    final = sqlite3.connect(str(db_path))
    try:
        final.execute(f"PRAGMA application_id = {APPLICATION_ID}")
        final.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        final.commit()
    finally:
        final.close()

    manifest = {
        "id": meta["id"],
        "version": meta["version"],
        "packType": "phrase",
        "name": meta["name"],
        "description": meta.get("description", ""),
        "category": meta.get("category", "uncategorized"),
        "topic": meta.get("topic", meta["name"]),
        "levelMin": level_min,
        "levelMax": level_max,
        "entryCount": len(phrases),
        "languageCount": len(covered),
        "languageCodes": covered,
        "icon": meta.get("icon"),
        "accentColor": meta.get("accent_color"),
        "schemaVersion": SCHEMA_VERSION,
        "databases": {"main": "data.sqlite3"},
    }
    # Forward optional publishing fields from pack.json so the publisher's
    # catalog-upsert path can read them straight out of the manifest. Each
    # is omitted when not declared in pack.json.
    #
    # - purchase: {"type": "free" | "iap" | "code", productId?, priceLabel?}
    # - tags: ["starter", "editors-pick", "new", ...]
    # - minAppVersion: "0.15.0" (default applied by publish.py if missing)
    # - channel: "stable" | "preview"
    # - iconUrl: full CDN URL to a cover image
    for key, source_key in (
        ("purchase", "purchase"),
        ("tags", "tags"),
        ("minAppVersion", "min_app_version"),
        ("channel", "channel"),
        ("iconUrl", "icon_url"),
        # Localized metadata maps (Corpán-app 0.15.3+). Snake-case in
        # pack.json, camelCase in manifest. The resolver in
        # phrasePackCatalog.ts :: resolveLocalized walks these maps
        # with a 5-tier fallback (exact → base-lang → zh-script →
        # en → bare field).
        ("nameLocalized", "name_localized"),
        ("descriptionLocalized", "description_localized"),
        ("topicLocalized", "topic_localized"),
    ):
        if source_key in meta and meta[source_key] is not None:
            manifest[key] = meta[source_key]
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))

    size = db_path.stat().st_size
    sha = _sha256(db_path)
    log(f"[build] wrote {db_path}  size={size:>9} bytes  sha256={sha[:12]}…")
    log(f"[build] wrote {manifest_path}")
    return out_dir


# ---------- helpers ---------- #

def _write_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA page_size = 8192;
        PRAGMA encoding = 'UTF-8';
        PRAGMA journal_mode = OFF;

        CREATE TABLE pack_meta (
            id              TEXT PRIMARY KEY,
            version         TEXT NOT NULL,
            schema_version  INTEGER NOT NULL,
            name            TEXT NOT NULL,
            description     TEXT,
            category        TEXT,
            topic           TEXT,
            level_min       TEXT,
            level_max       TEXT,
            entry_count     INTEGER NOT NULL,
            language_codes  TEXT NOT NULL,
            authored_at     TEXT NOT NULL,
            icon            TEXT,
            accent_color    TEXT
        );

        CREATE TABLE entries (
            id       INTEGER PRIMARY KEY,
            english  TEXT NOT NULL,
            level    TEXT
        );

        CREATE TABLE translations (
            entry_id       INTEGER NOT NULL,
            language_code  TEXT NOT NULL,
            text           TEXT NOT NULL,
            romanization   TEXT,
            PRIMARY KEY (entry_id, language_code)
        ) WITHOUT ROWID;

        CREATE INDEX idx_entries_level ON entries(level);

        -- FTS5 over the english column. Tutomaton's phrase-bridge (and any
        -- future reader that does cross-pack lexical search) uses bm25(entries_fts)
        -- for ranking; falls back to LIKE for v1 packs that lack this table.
        -- Built as a contentless table populated from entries below (cheap
        -- ~5-15% pack size; no triggers needed since phrase packs are
        -- write-once: built, sealed, shipped, never mutated).
        CREATE VIRTUAL TABLE entries_fts USING fts5(
            english,
            content='entries',
            content_rowid='id'
        );
        """
    )


def _read_json(path: Path) -> dict | list:
    if not path.is_file():
        raise SystemExit(f"missing input file: {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"invalid JSON in {path}: {e}")


def _validate_meta(meta: dict) -> None:
    for f in REQUIRED_PACK_FIELDS:
        if not meta.get(f):
            raise SystemExit(f"pack.json missing required field: {f}")
    pid = meta["id"]
    if not pid.startswith("phrase-"):
        raise SystemExit(
            f"pack id must start with 'phrase-' (got {pid!r}); see "
            "PHRASE_PACK_AUTHORING.md for the naming convention"
        )
    if any(c.isupper() or c == "_" for c in pid):
        raise SystemExit(
            f"pack id must be kebab-case, lowercase, no underscores (got {pid!r})"
        )


def _validate_phrases(phrases: list) -> None:
    if not isinstance(phrases, list):
        raise SystemExit("phrases.json must be a JSON array")
    if not phrases:
        raise SystemExit("phrases.json is empty — pack would have no entries")
    for i, p in enumerate(phrases):
        if not isinstance(p, dict) or "english" not in p:
            raise SystemExit(f"phrases[{i}] missing 'english' field")
        if not p["english"].strip():
            raise SystemExit(f"phrases[{i}] has empty english text")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


# ---------- CLI ---------- #

def _parse_langs(arg: str | None) -> tuple[str, ...]:
    if not arg:
        return DEFAULT_LANGS
    out = tuple(s.strip() for s in arg.split(",") if s.strip())
    if not out:
        raise SystemExit("--langs cannot be empty")
    return out


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_dir", help="Path to the pack input directory")
    parser.add_argument("--out", help="Output directory (default <input>/build)")
    g = parser.add_mutually_exclusive_group()
    g.add_argument("--placeholder", action="store_true", help="Fill missing translations with [<lang>] <english> marker (debug only)")
    g.add_argument("--strict", action="store_true", help="Hard-fail on any missing translation")
    parser.add_argument("--langs", help="Comma-separated target language codes (default: full 54-language set)")
    parser.add_argument("--quiet", action="store_true")
    ns = parser.parse_args(argv)

    input_dir = Path(ns.input_dir).resolve()
    if not input_dir.is_dir():
        raise SystemExit(f"input directory not found: {input_dir}")
    out_dir = Path(ns.out).resolve() if ns.out else (input_dir / "build")
    target_langs = _parse_langs(ns.langs)

    build_pack(
        input_dir,
        out_dir,
        placeholder=ns.placeholder,
        strict=ns.strict,
        target_langs=target_langs,
        quiet=ns.quiet,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
