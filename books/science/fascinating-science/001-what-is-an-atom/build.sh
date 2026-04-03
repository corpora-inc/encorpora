#!/bin/bash
set -e

BASENAME="what-is-an-atom"
OUTPUT_PDF="${BASENAME}.pdf"
OUTPUT_EPUB="${BASENAME}.epub"
INPUT_GLOB="manuscript/[0-9][0-9]-*.md"
FOCUS=""
WINDOW=""
LIST=false
BUILD_PDF=true
BUILD_EPUB=true

TITLE='What Is an Atom'
AUTHOR='Skylar Saveland'
LANG='en-US'
PUBLISHER='Corpora Inc'
ISBN=''
DATE="$(date +%Y-%m-%d)"

PAPER="${PAPER:-6x9}"
GEOMETRY_HEADER=""

usage() {
  echo "Usage: ./build.sh [--paper=6x9|letter|a4] [--focus=NUM|FILE] [--window=N] [--list] [--pdf-only|--epub-only]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --paper=*) PAPER="${1#*=}"; shift ;;
    --paper) PAPER="$2"; shift 2 ;;
    --focus=*) FOCUS="${1#*=}"; shift ;;
    --focus) FOCUS="$2"; shift 2 ;;
    --window=*) WINDOW="${1#*=}"; shift ;;
    --window) WINDOW="$2"; shift 2 ;;
    --list) LIST=true; shift ;;
    --pdf-only) BUILD_EPUB=false; shift ;;
    --epub-only) BUILD_PDF=false; shift ;;
    *) echo "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

case "$PAPER" in
  6x9) ;;
  letter|full) GEOMETRY_HEADER="custom_geometry_letter.tex" ;;
  a4) GEOMETRY_HEADER="custom_geometry_a4.tex" ;;
  *) echo "Unknown paper size: $PAPER (use 6x9, letter, or a4)"; exit 1 ;;
esac

shopt -s nullglob
ALL_FILES=( $INPUT_GLOB )
if [[ ${#ALL_FILES[@]} -eq 0 ]]; then echo "No manuscript files found matching: $INPUT_GLOB"; exit 1; fi
if $LIST; then for i in "${!ALL_FILES[@]}"; do printf "%2d  %s\n" $((i + 1)) "$(basename "${ALL_FILES[$i]}")"; done; exit 0; fi
if ! $BUILD_PDF && ! $BUILD_EPUB; then echo "Choose only one of --pdf-only or --epub-only"; exit 1; fi

SELECTED_FILES=( "${ALL_FILES[@]}" )
if [[ -n "$FOCUS" ]]; then
  if [[ -z "$WINDOW" ]]; then WINDOW=1; fi
  if [[ ! "$WINDOW" =~ ^[0-9]+$ ]]; then echo "Window must be a non-negative integer: $WINDOW"; exit 1; fi
  idx=-1
  if [[ "$FOCUS" =~ ^[0-9]+$ ]]; then idx=$((10#$FOCUS - 1))
  else for i in "${!ALL_FILES[@]}"; do base="$(basename "${ALL_FILES[$i]}")"; if [[ "$base" == "$FOCUS" || "$base" == *"$FOCUS"* ]]; then idx=$i; break; fi; done; fi
  if (( idx < 0 || idx >= ${#ALL_FILES[@]} )); then echo "Focus not found: $FOCUS"; exit 1; fi
  start=$((idx - WINDOW)); end=$((idx + WINDOW))
  if (( start < 0 )); then start=0; fi
  if (( end >= ${#ALL_FILES[@]} )); then end=$(( ${#ALL_FILES[@]} - 1 )); fi
  count=$(( end - start + 1 ))
  SELECTED_FILES=( "${ALL_FILES[@]:start:count}" )
fi

PAPER_ARG=()
if [[ -n "$GEOMETRY_HEADER" ]]; then PAPER_ARG=(--include-in-header "$GEOMETRY_HEADER"); fi
if $BUILD_PDF; then pandoc "${SELECTED_FILES[@]}" --defaults defaults.yaml "${PAPER_ARG[@]}" -o "$OUTPUT_PDF"; fi
if $BUILD_EPUB; then pandoc "${SELECTED_FILES[@]}" --to=epub3 --css=epub.css --toc --toc-depth=2 --metadata title="$TITLE" --metadata author="$AUTHOR" --metadata lang="$LANG" --metadata date="$DATE" --metadata publisher="$PUBLISHER" --metadata isbn="$ISBN" -o "$OUTPUT_EPUB"; fi
