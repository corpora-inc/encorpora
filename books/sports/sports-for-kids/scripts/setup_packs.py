"""Bootstrap pack dirs, generate_segments scripts, and segments.json for the
three Sports for Kids books in one go.

Mirrors the u10-7v7-soccer pack layout: each book has
<book>/packs/<voice>-chatterbox-v1/{manifest.json, narration.yaml, segments.json}.

Uses the goalie generate_segments.py as the canonical parser (just patches
book_id per book). Uses ttsctl init for narration.yaml scaffolding, then
post-edits voices to point at the pre-mastered (-18 LUFS) reference WAVs.
"""
from __future__ import annotations
import json, shutil, subprocess
from pathlib import Path

SERIES_ROOT = Path("/home/skyl/encorpora/books/sports/sports-for-kids")
GOALIE_GENSCRIPT = Path("/home/skyl/encorpora/books/sports/u10-7v7-soccer/02-goalie/scripts/generate_segments.py")
TTSCTL = "/home/skyl/tts_venv/bin/ttsctl"

BOOKS = [
    {
        "slug": "01-baseball",
        "book_id": "book_sports_for_kids_baseball",
        "name": "Hey, I'm Ryan, and I Play Baseball",
        "narrator": "Ryan",
        "voice_file": "pre-mastered/ryan-baseball__mastered-18.wav",
        "pack_name": "ryan-chatterbox-v1",
    },
    {
        "slug": "02-gymnastics",
        "book_id": "book_sports_for_kids_gymnastics",
        "name": "Hi, I'm Isabelle, and I Do Gymnastics",
        "narrator": "Isabelle",
        "voice_file": "pre-mastered/isabelle-gymnastic-1__mastered-18.wav",
        "pack_name": "isabelle-chatterbox-v1",
    },
    {
        "slug": "03-cheerleading",
        "book_id": "book_sports_for_kids_cheerleading",
        "name": "Hey, I'm Avery, and I'm a Cheerleader",
        "narrator": "Avery",
        "voice_file": "pre-mastered/avery-cheer-1__mastered-18.wav",
        "pack_name": "avery-chatterbox-v1",
    },
]


def make_manifest(book: dict) -> dict:
    return {
        "id": book["book_id"],
        "name": book["name"],
        "version": "0.1.0",
        "type": "book",
        "primary_language": "en",
        "metadata": {
            "series": "Sports for Kids",
            "author": "Skylar Saveland",
            "tts": True,
            "estimatedReadTime": "12-15 minutes",
            "estimatedListenTime": "12-15 minutes",
        },
    }


def install_genscript(book_dir: Path, book_id: str) -> Path:
    """Copy goalie's generate_segments.py and patch the book_id."""
    scripts_dir = book_dir / "scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)
    dest = scripts_dir / "generate_segments.py"
    src_text = GOALIE_GENSCRIPT.read_text()
    patched = src_text.replace(
        '"book_id": "book_u10_goalie"',
        f'"book_id": "{book_id}"',
    )
    dest.write_text(patched)
    dest.chmod(0o755)
    return dest


def run_genscript(book_dir: Path, gen_script: Path) -> dict:
    """Run generate_segments.py against the book's manuscript files."""
    manuscript_files = sorted((book_dir / "manuscript").glob("[0-9]*.md"))
    cmd = ["/home/skyl/tts_venv/bin/python", str(gen_script)] + [str(p) for p in manuscript_files]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  generate_segments FAILED: {res.stderr[:500]}")
        raise SystemExit(2)
    return json.loads(res.stdout)


def init_narration_yaml(pack_dir: Path) -> None:
    """Use ttsctl init to scaffold defaults."""
    res = subprocess.run([TTSCTL, "init", str(pack_dir)], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"  ttsctl init failed: {res.stderr}")
        raise SystemExit(2)


def configure_voice(pack_dir: Path, voice_file: str) -> None:
    """Edit narration.yaml to set voices: { en: <voice_file> }."""
    import yaml
    y = pack_dir / "narration.yaml"
    cfg = yaml.safe_load(y.read_text())
    cfg["voices"] = {"en": voice_file}
    # Also bump the languages list to just ["en"] for now (book starts EN-only)
    if "languages" in cfg:
        cfg["languages"] = ["en"]
    y.write_text(yaml.safe_dump(cfg, sort_keys=False))


def main() -> None:
    for book in BOOKS:
        book_dir = SERIES_ROOT / book["slug"]
        pack_dir = book_dir / "packs" / book["pack_name"]
        pack_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n=== {book['slug']} ===")

        # 1. Generate segments.json from manuscript
        gen_script = install_genscript(book_dir, book["book_id"])
        print(f"  installed {gen_script.relative_to(SERIES_ROOT)}")
        segments_output = run_genscript(book_dir, gen_script)
        seg_count = segments_output["total_segments"]
        seg_file = pack_dir / "segments.json"
        seg_file.write_text(json.dumps(segments_output, indent=2, ensure_ascii=False))
        print(f"  wrote segments.json with {seg_count} segments")

        # 2. Write manifest.json
        manifest = make_manifest(book)
        (pack_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"  wrote manifest.json (book_id={book['book_id']}, v{manifest['version']})")

        # 3. Scaffold narration.yaml
        init_narration_yaml(pack_dir)
        configure_voice(pack_dir, book["voice_file"])
        print(f"  scaffolded narration.yaml, voice={book['voice_file']}")

        # 4. Audit
        text_segs = [s for s in segments_output["segments"]
                     if s.get("block_type") not in {"heading"} or s.get("heading_level", 1) > 1]
        spoken_segs = [s for s in segments_output["segments"]
                       if s.get("tts")]
        title_only = [s for s in segments_output["segments"]
                      if s.get("block_type") == "heading" and s.get("heading_level") == 1]
        print(f"  audit: {len(title_only)} display-only headings | {len(spoken_segs)} spoken | total {seg_count}")

    print("\nDone.")


if __name__ == "__main__":
    main()
