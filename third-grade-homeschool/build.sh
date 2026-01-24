#!/bin/bash
set -e

BASENAME="third-grade-at-home"
OUTPUT_PDF="${BASENAME}.pdf"
OUTPUT_EPUB="${BASENAME}.epub"
INPUT_FILES="manuscript/*.md"

TITLE='Third Grade at Home'
AUTHOR='Skylar Saveland'
LANG='en-US'
PUBLISHER='Corpora Inc'
ISBN=''
DATE="$(date +%Y-%m-%d)"

pandoc $INPUT_FILES --defaults defaults.yaml -o "$OUTPUT_PDF"

pandoc $INPUT_FILES   --to=epub3   --mathml   --css=epub.css   --toc   --toc-depth=2   --metadata title="$TITLE"   --metadata author="$AUTHOR"   --metadata lang="$LANG"   --metadata date="$DATE"   --metadata publisher="$PUBLISHER"   --metadata isbn="$ISBN"   -o "$OUTPUT_EPUB"   $INPUT_FILES
