#!/bin/bash
set -e

BASENAME="third-grade-at-home"
OUTPUT_PDF="${BASENAME}.pdf"
OUTPUT_EPUB="${BASENAME}.epub"
INPUT_FILES="manuscript/[0-9][0-9]-*.md"

TITLE='Third Grade at Home'
AUTHOR='Skylar Saveland'
LANG='en-US'
PUBLISHER='Corpora Inc'
ISBN=''
DATE="$(date +%Y-%m-%d)"

PAPER="${PAPER:-6x9}"
GEOMETRY_HEADER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --paper=*)
      PAPER="${1#*=}"
      shift
      ;;
    --paper)
      PAPER="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: ./build.sh [--paper=6x9|letter|a4]"
      exit 1
      ;;
  esac
done

case "$PAPER" in
  6x9)
    ;;
  letter|full)
    GEOMETRY_HEADER="custom_geometry_letter.tex"
    ;;
  a4)
    GEOMETRY_HEADER="custom_geometry_a4.tex"
    ;;
  *)
    echo "Unknown paper size: $PAPER (use 6x9, letter, or a4)"
    exit 1
    ;;
esac

PAPER_ARG=()
if [[ -n "$GEOMETRY_HEADER" ]]; then
  PAPER_ARG=(--include-in-header "$GEOMETRY_HEADER")
fi

pandoc $INPUT_FILES --defaults defaults.yaml "${PAPER_ARG[@]}" -o "$OUTPUT_PDF"

pandoc $INPUT_FILES   --to=epub3   --mathml   --css=epub.css   --toc   --toc-depth=2   --metadata title="$TITLE"   --metadata author="$AUTHOR"   --metadata lang="$LANG"   --metadata date="$DATE"   --metadata publisher="$PUBLISHER"   --metadata isbn="$ISBN"   -o "$OUTPUT_EPUB"   $INPUT_FILES
