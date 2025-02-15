set -e

pandoc -s *.md -o second-grade-math.pdf --pdf-engine=xelatex --toc \
    --include-in-header=custom_headings.tex \
    --include-before-body=custom_cover.tex \
    --lua-filter=hrule.lua \
    -V geometry:margin=1in \
    --toc-depth=2

# -V documentclass=book \
# -V fontsize=10pt \