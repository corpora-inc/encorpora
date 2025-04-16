set -e

pandoc -s *.md -o 한국어-사용자를-위한-영어-입문서.pdf --pdf-engine=xelatex --toc \
    --include-in-header=custom_headings.tex \
    --include-before-body=custom_cover.tex \
    -V documentclass=book \
    -V geometry:margin=1in \
    --toc-depth=2
