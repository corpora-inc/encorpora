pandoc -s *.md -o output.pdf --pdf-engine=xelatex --toc \
    -V mainfont="DejaVu Serif" -V geometry:margin=1in
