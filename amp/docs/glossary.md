# Glossary

Every term a lesson uses is defined once, in `src/glossary/`, and linked where it appears. Lesson strings stay plain text: nothing in them marks a term. Words are found when the text is linked.

## Entries

`src/glossary/entries/<strand>.ts` holds one `GlossaryEntry` per meaning (`src/glossary/types.ts`):

- `id`: kebab-case, one per meaning (`hypotenuse`, `range-function`).
- `term`: the word as shown, typeset like lesson text (`$y$-intercept`, `$\pi$`).
- `forms`: lowercase words matched in prose, with plurals and variants. Leave it empty for notation (`pi`, `union`) and for words too common to link; such an entry is still reachable from a method's term list.
- `plain`: at most 30 words, in everyday language, for a learner one level below `band`. Say what the thing is and how to recognise it.
- `example`: one concrete case, typeset like any lesson text (`src/content/AGENTS.md`, "Mathematical typography").
- `figure`: a key into `src/glossary/figures.ts`. Figures are scenes-v1 builders, so every client that can open a lesson can draw them.
- `uses`: every other glossary term the definition's text uses. This is the drill-down: a learner can tap any of them. The graph is acyclic, and an entry only uses terms from the same or an earlier band, so every chain ends in everyday words.
- `band`: where learners first meet the term.
- `autoLink: false`: the word is ordinary English or has another mathematical meaning (`range`, `mean`, `product`, `similar`). It links only where a sense names it.
- `noLink`: forms that are ordinary words in the entry's own text ("this means").

To add an entry, put it in the strand file, list every glossary term its text uses in `uses`, and run `node --import tsx --test tests/glossary.test.ts` (a core test, so it gates pull requests). The test names any missing `uses`, later-band use, cycle, duplicate form, or unknown term id in a method.

## Method terms

`ProblemMethod.terms` lists term ids. A pair `[id, note]` adds a short note for that problem type, such as its symbols ("$m$ in $y = mx + b$"). The note follows the glossary definition, so it never restates it. `problemLesson()` still sends `terms: {term, meaning}[]`, built from the glossary (definition, example, note), and adds `glossary: GlossaryCard[]`: every entry the lesson's text and terms use, plus everything reachable through `uses`.

Methods still define each term in words at its first use. The glossary is the reference, not a replacement for a complete explanation.

## Linking and senses

`linkTerms(text, context)` (`src/glossary/link.ts`) splits text with the same segmentation as MathText and matches forms only in prose: case-insensitive, at word boundaries, longest form first ("unit rate" before "rate"). It never matches inside `$…$` or a formula MathText would typeset. `firstUses(block)` keeps only the first link to each term in a block.

An ambiguous word needs a sense where it is used:

- `Lesson.senses` and `Lesson.noLink` for a reference lesson;
- `ProblemMethod.senses` and `ProblemMethod.noLink` for a method;
- `TemplateMetadata.glossarySenses` and `glossaryNoLink` for a template's generated hints and explanations.

A sense maps a lowercase form to an id (`{ range: "range-function" }`); it also covers the other forms of that entry ("ranges"). `noLink` lists forms that are ordinary words there ("the mean time").

`glossaryFor(texts, context, extra)` (`src/glossary/resolve.ts`) returns the entries a payload needs.

## The unresolved baseline

`tests/glossary-baseline.test.ts` (a content test) reads every lesson, method and principle, and the hints and explanations of 20 instances of every template. An ambiguous form with no sense or `noLink` is unresolved. `tests/fixtures/glossary-unresolved-baseline.json` records the occurrences that existed when the glossary landed, per owner and form. It only shrinks:

- a new unresolved occurrence fails the test: add a sense or `noLink` where the text lives;
- a resolved occurrence still in the baseline also fails: run `GLOSSARY_BASELINE=write node --import tsx --test tests/glossary-baseline.test.ts` to shrink the file. The write refuses to add occurrences.

The test also requires an entry for each word of its core vocabulary list.

## Term cards in the app

Lessons, answer explanations and hints carry their cards as two additive fields (`GlossaryPayload` in `src/glossary/types.ts`); older clients ignore them, and offline packs are unchanged:

- `glossary: GlossaryCard[]`: every entry the payload's texts use, then every entry reachable through `uses`, so a learner can drill down without another request. A card's figure is a built scenes-v1 `Scene`.
- `glossaryLexicon`: every form the linker matched in the payload's texts, mapped to the entry it means there or to `null` (an ordinary word, or ambiguous with no sense). Each card carries the same for its own definition and example in `lexicon`.

`glossaryPayload(texts, context)` (`src/glossary/resolve.ts`) builds both. The server adds them to `ProblemLessonView`, to every hint (the batch's preloaded hints and `POST …/hints`), and to attempt and skip responses (`withGlossary` in `src/server/app.ts`), using the template's `lessonGlossaryContext`. They are never stored with an attempt.

The client never loads the glossary. `linkProse(text, lexicon)` (`src/glossary/scan.ts`) matches only the lexicon's forms with the linker's own boundaries, longest first. Every form the server's linker found is in the lexicon, so this reproduces its links exactly.

On the web:

- `GlossaryProvider` (`src/web/ui/Glossary.tsx`) takes a payload; `GlossaryBlock` marks texts that link only the first use of each term among them. `Glossary` is both, for one list. `MathText` links prose inside a block and leaves formulas alone; outside a block, or with a payload that has no glossary fields, it renders exactly as before.
- `Term` (`src/web/ui/Term.tsx`) is the word itself: a button set as text, with a dotted underline, a raised "?", and a 44 px hit area drawn by a pseudo-element so the line never changes.
- `TermCard` (`src/web/ui/TermCard.tsx`) is a native modal dialog, so it stacks above an open practice panel. Below 768 px it is a bottom sheet with a 44 px grab area; from 768 px up it sits beside its word, inside the viewport. Terms in its definition drill down, with Back and a trail. Escape, Close, the scrim or dragging the sheet down close it, and focus returns to the word. Each step replaces the panel inside a transparent full-screen dialog, so nothing on screen shifts.
- `KeyWords` opens a lesson with its terms in first-use order. "Principle and definitions" still ends the lesson, so definitions repeat on purpose.

Styles are in `src/web/ui/glossary.css` (tokens only). `npm run test:glossary-ui` checks all of this in Chromium and WebKit at 320, 390, 768, 1024 and 1280 px, light and dark; review screenshots are in `docs/reviews/glossary/`.
