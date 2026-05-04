#!/bin/bash
# Upload App Store / Play Store marketing assets (screenshots + App Previews)
# from local disk to s3://corpan-assets/marketing/.
#
# See `infra/MARKETING_ASSETS.md` for the directory layout convention.
#
# Prerequisites:
#   - AWS CLI installed
#   - AWS credentials available via one of:
#       (a) ~/Code/corpora/encorpora/.env  containing AWS_ACCESS_KEY + AWS_SECRET_ACCESS_KEY
#       (b) AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY exported in the shell
#       (c) An aws-cli profile with access to corpan-assets (then call with AWS_PROFILE=...)
#
# Usage:
#   ./corpan/infra/sync-marketing-to-s3.sh

set -euo pipefail

MARKETING_DIR="${MARKETING_DIR:-${HOME}/encorpora/marketing}"
S3_DEST="s3://corpan-assets/marketing/"
S3_REGION="us-east-2"

ENV_FILE="${ENV_FILE:-${HOME}/Code/corpora/encorpora/.env}"
if [ -f "$ENV_FILE" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  set -a; . "$ENV_FILE"; set +a
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${AWS_ACCESS_KEY:-}}"
fi

if [ ! -d "$MARKETING_DIR" ]; then
  echo "Error: marketing directory not found: $MARKETING_DIR" >&2
  exit 1
fi

echo "Syncing marketing assets to $S3_DEST ..."
aws s3 sync "$MARKETING_DIR" "$S3_DEST" \
  --region "$S3_REGION" \
  --exclude '*' \
  --include '*.png' --include '*.PNG' \
  --include '*.jpg' --include '*.JPG' \
  --include '*.jpeg' --include '*.JPEG' \
  --include '*.heic' --include '*.HEIC' \
  --include '*.mov' --include '*.MOV' \
  --include '*.mp4' --include '*.MP4'

echo "Done."
