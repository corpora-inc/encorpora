#!/bin/bash
# Download App Store / Play Store marketing assets from s3://corpan-assets/marketing/
# to local disk. Use after a fresh clone or on a different workstation when
# re-uploading to App Store Connect / Play Console.
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
#   ./corpan/infra/hydrate-marketing.sh

set -euo pipefail

MARKETING_DIR="${MARKETING_DIR:-${HOME}/encorpora/marketing}"
S3_SRC="s3://corpan-assets/marketing/"
S3_REGION="us-east-2"

ENV_FILE="${ENV_FILE:-${HOME}/Code/corpora/encorpora/.env}"
if [ -f "$ENV_FILE" ] && [ -z "${AWS_ACCESS_KEY_ID:-}" ]; then
  set -a; . "$ENV_FILE"; set +a
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${AWS_ACCESS_KEY:-}}"
fi

mkdir -p "$MARKETING_DIR"

echo "Downloading marketing assets from $S3_SRC ..."
aws s3 sync "$S3_SRC" "$MARKETING_DIR" \
  --region "$S3_REGION" \
  --exclude '*' \
  --include '*.png' --include '*.PNG' \
  --include '*.jpg' --include '*.JPG' \
  --include '*.jpeg' --include '*.JPEG' \
  --include '*.heic' --include '*.HEIC' \
  --include '*.mov' --include '*.MOV' \
  --include '*.mp4' --include '*.MP4'

echo "Done. Marketing assets in: $MARKETING_DIR"
