# Cryptids and Folklore — Series Plan

A 16-book narration series modeled on the proven "Biomes of the World" pattern. Same voice (`ian-chill-clear`), same ~8-minute runtime, same ~150-segment shape, same 23 Chatterbox languages, same one-sentence-per-paragraph manuscript discipline. The subject matter is the creatures people have told stories about, told as a tour of human imagination across regions and centuries — never as a tour of "things that are real."

This document is the series shape. Once it is accepted, the next agent should be able to sit down and start writing Book 1's EN manuscript without making any series-shape decisions.

---

## 1. Series metadata

To be written verbatim into `/home/skyl/encorpora/books/folklore/cryptids-and-folklore/series.yaml`.

```yaml
series_id: cryptids_and_folklore
title: Cryptids and Folklore
description: Short, simple tours of the creatures people have told stories about — where the stories come from, what the creature is said to look like, the oldest tales, and the things the creature might really have been.
author: Skylar Saveland
audience: language learners and curious readers of any age
voice: warm, plainspoken, third-person tour-guide
target_runtime_minutes: 8
language_learning: true
books:
  - { id: book_cryptids_dragons_of_europe,    slug: 01-dragons-of-europe,    title: "Dragons of Europe" }
  - { id: book_cryptids_dragons_of_china,     slug: 02-dragons-of-china,     title: "Dragons of China" }
  - { id: book_cryptids_the_kraken,           slug: 03-the-kraken,           title: "The Kraken" }
  - { id: book_cryptids_mermaids,             slug: 04-mermaids,             title: "Mermaids" }
  - { id: book_cryptids_the_loch_ness_monster, slug: 05-the-loch-ness-monster, title: "The Loch Ness Monster" }
  - { id: book_cryptids_bigfoot,              slug: 06-bigfoot,              title: "Bigfoot" }
  - { id: book_cryptids_the_yeti,             slug: 07-the-yeti,             title: "The Yeti" }
  - { id: book_cryptids_the_chupacabra,       slug: 08-the-chupacabra,       title: "The Chupacabra" }
  - { id: book_cryptids_werewolves,           slug: 09-werewolves,           title: "Werewolves" }
  - { id: book_cryptids_vampires,             slug: 10-vampires,             title: "Vampires" }
  - { id: book_cryptids_yokai_of_japan,       slug: 11-yokai-of-japan,       title: "Yokai of Japan" }
  - { id: book_cryptids_the_jinn,             slug: 12-the-jinn,             title: "The Jinn" }
  - { id: book_cryptids_trolls,               slug: 13-trolls,               title: "Trolls" }
  - { id: book_cryptids_the_phoenix,          slug: 14-the-phoenix,          title: "The Phoenix" }
  - { id: book_cryptids_selkies,              slug: 15-selkies,              title: "Selkies" }
  - { id: book_cryptids_la_llorona,           slug: 16-la-llorona,           title: "La Llorona" }
```

**Tagline (one line, for store pages):** "Tours of the creatures people have told stories about, from every corner of the world."

**Parent directory:** `/home/skyl/encorpora/books/folklore/cryptids-and-folklore/`

---

## 2. The 16 books

Picked for (a) recognizability to a general audience, (b) enough lore to fill ~150 segments without padding, (c) geographic spread, (d) avoidance of living indigenous or actively-religious traditions where the storytellers would not want their material in an English-first audio book without their hand on the tiller.

| # | Title | Slug | Book ID | One-line scope |
|---|---|---|---|---|
| 01 | Dragons of Europe | `01-dragons-of-europe` | `book_cryptids_dragons_of_europe` | Fire-breathing winged serpents of Welsh, English, Norse and German legend — Beowulf, Saint George, the Welsh flag. |
| 02 | Dragons of China | `02-dragons-of-china` | `book_cryptids_dragons_of_china` | Long, wingless, water-and-cloud dragons of East Asian story — wise, lucky, river-dwelling, very different from #1. |
| 03 | The Kraken | `03-the-kraken` | `book_cryptids_the_kraken` | The giant sea creature of Norwegian and Icelandic sailors, said to drag ships under. |
| 04 | Mermaids | `04-mermaids` | `book_cryptids_mermaids` | Half-woman, half-fish sea people, told of in Greek, Syrian, Irish, West African and Caribbean traditions. |
| 05 | The Loch Ness Monster | `05-the-loch-ness-monster` | `book_cryptids_the_loch_ness_monster` | The long-necked creature said to live in a deep Scottish lake; a story that grew very large in the 1930s. |
| 06 | Bigfoot | `06-bigfoot` | `book_cryptids_bigfoot` | A tall, hairy forest walker of the North American woods; a modern American legend with deeper roots in many older forest-spirit stories. |
| 07 | The Yeti | `07-the-yeti` | `book_cryptids_the_yeti` | A snow-walking creature of the high Himalayas, told of by the mountain people for many generations. |
| 08 | The Chupacabra | `08-the-chupacabra` | `book_cryptids_the_chupacabra` | A creature said to harm farm animals, first reported in Puerto Rico in the 1990s and now told of all across the Americas. |
| 09 | Werewolves | `09-werewolves` | `book_cryptids_werewolves` | The story of people who turn into wolves at night, told for centuries in France, Germany, the Baltics and beyond. |
| 10 | Vampires | `10-vampires` | `book_cryptids_vampires` | The night-walking dead of Slavic, Romanian, Greek and Hungarian village stories. |
| 11 | Yokai of Japan | `11-yokai-of-japan` | `book_cryptids_yokai_of_japan` | The many strange spirits of old Japanese stories — kappa, tengu, kitsune, tanuki. |
| 12 | The Jinn | `12-the-jinn` | `book_cryptids_the_jinn` | The unseen beings of the Arabian and Persian world — stories told for over a thousand years, framed carefully (see Risk #2). |
| 13 | Trolls | `13-trolls` | `book_cryptids_trolls` | The stone-and-mountain people of Norway, Sweden, Iceland and the Faroes. |
| 14 | The Phoenix | `14-the-phoenix` | `book_cryptids_the_phoenix` | The fire-bird that dies and is born again, told of in old Egyptian, Greek and Persian writings. |
| 15 | Selkies | `15-selkies` | `book_cryptids_selkies` | The seal people of Orkney, Shetland, the Hebrides and the Faroes — sealskin off on land, on in the sea. |
| 16 | La Llorona | `16-la-llorona` | `book_cryptids_la_llorona` | The weeping woman of Mexican and Latin American legend — heard by rivers at night. |

**Alternate candidates (for substitution if needed):** Unicorns; Cyclops; the Roc; Banshees; Krampus; the Headless Horseman; Genies of the Lamp (overlaps Jinn); the Hydra; the Minotaur. Deliberately **excluded** for appropriation reasons: Wendigo, Skinwalker, Thunderbird, Bunyip, Tikoloshe, Mokele-mbembe.

---

## 3. Per-book chapter structure

Adapted from biomes. Same nine-file shape so the pipeline scripts barely change. Target ~150 segments / ~1300 EN words total.

```
manuscript/
  00-title.md                       # ~3 segs   — book title + one-line tagline
  01-where-the-story-comes-from.md  # ~18 segs  — region, the people who first told it, roughly when
  02-what-the-creature-looks-like.md # ~18 segs  — body, size, common variations across regions
  03-the-oldest-stories.md          # ~22 segs  — earliest written or sung accounts (Beowulf, Pliny, the Heimskringla, etc.) retold simply
  04-how-the-story-grew.md          # ~22 segs  — how the lore spread, picked up new details, crossed borders
  05-famous-accounts.md             # ~22 segs  — well-known specific stories (the 1933 Loch Ness sighting; Saint George; the Patterson film), all framed as "what people told"
  06-what-it-might-really-be.md     # ~22 segs  — natural explanations: misidentified animals, weather, disease, hoaxes, ship wakes
  07-the-creature-today.md          # ~20 segs  — in books, films, tourism, town festivals, regional identity
  08-closing.md                     # ~3 segs   — wrap, invite the listener to listen for the story themselves
```

---

## 4. Series-level decisions

### Voice

`ian-chill-clear` — same voice file as biomes (`ian-new-narration-try-more-chill-clear.wav`), same pack layout (`packs/ian-chatterbox-v1/`), same `narration.yaml` template copied from biomes. Reusing the voice ties the two series together sonically and saves a vetting round.

### Tone discipline (the hard rule)

The narrator believes the storytellers, not the stories. Phrasing patterns to use throughout:

- "People who lived in X told stories about Y."
- "For hundreds of years, sailors of the North Atlantic told of a creature so large that…"
- "In the old books, the creature was said to…"
- "Some people thought it was a real animal. Other people thought it was a spirit. Other people thought the story was meant to teach a lesson."
- "Many people today still tell the story."

Phrasing **never** used:

- "X is real."
- "X exists."
- "Scientists have proven…"
- "The truth is…"
- "Believers say… / Skeptics say…" (sets up a culture-war frame the series does not need)
- "Most famous", "world's most mysterious", any marketing absolute (banned per MEMORY.md)
- "Flagging" (banned per MEMORY.md)
- "Encounter" — replace with "story", "sighting", or "met" (cleaner across the 23 langs)
- "Phenomenon", "paranormal", "supernatural", "cryptozoology" — too technical
- "Believed to be" passive constructions when "people said it was" is available

### Vocabulary (the harder rule)

Same common-word discipline as biomes. The book's job is to be speakable verbatim in 23 languages. Therefore:

- **Body parts:** head, eyes, teeth, claws, wings, tail, fur, scales, skin. Yes. "Maw", "talon", "pelt": no.
- **Settings:** forest, mountain, lake, sea, river, village, road, night, mist, snow, cave, ship. Yes.
- **Verbs of telling:** said, told, heard, sang, wrote, drew. Yes.
- **Verbs of doing:** walked, swam, flew, hid, watched, listened, ran, climbed. Yes.
- **No numbers in the body except spelled-out small ones.** Where a date is load-bearing (1933 for Loch Ness, 1995 for Chupacabra), spell as words: "nineteen thirty-three". Use sparingly — a single date per chapter at most.
- **No Latin names, no scientific terms, no abbreviations, no acronyms.**

### Proper nouns and the transliteration rule

The biomes books mostly dodged proper nouns. This series cannot — the creatures' names are the book. The hard rule:

- **`text` and `tts.text` must match after the documented hyphen-strip / Hebrew-nikkud normalization.** Chatterbox cannot code-switch — an English word inside a Japanese sentence is mauled in synthesis. So for the eight non-Latin-script languages (ar, el, he, hi, ja, ko, ru, zh), every creature name and every place name must appear in the target script, identically in `text` and `tts.text`.
- The transliteration is **phonetic, not semantic.** "Kraken" in Japanese is `クラーケン`, not `海の怪物`. We are naming this specific creature, not its category.
- Where a culture already has its own canonical name for the creature (the phoenix is `凤凰` / `fenghuang` in Chinese; the jinn is `جن` in Arabic; the kappa is `河童` in Japanese), use the canonical name. The "kappa" book and the "yokai" book will lean on canonical Japanese names throughout.
- Where transliteration would produce different forms (e.g. several plausible kanji or hanzi spellings), the **first** language to be translated for that book fixes the canonical form, and a `NAMES.md` file in the book directory records the canonical form for every later language. Every translator subagent reads `NAMES.md` before translating.
- For Latin-script languages (da, de, es, fi, fr, it, ms, nl, no, pl, pt, sv, sw, tr — plus en), proper nouns generally stay in their canonical Latin form. Exceptions:
  - **Spanish:** "el chupacabra", "la llorona" — already Spanish, leave native.
  - **Turkish, Polish, etc.:** if there is an established local form ("wampir" in Polish), use it; otherwise leave canonical.

A `NAMES.md` per book is non-negotiable. Without it, language fan-out will produce inconsistent creature names across the 23 audio tracks.

### Source-anchoring rule

Every creature has a `SOURCES.md` in the book directory listing the primary sources Chapter 3 and Chapter 4 draw from (the Beowulf manuscript date and edition; Pliny's Natural History book/chapter; the Heimskringla; the 1995 Puerto Rican newspaper account for Chupacabra; etc.). Chapter 6 has its own `EXPLANATIONS.md` listing the natural-history candidates (giant squid for the kraken; misidentified deer for Bigfoot; sturgeon for Loch Ness; rabies and porphyria for vampires). Every claim that names a real source, a real date, or a real species must trace back to one of these files.

### Cover art prompt direction

The biomes covers are dawn / evening tour-guide vibes. For folklore, the equivalent register is **moonlit folklore book illustration**, not horror movie poster.

Template (to be slot-filled per book):

> A painterly book-illustration cover in the style of golden-age folklore illustrators — Arthur Rackham, Edmund Dulac, Ivan Bilibin. {Landscape}: {time of day}, {weather}. The {creature} is half-glimpsed — {hint of body}: a tail in the water, a footprint in the snow, eyes between the trees, a coil under the waves. Restrained palette of {two or three colours}: deep blues and silvers; warm browns and gold; mossy greens and cream. Mysterious, not frightening. No text on the image. No blood, no fangs bared, no horror tropes. The mood is "an old story, told by firelight."

### Pack rules (reused from biomes)

- One pack per book: `packs/ian-chatterbox-v1/`.
- Voice file: same `ian-new-narration-try-more-chill-clear.wav`.
- VoiceId: `ian-chill-clear`.
- Engine: `chatterbox`.
- Reference `narration.yaml` copied from biomes.
- Per-book scripts directory with a `run_lang_pipeline.sh` wrapper, identical shape to biomes' wrapper.

### Language fan-out (JIT, same as biomes)

- EN ships first. First two or three non-EN languages are user-spot-check gated (recommend: es, then ja, then ar — these surface the three main risk areas: Latin-script proper nouns, non-Latin transliteration, RTL/script).
- Translate via Claude subagent. Every translator subagent reads `NAMES.md` before touching segments.
- Per-lang record appended to `lang_records/<lang>.jsonl` after each ship.
- A series `LANG_PITFALLS.md` collects pitfalls cross-book.

---

## 5. Risk register

**1. Indigenous appropriation — already excluded from the book list.**
Wendigo (Algonquian), Skinwalker (Diné), Thunderbird (multiple Plains and Pacific Northwest nations), Bunyip (Aboriginal Australian) and Tikoloshe (Zulu / Xhosa) all have living sacred contexts and ongoing cultural-sensitivity discourse. They are not in the 16. Bigfoot has roots in older Pacific Northwest forest-spirit traditions; the book frames it as a **modern American legend** ("from the late nineteen fifties, when the word Bigfoot was first used in a California newspaper") and explicitly says "many peoples of the Americas have told older stories of forest beings" without naming specific nations or stories.

**2. Religious sensitivities — the Jinn book is the hardest.**
Jinn are mentioned in the Quran. They are not "folklore" to over a billion Muslims; they are part of Islamic theology. The book opens with a careful framing sentence — "For more than a thousand years, in many languages of the Arabian and Persian world, people have told stories of beings called the jinn." Chapter 6 ("what it might really be") is replaced for this book with a chapter that treats the jinn as a category of story, not as a category of being to be explained away. The book is the most-spotted-checked of the 16 before ship; consider asking a Muslim reader before EN ships. Similar smaller caution: the phoenix has imperial-and-religious resonance in Chinese tradition; do not flatten the fenghuang into "Greek phoenix in Chinese."

**3. Modern cryptozoologists vs. the people who originally told the stories.**
Chupacabra in 1995 Puerto Rico (Madelyne Tolentino's account) is the original; the goat-jaw photographs of Texas in the 2000s are the spread. Loch Ness is largely a 1933 newspaper phenomenon (the *Inverness Courier* in May 1933) on top of older Scottish water-horse traditions. Mokele-mbembe is largely a Western interest in old Congo Basin stories. The chapter-by-chapter structure handles this: Chapter 3 is the original tellers; Chapter 4 is the spread.

**4. "X is real" trap.**
The cryptozoology audience comes with a strong "evidence" frame ("the Patterson-Gimlin film is real proof"). The book never validates and never debunks. It tells what people said and what people did, and lets Chapter 6 list the natural-history candidates. Watch especially for:
- "Was first seen in…" — replace with "was first written about in…" or "people first told this story in…"
- "Evidence" — replace with "what people said they saw" or "tracks", "photographs", "writing"
- "Proved" / "disproved" — never used

**5. Vampires, werewolves, and historical disease.**
The old folklore tracks plague burials, premature burial, rabies, porphyria, and the visible decomposition of buried bodies. Chapter 6 names these gently — "in old Europe, when people grew sick and could not be helped, the sickness spread through whole villages" — but never diagnoses a historical figure (no "Vlad III actually had…") and never says "vampires were just people with porphyria" as a flat equation.

**6. La Llorona's roots.**
La Llorona is told across Mexico and Latin America. Some scholars trace pieces of the story to pre-Columbian Mexica (Aztec) figures (Cihuacōātl); other pieces are tied to Spanish colonial and Catholic story-traditions. The book describes it as a story "told in Mexico and across Latin America for many centuries" without claiming a single origin and without retelling Mexica precursors as if they were the same story.

**7. The Loch Ness photograph.**
The famous 1934 "surgeon's photograph" (the long-necked silhouette) was confessed as a hoax in 1994 by one of the men involved. The book must not present it as evidence. Frame: "In the nineteen thirties, a photograph was printed in a newspaper that became known all around the world. Many years later, one of the men who made the photograph said that the creature in the picture was a model on top of a toy submarine." This is in Chapter 6.

**8. The Yeti and the Sherpa.**
The Sherpa, Tibetan and other Himalayan peoples have lived with the story for many generations. It has spiritual meaning in some communities. The book speaks of "the people of the high mountains" and "the mountain villages" with respect, names the regions (Nepal, Tibet, Bhutan, parts of northern India) and does not collapse "yeti" into "abominable snowman" (a phrase from a 1921 British newspaper translation error). Chapter 6 covers the Western expeditions and the fact that some hair samples turned out to be from local bears.

**9. Pop-culture vs. folklore drift.**
Bram Stoker's *Dracula* (1897) is not the same as Slavic vampire folklore. Tolkien's dragons are not Beowulf's. Hollywood werewolves are not the Beauce loup-garou. Chapter 4 ("how the story grew") is the right place to acknowledge the drift; the rest of the book stays grounded in original sources.

**10. Specific names, dates, and witnesses.**
Where a name or date is load-bearing, it must be in `SOURCES.md` and it must be checked. Don't invent witnesses ("a farmer named John saw…"). Where biomes could mostly avoid proper nouns, this series cannot — but the discipline is: a proper noun in the manuscript means a row in `SOURCES.md`.

**11. Skeptic-vs-believer culture war.**
Avoid the framing entirely. We are not in this fight. The narrator is curious, never credulous, never condescending. The right tone is "look at what people have told each other for hundreds of years — isn't that something."

**12. Chatterbox code-switching.**
Mechanical, not editorial — but the biggest cause of bad audio in this series will be a Latin-script creature name left inside a CJK or Arabic `tts.text`. The wrapper's existing validation block catches text/tts.text divergence; it does **not** catch "the right characters but in the wrong script for that language." Add a per-book post-translation check: for ja / ko / zh / ar / he / el / ru / hi, every Latin-script character in `tts.text` is a defect unless it is a digit or punctuation that the validator already strips.
