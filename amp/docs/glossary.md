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

To add an entry, put it in the strand file, list every glossary term its text uses in `uses`, and run `node --import tsx --test tests/glossary.test.ts`. The test names any missing `uses`, later-band use, cycle or duplicate form.

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

`tests/glossary.test.ts` reads every lesson, method and principle, and the hints and explanations of 20 instances of every template. An ambiguous form with no sense or `noLink` is unresolved. `tests/fixtures/glossary-unresolved-baseline.json` records the occurrences that existed when the glossary landed, per owner and form. It only shrinks:

- a new unresolved occurrence fails the test: add a sense or `noLink` where the text lives;
- a resolved occurrence still in the baseline also fails: run `GLOSSARY_BASELINE=write node --import tsx --test tests/glossary.test.ts` to shrink the file. The write refuses to add occurrences.

The test also requires an entry for each word of its core vocabulary list.
