# AMP publication design

AMP books connect mathematical language, pictures, symbols and independent work. A book is a deliberate sequence of authored pages with room to think and write. The publication renderer produces screen-readable HTML and printable PDF from the same semantic content. It must preserve mathematical meaning, page composition and answer references across both formats.

## Editorial purpose

Each chapter develops one coherent idea through a question, a model, an explanation, guided practice, independent work and transfer. A page should have a clear instructional purpose a reader can state in one sentence. A worked example earns its space by explaining a decision or relationship, rather than listing arithmetic already visible in an equation. Problems that invite conjecture must acknowledge when the evidence allows more than one answer.

The sample fraction chapter establishes the whole and equal partitioning before introducing operations. It connects strips, number lines and symbols, includes non-examples, and asks learners to explain equivalence. Its authoring source owns the prose, task identifiers, mathematical values and solutions. The publisher owns their presentation and checks structural integrity without inventing teaching content.

## Type and page geometry

Use US Letter portrait pages with 0.6-inch outer margins and a minimum 0.65-inch binding margin. Reserve a consistent footer for the book title, chapter and page number. Keep the working area within 7.2 by 9.7 inches. Headings, figures and exercises must fit as authored; overflow is an export error, never permission to clip or shrink a page silently.

Set reading text at 11.5–12 points with a 1.4–1.5 line height. Use a legible humanist sans-serif for navigation and task labels, with a sturdy book serif for extended explanations when available. Provide local fallbacks and wait for fonts before export. Body lines should usually hold 55–80 characters. Mathematical quantities need clear minus signs, multiplication signs and visible fraction bars. Keep numerator and denominator together; do not rely on slash fractions for dense worked examples.

Page titles use 23–28 points, section headings 15–17, task headings 12–13, captions at least 10. Small footers may use 9 points. Hierarchy comes from scale, space and weight. Avoid all-capital paragraphs, decorative scripts and oversized titles that consume writing space.

## Color and visual grammar

Use deep teal ink (#16483f), near-white paper (#fffdf7), muted teal surfaces (#e5f1eb), and warm amber (#b56a1d) for a contrasting quantity or focal relationship. Body copy uses near-black (#182723). Neutral rules use a darker gray that survives photocopying. The PDF page background is white; broad colored fills are reserved for small instructional callouts.

Color has a mathematical job: corresponding quantities retain the same role across adjacent diagrams. A second quantity also changes hatch, border or shape, so grayscale printing preserves the distinction. Labels explicitly name the whole, unit, selected part, axis or group. Decorative icons must never become an extra counting object.

All mathematical diagrams are semantic SVG. Their source records quantities, partitions, endpoints and relationships; authors do not position individual pixels. Layout may adapt to the page, but equal quantities remain equal in scale whenever comparison depends on size. A picture that is not to scale must say so. Fraction strips used for comparison share a declared whole length; number-line points use exact rational positions. Area models show equal subdivisions and distinguish overlap from either component. A unit key remains adjacent to every unfamiliar model.

## Page archetypes

| Archetype | Instructional purpose | Composition |
| --- | --- | --- |
| Chapter opening | Pose a question and establish purpose | One strong diagram, short invitation, goals and prerequisite reminder |
| Concept exploration | Connect language to a mathematical object | Explanatory paragraphs beside or immediately above a large labeled model; one prediction before the conclusion |
| Worked example | Make reasoning visible | Numbered decisions with matching diagram stages; a final reasonableness check |
| Guided practice | Transfer part of the reasoning to the learner | One scaffolded task followed by less-supported tasks; space beside each step |
| Comparison and error analysis | Expose a distinction or misconception | Two aligned representations, a precise question, and room to justify |
| Independent studio | Practice without solution cues | Two to five substantial tasks with response space sized to the requested work |
| Transfer investigation | Apply an idea in an unfamiliar context | A coherent situation, data or diagram, connected tasks and room for multiple approaches |
| Retrieval and reflection | Check retention and connections | Mixed prior concepts, confidence-independent explanation prompts and a concise self-check |
| Solutions and teaching notes | Explain answers and guide follow-up | Stable task references, reasoning and accepted alternatives; specific misconceptions and next practice |

Adjacent pages should not repeat a single box-and-paragraph composition. Variety follows instructional purpose. A diagram-led concept page, a side-by-side comparison and a spacious investigation can share a consistent typographic system without looking interchangeable.

## Sequence language and pictures together

Introduce what to notice before showing the formal rule. Place the diagram at the point where the reader needs it. Follow the model with a sentence connecting its parts to the notation. Then ask a short check that reveals whether the relationship was understood. Do not place an unexplained diagram after a long explanation or refer vaguely to a picture several pages away.

For a fraction-equivalence page, the sequence is: identify one whole; show the original partition; subdivide each part equally; preserve the selected amount; name the new parts; connect the unchanged amount to an equation. The explanation must say what changes and what stays constant. Transfer asks the learner to draw or explain a different case, not merely repeat a numerator calculation.

## Practice, workspace and solutions

Every task has a stable ID, a clear prompt and a response-space declaration: ruled explanation, blank drawing area, grid or a compact numeric answer. Do not print answer lines through a diagram. Use roughly 0.3–0.35-inch ruling for elementary handwriting and at least 1.25 inches of height for a drawn model; larger construction tasks need more. A page should contain fewer tasks when reasoning requires more space.

Guided tasks may provide a first step or partial diagram. Independent tasks remove those cues. Transfer tasks change the context or representation while preserving the underlying idea. Avoid presenting decorative story variants as evidence of transfer.

Solutions appear in a separately labeled section. Each task links to exactly one solution entry, which states the answer, explains why, and includes units and meaningful equivalent forms. Open tasks supply an example response and acceptance criteria rather than pretending there is only one valid sentence. Parent notes describe what to listen for and which earlier idea to revisit; they do not equate one correct answer with mastery.

## Accessibility and print translation

HTML uses real headings, paragraphs, ordered steps and tables. SVG figures carry descriptive alternative text and visible captions. Alternative text describes the quantities needed to reason, without disclosing an answer absent from the visual. Screen reading order follows the instructional sequence. Meaning must survive color removal and zoom to 200 percent.

PDF export must retain selectable text, working internal links where supported and embedded/local fonts. A browser PDF alone does not establish tagged-PDF or PDF/UA compliance; report that limitation until a dedicated accessibility audit passes. Offer HTML alongside PDF. Do not claim accessibility certification based solely on contrast checks.

Print testing includes Letter at actual size, grayscale, and a physical-size preview of diagram labels. Keep diagrams as vectors. Allow generous white space and light backgrounds so inexpensive printers produce clear pages. Do not depend on a browser's background-graphics setting for mathematical distinctions.

## Authoring contract and quality gates

The book declares identity, version, audience, prerequisites, learning objectives and ordered pages. Each page declares its kind, title and ordered typed blocks. Blocks include text, callout, worked example, task, diagram and solution; diagrams use exact semantic values. Unknown block kinds, duplicate IDs, missing solutions, invalid fractions and impossible partitions must fail validation. Untrusted authoring text is escaped, never treated as HTML.

Automated export verifies that every page fits its content box, that task references resolve, that mathematical diagrams preserve their input counts and rational coordinates, and that the expected number of PDF pages was produced. Tests inspect mathematical relationships rather than comparing only snapshots. A human reviewer separately reads the mathematics and inspects the actual rendered opening, concept, guided, independent, transfer and answer pages at print size.

A finished chapter includes the authored source, reproducible export command, rendered HTML/PDF, automated validation results and specific independent review observations. Passing code tests is necessary but does not establish editorial depth, mathematical completeness or visual quality. The release record should identify what was actually inspected and any unresolved issues.

## Build the fraction field guide

From `amp`, install the package dependencies, Playwright Chromium, and Poppler (`pdfinfo` and `pdftotext`), then run:

```sh
npx tsx scripts/publish-book.ts artifacts/books/fraction-field-guide
```

The authoring source is `books/fraction-field-guide/book.ts`; its typed contract is `books/fraction-field-guide/schema.ts`. The command writes `index.html`, `fraction-field-guide.pdf`, representative page screenshots, extracted PDF text and `validation.json` to the selected directory. Add `--all-pages` after the output directory to render a PNG of every page for review. An existing artifact with the same filename is replaced. Keep generated output outside source control unless a publication release explicitly calls for it.

The exporter rejects unresolved solutions, invalid diagram quantities and page content that extends outside the printable composition. This is a local content build, not an upload or publishing action. The exported HTML is a print preview with fixed Letter-page geometry; readers on small screens may need horizontal scrolling. The PDF includes browser-generated tags and an outline. A responsive reading edition, A4 output and a dedicated PDF accessibility audit require additional work. Validation records SHA-256 hashes of authoring and publisher sources, HTML and PDF; it checks the physical PDF page count and extracted headings independently with Poppler.

The shared authoring contract is `src/publishing/schema.ts`. `MathBook` describes
any authored math book; the fraction schema preserves its existing type exports.
An `array` diagram represents equal unit cells in rows and columns. Optional
interior row and column splits partition those cells into disjoint regions;
they do not represent overlapping fractional shares. Each dimension supports
1–12 cells. Supply short axis labels, a caption and alternative text that state
the unit and context. Dashed split boundaries preserve the partition in grayscale.
Opening-page arrays use a cover composition whose multiplication equation is
derived from the row and column counts. Print layout remains Letter-oriented;
readers must implement the array variant before registering an array-based book.
