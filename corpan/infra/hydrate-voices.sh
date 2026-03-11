#!/bin/bash
# Download voice reference WAV files from S3 to local disk.
# Use after a fresh clone to restore voice samples for TTS generation.
#
# Prerequisites:
#   - AWS CLI installed
#   - ~/.aws/credentials has [corpan-publisher] profile
#
# Usage:
#   ./corpan/infra/hydrate-voices.sh

set -euo pipefail

VOICES_DIR="${HOME}/encorpora/voices/data"
S3_SRC="s3://corpan-prod/sources/voices/data/"

mkdir -p "$VOICES_DIR"

echo "Downloading voice WAVs from S3..."
aws s3 sync "$S3_SRC" "$VOICES_DIR" \
  --profile corpan-publisher \
  --exclude '*' --include '*.wav'

echo "Done. Voice files in: $VOICES_DIR"
