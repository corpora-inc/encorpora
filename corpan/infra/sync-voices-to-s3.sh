#!/bin/bash
# Upload voice reference WAV files to S3 for backup.
# These are the source voice samples used for Chatterbox TTS.
#
# Prerequisites:
#   - AWS CLI installed
#   - ~/.aws/credentials has [corpan-publisher] profile
#
# Usage:
#   ./corpan/infra/sync-voices-to-s3.sh

set -euo pipefail

VOICES_DIR="${HOME}/encorpora/voices/data"
S3_DEST="s3://corpan-prod/sources/voices/data/"

if [ ! -d "$VOICES_DIR" ]; then
  echo "Error: voices directory not found: $VOICES_DIR"
  exit 1
fi

echo "Syncing voice WAVs to S3..."
aws s3 sync "$VOICES_DIR" "$S3_DEST" \
  --profile corpan-publisher \
  --exclude '*' --include '*.wav'

echo "Done."
