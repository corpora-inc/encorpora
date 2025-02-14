pandoc -s *.md -o third-grade-math.pdf --pdf-engine=xelatex --toc \
    --include-in-header=custom_headings.tex \
    -V geometry:margin=1in \
    --toc-depth=3
