#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORPAN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENCORPORA_ROOT="$(cd "${CORPAN_ROOT}/.." && pwd)"

PYTHON_BIN="${ENCORPORA_ROOT}/.venv-pinyin/bin/python"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="$(command -v python3 || true)"
fi
if [[ -z "${PYTHON_BIN}" ]]; then
  echo "[hanzi-pack] ERROR: python3 not found." >&2
  exit 1
fi

STROKES_JSON="${CORPAN_ROOT}/dja/hanzi_pack/seed/strokes_full.json"
ETYMOLOGY_JSON="${CORPAN_ROOT}/dja/hanzi_pack/seed/etymology_full.json"
PACK_DIR="${CORPAN_ROOT}/games/hanzi-atelier"
OUT_DIR="${ENCORPORA_ROOT}/web/io/out/corpan/games/hanzi-atelier"

if [[ ! -f "${STROKES_JSON}" ]]; then
  echo "[hanzi-pack] ERROR: missing ${STROKES_JSON}" >&2
  exit 1
fi

if [[ ! -f "${ETYMOLOGY_JSON}" ]]; then
  echo "[hanzi-pack] WARNING: ${ETYMOLOGY_JSON} missing. Etymology table will be empty."
fi

echo "[hanzi-pack] Building pack DB..."
"${PYTHON_BIN}" "${CORPAN_ROOT}/dja/hanzi_pack/build_hanzi_pack.py" \
  --strokes "${STROKES_JSON}" \
  --etymology "${ETYMOLOGY_JSON}"

echo "[hanzi-pack] Packaging zip..."
(
  cd "${PACK_DIR}"
  zip -r -FS hanzi-atelier.zip \
    manifest.json \
    index.js \
    styles.css \
    hanziwriter.min.js \
    HANZIWRITER_LICENSE.txt \
    data/
)

echo "[hanzi-pack] Copying to dev output..."
mkdir -p "${OUT_DIR}"
cp "${PACK_DIR}/manifest.json" "${OUT_DIR}/"
cp "${PACK_DIR}/index.js" "${OUT_DIR}/"
cp "${PACK_DIR}/styles.css" "${OUT_DIR}/"
cp "${PACK_DIR}/hanziwriter.min.js" "${OUT_DIR}/"
cp "${PACK_DIR}/HANZIWRITER_LICENSE.txt" "${OUT_DIR}/"
rsync -a --delete "${PACK_DIR}/data/" "${OUT_DIR}/data/"
mkdir -p "${ENCORPORA_ROOT}/web/io/out/corpan/games"
cp "${PACK_DIR}/hanzi-atelier.zip" "${ENCORPORA_ROOT}/web/io/out/corpan/games/"

echo "[hanzi-pack] Done."
echo "[hanzi-pack] Install in Corpan from: http://localhost:1420/corpan/games/hanzi-atelier.zip"
