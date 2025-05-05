set -e

pandoc -s *.md -o basic-korean.pdf --pdf-engine=xelatex --toc \
    --include-in-header=custom_headings.tex \
    --include-before-body=custom_cover.tex \
    -V documentclass=book \
    -V geometry:margin=1in \
    --toc-depth=2
