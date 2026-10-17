# Early number diagrams

The publisher and book reader share exact vector models for counting, ten-frame structure and base-ten exchanges. The models describe mathematical givens; they do not contain a grading answer or imply learner mastery. An authored book supplies directions, accessible descriptions, captions and task keys.

`EarlyNumberModel` in `src/publishing/early-number-models.ts` extends the common `Diagram` contract. Every diagram needs an ID, caption, alternative text and a short unit label. Counts come from unique occupied cells rather than a second authored total.

- **Ten-frame:** one or two frames, each with two rows of five cells. `occupied` uses zero-based row-major indexes across the frames. An empty array draws the empty frame. Optional `emphasized` indexes must refer to occupied cells.
- **Base-ten:** zero through six rods and zero through nineteen loose ones. Each rod contains ten square cells identical in size to the loose ones. Noncanonical forms such as one ten and fourteen ones are valid. `emphasizedTens` and `emphasizedOnes` index existing rods and units independently.
- **Counting collection:** each panel contains up to twenty unique positions on a six-column, four-row grid. Empty panels retain their mat boundary. A single collection has one panel; comparison and conservation have two distinctly labeled panels. Conservation requires equal counts. Both panels share the same unit label and circle or square icon.

Emphasis requires a short explicit legend. Hatching and outlines accompany color. Each hatch is a finite line segment bounded inside its unit; no repeated SVG pattern resources are needed in the PDF. The author must say whether emphasized units are added, removed, compared or simply noticed; the renderer does not infer an operation. Unit and emphasis labels have a 28-character limit, and panel labels have a 16-character limit. Longer explanations belong in surrounding book content.

The bounds describe renderer capacity, not grade alignment. Authors must choose an arrangement and quantity appropriate for the intended task. The renderer permits noncanonical base-ten models without assigning them a grade or standard.

`EarlyNumberDiagramFigure` is the common print and screen drawing. Its unit geometry is shared, including printable manipulation tools. A book that needs larger cutout pieces must size the whole diagram consistently, preserving the ratio between rods and loose units. The default print width is 4.2 inches; a wider cutout model requires an explicit book layout and physical proof. A collection comparison must never resize individual panels independently to suggest a quantity change.

Run `npx tsx --test tests/early-number-models.test.ts` for semantic invariants and `npx tsx scripts/verify-early-number-reader.ts` for actual 320/390-pixel portrait and 844-pixel landscape reader proofs, readable labels/unit geometry, and physical PDF page bounds. The proof artifact is a layout fixture, not a published textbook. Existing books retain their presentation; an early-reader book profile and its compatibility declaration are separate from these diagram primitives.
