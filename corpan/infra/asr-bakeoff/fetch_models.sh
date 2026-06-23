#!/usr/bin/env bash
# Download the sherpa-onnx models (Parakeet-v3 + SenseVoice) into models/.
# Qwen3-ASR and Whisper pull from HF on first run, so they're not here.
#
# These are the int8 onnx exports k2-fsa publishes for sherpa-onnx. Sizes are
# a few hundred MB each. Re-running is idempotent (skips existing dirs).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p models
cd models

dl() {  # dl <url> <dest-dir>
  local url="$1" dest="$2"
  if [ -d "$dest" ]; then echo "skip $dest (exists)"; return; fi
  echo "fetching $dest …"
  local tarball; tarball="$(basename "$url")"
  curl -fL --retry 3 -o "$tarball" "$url"
  tar xf "$tarball" && rm -f "$tarball"
}

# Parakeet-TDT-0.6b-v3 int8 (25 EU langs, NAR transducer).
# Canonical sherpa-onnx release asset; pin the exact name if k2-fsa renames.
PARAKEET_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2"
dl "$PARAKEET_URL" "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8"
# Symlink to the dir name the adapter expects.
[ -e parakeet-tdt-v3-int8 ] || ln -s sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8 parakeet-tdt-v3-int8

# SenseVoice-Small int8 (zh/yue/en/ja/ko, NAR). LICENSE IS AMBIGUOUS — this
# is for BENCHMARKING ONLY; do not ship without legal clearance.
SENSEVOICE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2"
dl "$SENSEVOICE_URL" "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
[ -e sensevoice-small ] || ln -s sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 sensevoice-small

echo "Done. Adapter dirs: models/parakeet-tdt-v3-int8, models/sensevoice-small"
echo "NOTE: verify the exact onnx filenames inside match sherpa_adapter.py"
echo "      (encoder/decoder/joiner.int8.onnx, model.int8.onnx, tokens.txt)."
