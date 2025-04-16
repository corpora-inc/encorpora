set -e

pandoc -s *.md -o basic-korean.pdf --pdf-engine=xelatex --toc \
    --include-before-body=custom_cover.tex \
    -V documentclass=book \
    -V geometry:margin=1in \
    --toc-depth=2
