"""Generate narration with a built-in voice. API key is read only from environment."""

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("script")
p.add_argument("output")
p.add_argument("--voice", choices=["cedar", "marin"], default="cedar")
a = p.parse_args()
key = os.environ.get("OPENAI_API_KEY")
if not key:
    raise SystemExit("OPENAI_API_KEY is required")
text = Path(a.script).read_text()
if not 0 < len(text) <= 4096:
    raise SystemExit("Script must contain 1–4096 characters")
data = {
    "model": "gpt-4o-mini-tts-2025-12-15",
    "voice": a.voice,
    "input": text,
    "response_format": "wav",
    "instructions": "Speak with warm, clear confidence, like a thoughtful math educator explaining something useful to a parent. Natural American English. Keep a brisk but unhurried commercial pace. No exaggerated excitement. Pronounce AMP as amp, EFA as E F A, and ClassWallet as Class Wallet.",
}
req = urllib.request.Request(
    "https://api.openai.com/v1/audio/speech",
    data=json.dumps(data).encode(),
    headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        audio = r.read()
except urllib.error.HTTPError as e:
    raise SystemExit(f"Voice generation failed (HTTP {e.code}); credentials omitted")
if not audio.startswith(b"RIFF"):
    raise SystemExit("Expected WAV output")
Path(a.output).write_bytes(audio)
Path(a.output + ".json").write_text(
    json.dumps(
        {
            "model": data["model"],
            "voice": a.voice,
            "script": text,
            "disclosure": "AI-generated narration.",
            "bytes": len(audio),
        },
        indent=2,
    )
)
print(f"Narration saved: {len(audio)} bytes")
