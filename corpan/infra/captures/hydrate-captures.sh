#!/bin/bash
# Download Corpán captures from s3://corpan-assets/captures/ to local disk.
# Use after a fresh clone or on Ian's Mac to pull everything down.
#
# See `infra/captures/CAPTURES.md` for the directory layout convention.
#
# Prerequisites:
#   - AWS CLI installed
#   - AWS credentials available via one of:
#       (a) ~/Code/corpora/encorpora/.env  with AWS_ACCESS_KEY + AWS_SECRET_ACCESS_KEY
#       (b) AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY exported in the shell
#       (c) An aws-cli profile with access to corpan-assets (then call with AWS_PROFILE=...)
#
# Usage:
#   ./corpan/infra/captures/hydrate-captures.sh

set -euo pipefail

LOCAL_CAPTURES_DIR="${LOCAL_CAPTURES_DIR:-${HOME}/Desktop/Corpan Captures}"
S3_SRC="s3://corpan-assets/captures/"
S3_REGION="us-east-2"

ENV_FILE="${ENV_FILE:-${HOME}/Code/corpora/encorpora/.env}"
if [ -f "$ENV_FILE" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  set -a; . "$ENV_FILE"; set +a
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${AWS_ACCESS_KEY:-}}"
fi

mkdir -p "$LOCAL_CAPTURES_DIR"

echo "Downloading captures from $S3_SRC ..."
aws s3 sync "$S3_SRC" "$LOCAL_CAPTURES_DIR" \
  --region "$S3_REGION" \
  --exclude '*' \
  --include 'raw/*' --include 'built/*' \
  --include '*.mov' --include '*.MOV' \
  --include '*.mp4' --include '*.MP4' \
  --include '*.jpg' --include '*.JPG' \
  --include '*.jpeg' --include '*.JPEG' \
  --include '*.png' --include '*.PNG' \
  --include '*.json'

echo "Done. Captures in: $LOCAL_CAPTURES_DIR"
