# The Equal Groups Workshop

**Build, Break Apart, and Share** is an original illustrated multiplication and division book. It has a grade-two entry, a grade-three core, and selected grade-four extensions. Learners arrange objects, interpret diagrams, choose strategies, repair errors, solve unfamiliar problems, and explain decisions. An adult may read aloud so reading difficulty does not obscure mathematical understanding.

The book connects equal groups and arrays to flexible multiplication strategies, rectangular area, both meanings of division, and inverse relationships. Later activities distinguish complete-kit counts from minimum seating capacity, compare additive and multiplicative relationships, and use factors to design identical supply kits. An optional ribbon-sharing example connects whole-number division with a fractional share.

The source contains 45 instructional, workshop, reflection, and guide pages; 88 learner tasks; and 25 exact semantic diagrams. Every task has a reasoned solution with units and acceptance criteria for open responses. Solution pages use balanced groups of at most five entries. Print pagination is defined by the shared publisher; layout validation must pass before producing a publication.

## Use

Start with counters and the entry tasks, or try a workshop if the ideas are familiar. Keep group count, group size, and total distinct. Accept different array orientations when the labels are consistent. Save the delayed-return page for another day, mix in other mathematics, and use an uncertain response to select a short explanation or model.

A learner may speak, arrange objects, draw, or write. Tasks asking for a model or explanation need discussion or written review. The related numeric practice templates do not grade those responses. Finishing the book does not certify fluent recall or complete standards mastery.

## Content and validation

- `book.ts` exports `equalGroupsWorkshop`; chapter modules contain the original instruction and tasks.
- `authoring.ts` associates each task with one solution and groups keys without sparse final pages.
- `alignments.ts` links actual pages and tasks to catalog skills, numbered standards, and related bounded practice templates. Each relationship includes scope and unassessed requirements.
- `book.test.ts`, included in the package test command, checks unique anchors, complete task/key correspondence, model arithmetic, scoped references, remainder decisions, and exhaustive inventory constraints.

From `amp`, run `npm test`, `npm run tsc`, and `npm run build`. Publication export additionally requires the shared book renderer and its page/diagram overflow checks. Independent mathematical and visual review complements these structural tests; tests alone do not evaluate all prose or instructional quality.

## Scope

This is a focused unit, not a complete grades-two-through-four curriculum. The early array and parity activities respect their small grade-two domains. The core builds multiplication/division meaning and strategies, with selected retrieval tasks rather than a claim that all facts have been memorized. The grade-four pages illustrate small multidigit calculations, remainder decisions, comparisons, and factors; they do not cover full four-digit domains, two-digit-by-two-digit multiplication, every factor pair through 100, or all multistep story forms. Rectangular area does not establish mastery of rectilinear composite-area problems. The fraction bridge is a reference to separate fraction instruction.

Official source links and review dates are preserved in `equalGroupsSources`. Descriptions, examples, diagrams, tasks, and explanations are original editorial content; alignment does not imply approval by a standards publisher.

The three related runtime families have explicit bounds in `practice.ts`: multiplication factors 2–12; exact division with divisor and quotient 2–12; and rectangle sides 2–15 centimeters. These include selected values beyond the core one-digit fact domain and omit zero/one fact practice. They are related calculation support, not a complete assessment of the book.
