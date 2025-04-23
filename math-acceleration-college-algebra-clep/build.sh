#!/bin/bash

set -e

# Define filenames
BASENAME="college-algebra-clep-preparation"
OUTPUT_PDF="${BASENAME}.pdf"
OUTPUT_EPUB="${BASENAME}.epub"
OUTPUT_PRINT_PDF="${BASENAME}-print.pdf"
COVER_IMAGE="cover.png"  # Must exist! 1600px x 2560px recommended for EPUB

# Define source files
INPUT_FILES="*.md"

# Metadata
TITLE="College Algebra CLEP Preparation"
AUTHOR="Skylar Saveland"
ISBN=""  # TODO
LANG="en-US"
PUBLISHER="Corpora Inc"
DATE=$(date +%Y-%m-%d)

# Normal PDF (for screen reading)
echo "Building normal PDF..."
pandoc -s $INPUT_FILES -o $OUTPUT_PDF \
    --pdf-engine=xelatex \
    --toc \
    --include-in-header=custom_headings.tex \
    --include-before-body=custom_cover.tex \
    --lua-filter=hrule.lua \
    -V documentclass=book \
    -V geometry:margin=1in \
    --toc-depth=2

echo "Building EPUB"
pandoc \
  --to=epub3 \
  --mathml \
  --css=epub.css \
  --epub-embed-font=fonts/STIXTwoText-Regular.ttf \
  --epub-embed-font=fonts/STIXTwoMath-Regular.ttf \
  --output="$OUTPUT_EPUB" \
  --toc \
  --lua-filter=hrule.lua \
  --metadata title="$TITLE" \
  --metadata author="$AUTHOR" \
  --metadata lang="$LANG" \
  --metadata date="$DATE" \
  --metadata publisher="$PUBLISHER" \
  --metadata isbn="$ISBN" \
  --epub-cover-image="$COVER_IMAGE" \
  --toc-depth=2 \
  $INPUT_FILES

# Print PDF (for print-on-demand)
echo "Building print-ready PDF..."
pandoc -s $INPUT_FILES -o $OUTPUT_PRINT_PDF \
    --pdf-engine=xelatex \
    --toc \
    --include-in-header=custom_headings.tex \
    --include-before-body=custom_cover.tex \
    --lua-filter=hrule.lua \
    -V documentclass=book \
    -V geometry:top=0.75in,bottom=0.75in,inner=0.75in,outer=0.5in \
    -V fontsize=11pt \
    --toc-depth=2

echo "All formats built successfully!"
