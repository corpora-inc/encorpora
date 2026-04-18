BASENAME   = the-childrens-author
TITLE      = The Children's Author: Arthur Ransome
SUBTITLE   = The Writer Who Spied for Two Countries
AUTHOR     = Corpora
LANG       = en-US
PUBLISHER  = Corpora Inc
DATE       = $(shell date +%Y-%m-%d)

MANUSCRIPT = manuscript/00-frontmatter.md \
             manuscript/01-the-journalist.md \
             manuscript/02-the-double-life.md \
             manuscript/03-swallows-and-amazons.md \
             manuscript/04-context.md \
             manuscript/99-backmatter.md

OUTPUT_PDF  = $(BASENAME).pdf
OUTPUT_EPUB = $(BASENAME).epub
SEGMENTS    = pack/segments.json

.PHONY: all pdf epub segments pack clean lint wordcount

all: pdf epub segments

pdf: $(OUTPUT_PDF)

$(OUTPUT_PDF): $(MANUSCRIPT) defaults.yaml custom_cover.tex custom_headings.tex
	pandoc $(MANUSCRIPT) --defaults defaults.yaml -o $(OUTPUT_PDF)

epub: $(OUTPUT_EPUB)

$(OUTPUT_EPUB): $(MANUSCRIPT) epub.css
	pandoc $(MANUSCRIPT) \
		--to=epub3 \
		--mathml \
		--css=epub.css \
		--toc \
		--toc-depth=2 \
		--metadata title="$(TITLE)" \
		--metadata subtitle="$(SUBTITLE)" \
		--metadata author="$(AUTHOR)" \
		--metadata lang="$(LANG)" \
		--metadata date="$(DATE)" \
		--metadata publisher="$(PUBLISHER)" \
		-o $(OUTPUT_EPUB)

segments: $(SEGMENTS)

$(SEGMENTS): $(MANUSCRIPT)
	@echo "Generating segments from manuscript..."
	@python3 scripts/generate_segments.py $(MANUSCRIPT) > $(SEGMENTS)
	@echo "Generated $(SEGMENTS)"

pack: segments
	@echo "Pack build requires npm tooling — see pack/ directory"
	@if [ -f pack/package.json ]; then cd pack && npm run build; fi

clean:
	rm -f $(OUTPUT_PDF) $(OUTPUT_EPUB) $(SEGMENTS)

lint:
	@echo "=== Word count by file ==="
	@for f in $(MANUSCRIPT); do \
		words=$$(wc -w < "$$f"); \
		echo "  $$f: $$words words"; \
	done
	@echo "=== Total ==="
	@cat $(MANUSCRIPT) | wc -w | xargs printf "  %s words\n"
	@echo "=== Estimated pages (250 words/page) ==="
	@cat $(MANUSCRIPT) | wc -w | xargs -I{} python3 -c "print(f'  {int({}) // 250} pages')"

wordcount:
	@cat $(MANUSCRIPT) | wc -w | xargs printf "%s words\n"
