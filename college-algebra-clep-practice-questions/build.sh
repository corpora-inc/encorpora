pandoc -s *.md -o output.pdf --pdf-engine=xelatex --toc \
    -V geometry:margin=1in \
    --toc-depth=1
