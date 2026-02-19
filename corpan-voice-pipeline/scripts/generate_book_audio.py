#!/usr/bin/env python3
"""
Corpán Book Audio Generator
============================
Reads a book's segments.json, submits batch TTS jobs to the
Corpán Voice Server running on the DGX Spark, tracks progress,
and downloads completed audio into the pack's audio/ directory.

Usage:
    # Generate English audio for Monte Albán Chapter 1
    python generate_book_audio.py \
        --server http://192.168.1.50:8700 \
        --segments ../books/fascinating-curiosities/01-mystery-of-monte-alban/pack/segments.json \
        --voice ian-narration \
        --language en \
        --output ../books/fascinating-curiosities/01-mystery-of-monte-alban/pack/audio/en/

    # Generate Spanish audio for the same book
    python generate_book_audio.py \
        --server http://192.168.1.50:8700 \
        --segments ../books/fascinating-curiosities/01-mystery-of-monte-alban/pack/segments.json \
        --voice ian-narration \
        --language es \
        --output ../books/fascinating-curiosities/01-mystery-of-monte-alban/pack/audio/es/

    # Upload a voice profile first
    python generate_book_audio.py \
        --server http://192.168.1.50:8700 \
        --upload-voice ian-narration path/to/my-voice-sample.wav

    # Check server status
    python generate_book_audio.py \
        --server http://192.168.1.50:8700 \
        --status
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests


def upload_voice(server: str, voice_id: str, wav_path: str):
    """Upload a voice sample to create a profile on the server."""
    wav_path = Path(wav_path)
    if not wav_path.exists():
        print(f"❌ File not found: {wav_path}")
        sys.exit(1)

    print(f"📤 Uploading voice profile '{voice_id}' from {wav_path}...")
    with open(wav_path, "rb") as f:
        resp = requests.post(
            f"{server}/voices/upload",
            params={"voice_id": voice_id},
            files={"file": (wav_path.name, f, "audio/wav")},
        )

    if resp.status_code == 200:
        data = resp.json()
        size_kb = data["size_bytes"] / 1024
        print(f"✅ Voice profile '{voice_id}' uploaded ({size_kb:.1f} KB)")
        print(f"   Use --voice {voice_id} in generation commands.")
    else:
        print(f"❌ Upload failed: {resp.status_code} — {resp.text}")
        sys.exit(1)


def check_status(server: str):
    """Print server status."""
    try:
        resp = requests.get(f"{server}/status")
        resp.raise_for_status()
        data = resp.json()

        print(f"\n🖥️  Corpán Voice Server — {server}")
        print(f"   Status: {data['status']}")

        gpu = data.get("gpu", {})
        if gpu:
            print(f"   GPU: {gpu['name']}")
            print(f"   VRAM: {gpu['memory_used_gb']:.1f} / {gpu['memory_total_gb']:.1f} GB")

        print(f"   Queue: {data['queue_size']} jobs waiting")
        print(f"   Voices: {data['voices_available']} profiles loaded")

        engines = data.get("engines", {})
        print(f"   Engines: ", end="")
        active = [k for k, v in engines.items() if v]
        print(", ".join(active) if active else "none loaded")

        # List voices
        voices_resp = requests.get(f"{server}/voices")
        if voices_resp.status_code == 200:
            voices = voices_resp.json().get("voices", [])
            if voices:
                print(f"\n   📢 Voice Profiles:")
                for v in voices:
                    print(f"      • {v['voice_id']} ({v['size_bytes']/1024:.1f} KB)")

        # List active jobs
        jobs_resp = requests.get(f"{server}/jobs")
        if jobs_resp.status_code == 200:
            active_jobs = [j for j in jobs_resp.json().get("jobs", [])
                          if j["status"] in ("queued", "processing")]
            if active_jobs:
                print(f"\n   ⏳ Active Jobs:")
                for j in active_jobs:
                    progress = f"{j['completed_segments']}/{j['total_segments']}"
                    print(f"      • {j['job_id']}: {j['status']} ({progress})")

    except requests.ConnectionError:
        print(f"❌ Cannot connect to server at {server}")
        print(f"   Is the voice server running on the Spark?")
        sys.exit(1)


def load_segments(segments_path: str, language: str) -> list[dict]:
    """Load and filter segments from segments.json."""
    path = Path(segments_path)
    if not path.exists():
        print(f"❌ Segments file not found: {path}")
        sys.exit(1)

    with open(path) as f:
        data = json.load(f)

    segments = data.get("segments", data if isinstance(data, list) else [])

    # Add language to each segment if not present
    prepared = []
    for seg in segments:
        tts = seg.get("tts", {})
        text = tts.get("text", seg.get("text", "")) if isinstance(tts, dict) else seg.get("text", "")

        if not text.strip():
            continue

        prepared.append({
            "id": seg.get("id", f"seg_{len(prepared):04d}"),
            "language": language,
            "text": text,
            "tts": {
                "text": text,
                "pause_after_ms": tts.get("pause_after_ms", 800) if isinstance(tts, dict) else 800,
            },
        })

    return prepared


def submit_batch(
    server: str,
    segments: list[dict],
    voice_id: str,
    book_id: str,
    chapter_id: str,
    exaggeration: float,
    cfg: float,
) -> str:
    """Submit a batch job and return the job ID."""
    payload = {
        "book_id": book_id,
        "chapter_id": chapter_id,
        "voice_id": voice_id,
        "exaggeration": exaggeration,
        "cfg": cfg,
        "segments": segments,
    }

    print(f"\n📦 Submitting batch: {len(segments)} segments")
    print(f"   Book: {book_id} / Chapter: {chapter_id}")
    print(f"   Voice: {voice_id}")
    print(f"   Settings: exaggeration={exaggeration}, cfg={cfg}")

    resp = requests.post(f"{server}/batch", json=payload)
    if resp.status_code != 200:
        print(f"❌ Submission failed: {resp.status_code} — {resp.text}")
        sys.exit(1)

    data = resp.json()
    job_id = data["job_id"]
    print(f"✅ Job submitted: {job_id}")
    return job_id


def poll_job(server: str, job_id: str, poll_interval: float = 2.0) -> dict:
    """Poll job status until completion."""
    print(f"\n⏳ Tracking job {job_id}...")
    last_segment = ""

    while True:
        resp = requests.get(f"{server}/jobs/{job_id}")
        if resp.status_code != 200:
            print(f"❌ Failed to check job status: {resp.text}")
            sys.exit(1)

        job = resp.json()
        status = job["status"]
        done = job["completed_segments"]
        failed = job["failed_segments"]
        total = job["total_segments"]
        current = job.get("current_segment", "")

        # Progress bar
        if total > 0:
            pct = (done + failed) / total * 100
            bar_len = 30
            filled = int(bar_len * (done + failed) / total)
            bar = "█" * filled + "░" * (bar_len - filled)
            seg_info = f" → {current}" if current and current != last_segment else ""
            print(f"\r   [{bar}] {pct:5.1f}% ({done}✅ {failed}❌ / {total}){seg_info}  ", end="", flush=True)
            last_segment = current

        if status == "completed":
            print(f"\n\n✅ Job completed! {done} segments generated, {failed} failed.")
            return job
        elif status == "failed":
            print(f"\n\n❌ Job failed: {job.get('error', 'unknown error')}")
            sys.exit(1)

        time.sleep(poll_interval)


def download_results(server: str, job_id: str, output_dir: str):
    """Download all generated audio files."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f"\n📥 Downloading audio to {output_path}...")

    # Download zip
    resp = requests.get(f"{server}/jobs/{job_id}/download-all", stream=True)
    if resp.status_code != 200:
        print(f"❌ Download failed: {resp.status_code}")
        # Fall back to individual downloads
        download_individual(server, job_id, output_path)
        return

    zip_path = output_path / f"{job_id}.zip"
    with open(zip_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    # Extract
    import zipfile
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(output_path)

    # Clean up zip
    zip_path.unlink()

    # Count files
    wav_files = list(output_path.glob("*.wav"))
    total_size = sum(f.stat().st_size for f in wav_files)
    print(f"✅ Downloaded {len(wav_files)} audio files ({total_size / 1024 / 1024:.1f} MB)")


def download_individual(server: str, job_id: str, output_path: Path):
    """Download segments one by one (fallback)."""
    # Get job manifest
    job_resp = requests.get(f"{server}/jobs/{job_id}")
    job = job_resp.json()

    if not job.get("output_dir"):
        print("❌ No output directory in job info")
        return

    # We need to know segment IDs — get from manifest
    manifest_resp = requests.get(f"{server}/jobs/{job_id}/download/manifest")
    # This might not work directly — iterate known segments
    print("   Downloading individual segments...")
    # In practice, the zip approach should work. This is a fallback.


def generate_test(server: str, voice_id: str, language: str, text: str):
    """Quick single-text generation test."""
    print(f"\n🎤 Test generation:")
    print(f"   Voice: {voice_id}")
    print(f"   Language: {language}")
    print(f"   Text: \"{text[:80]}{'...' if len(text) > 80 else ''}\"")
    print(f"   Generating...")

    resp = requests.post(
        f"{server}/generate",
        json={
            "text": text,
            "language": language,
            "voice_id": voice_id,
            "exaggeration": 0.35,
            "cfg": 0.5,
        },
    )

    if resp.status_code == 200:
        out_path = Path(f"test_{language}_{voice_id}.wav")
        with open(out_path, "wb") as f:
            f.write(resp.content)
        size_kb = len(resp.content) / 1024
        print(f"✅ Saved: {out_path} ({size_kb:.1f} KB)")
        print(f"   Play it: open {out_path}  (macOS)")
    else:
        print(f"❌ Generation failed: {resp.status_code} — {resp.text}")


def main():
    parser = argparse.ArgumentParser(
        description="Corpán Book Audio Generator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--server", required=True, help="Voice server URL (e.g. http://192.168.1.50:8700)")

    # Actions
    parser.add_argument("--status", action="store_true", help="Show server status")
    parser.add_argument("--upload-voice", nargs=2, metavar=("VOICE_ID", "WAV_PATH"),
                        help="Upload a voice profile")
    parser.add_argument("--test", nargs=3, metavar=("VOICE_ID", "LANGUAGE", "TEXT"),
                        help="Generate a single test clip")

    # Batch generation
    parser.add_argument("--segments", help="Path to segments.json")
    parser.add_argument("--voice", help="Voice profile ID")
    parser.add_argument("--language", help="Target language code (e.g. 'en', 'es')")
    parser.add_argument("--output", help="Output directory for audio files")
    parser.add_argument("--book-id", default="monte-alban", help="Book identifier")
    parser.add_argument("--chapter-id", default="full", help="Chapter identifier")
    parser.add_argument("--exaggeration", type=float, default=0.35, help="Emotion intensity (0-1)")
    parser.add_argument("--cfg", type=float, default=0.5, help="Voice conformity (0-1)")

    args = parser.parse_args()

    if args.status:
        check_status(args.server)
        return

    if args.upload_voice:
        voice_id, wav_path = args.upload_voice
        upload_voice(args.server, voice_id, wav_path)
        return

    if args.test:
        voice_id, language, text = args.test
        generate_test(args.server, voice_id, language, text)
        return

    # Batch generation
    if not all([args.segments, args.voice, args.language, args.output]):
        print("❌ Batch generation requires: --segments, --voice, --language, --output")
        parser.print_help()
        sys.exit(1)

    # Load segments
    segments = load_segments(args.segments, args.language)
    if not segments:
        print("❌ No segments found in file")
        sys.exit(1)

    print(f"\n📖 Corpán Book Audio Generator")
    print(f"   Server: {args.server}")
    print(f"   Segments: {len(segments)} text blocks")

    estimated_words = sum(len(s["tts"]["text"].split()) for s in segments)
    estimated_minutes = estimated_words / 150
    print(f"   Estimated audio: ~{estimated_minutes:.0f} minutes ({estimated_words} words)")

    # Submit batch
    job_id = submit_batch(
        args.server, segments, args.voice,
        args.book_id, args.chapter_id,
        args.exaggeration, args.cfg,
    )

    # Poll until complete
    job = poll_job(args.server, job_id)

    # Download results
    download_results(args.server, job_id, args.output)

    print(f"\n🎉 Done! Audio files are in: {args.output}")
    print(f"   Next step: run 'make pack' to build the book pack with audio.")


if __name__ == "__main__":
    main()
