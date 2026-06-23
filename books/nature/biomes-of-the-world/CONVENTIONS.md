# Biomes of the World — Conventions

Short ~8-minute books, one sentence per segment, basic vocabulary, designed so Chatterbox can speak `tts.text == text` verbatim across all 23 Chatterbox languages with **no per-language tts.text rewrites**.

## Voice and tone
- Third-person, warm, plainspoken tour-guide. No first-person narrator persona.
- Present tense. Active voice. 8–14 word sentences.
- Calm and confident. The narrator knows the biome and loves it, but never gushes.

## Manuscript rules

**Segmentation**
- One sentence per paragraph (blank line between paragraphs).
- A "paired" two-sentence segment is allowed only when the second sentence is very short and tightly follows the first. Use sparingly.
- Each chapter file starts with a single `# Chapter Title` heading. No `##` headings inside the body.
- No images, no blockquotes, no lists, no code, no tables.

**Vocabulary (the hard rule)**
- **Common animals only.** Jaguar, parrot, monkey, snake, frog, fish, eagle, deer, wolf, bear, mouse, ant, butterfly. The kinds of animals every language has a single common word for.
- Skip rarer endemics (tapir, peccary, agouti, pangolin, manatee, capybara) even when they are iconic to the biome. Replace with a category: "a small forest deer", "a river mammal", "a hunting cat".
- No scientific Latin names ever.
- No years and no large numbers in the body. If needed, spell out as words ("about two hundred kinds of trees").
- No abbreviations, no acronyms. "United States", "kilometers", "degrees Celsius" — never US, km, °C.
- No em-dashes, semicolons, parenthetical asides, or quoted speech in the spoken body.
- Place names: prefer translatable common nouns ("the rainforests of South America") over proper nouns. Where a proper noun is unavoidable, prefer widely-translated names (Amazon, Sahara, Arctic, Sahel).

**Structure (per book)**
```
manuscript/
  00-title.md                  # ~3 segs — book title + one-line tagline
  01-what-is-this-biome.md     # ~20 segs — where on Earth, the basic idea
  02-the-weather.md            # ~18 segs — seasons, rain, temperature
  03-the-land-and-water.md     # ~18 segs — soil, rivers, terrain
  04-the-plants.md             # ~25 segs — key plants and adaptations
  05-the-animals.md            # ~30 segs — key animals and adaptations
  06-the-people.md             # ~20 segs — traditional human adaptation
  07-the-biome-today.md        # ~12 segs — threats + a hopeful note
  08-closing.md                # ~2-3 segs — wrap
```
Target ~150 segments total, ~1300 words of English source.

## Pack rules
- One pack per book: `packs/ian-chatterbox-v1/`.
- Voice file `ian-new-narration-try-more-chill-clear.wav` for all 23 languages.
- VoiceId for catalog: `ian-chill-clear`.
- Engine: `chatterbox`.
- Reference `narration.yaml`: copied from
  `~/encorpora/books/science/fascinating-science/001-what-is-an-atom/packs/ian-chatterbox-v1/narration.yaml`.

## Language fan-out (JIT)
- Translate via Claude subagent. tts.text must equal text — no creative rephrasing.
- Per-lang gotchas: full nikkud for he; strip reduplication hyphens for ms;
  no Latin script in zh/ja/ko tts.text.
- One language at a time. First 2-3 langs are user-spot-check gated.
- Append a per-lang record to `lang_records/<lang>.jsonl` after each ship.
- See `LANG_PITFALLS.md` for cross-book pitfalls (populated as we go).
