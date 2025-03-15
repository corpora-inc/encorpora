#!/bin/bash

set -e

pushd yidjing
./manage.py export_hexagrams
popd

# pandoc -s *.md -o yijing.pdf --pdf-engine=xelatex --toc \
pandoc -s iching_export.md -o yijing_export.pdf --pdf-engine=xelatex --toc \
    --include-in-header=custom_headings.tex \
    --include-before-body=custom_cover.tex \
    --lua-filter=hrule.lua \
    --lua-filter=no_apostrophe_space.lua \
    -V documentclass=book \
    -V geometry:margin=1in \
    --toc-depth=1
