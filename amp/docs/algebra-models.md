# Exact algebra book models

Illustrated mathematics books use semantic diagrams shared by the printable publisher and the immersive reader. Algebra models describe quantities and relationships; renderers compute the drawing. These models do not generate practice questions, assess explanations, or establish curriculum coverage.

A `balance` represents a level physical balance. Each pan contains zero to four identical unknown bags and a labeled nonnegative unit mass. The equality must admit a nonnegative value for the common unknown. Equal bag counts require equal unit masss. Icon size is schematic: the numeric labels carry the mass, and the unit label specifies its meaning. Use symbolic reasoning for equations with negative quantities; do not depict negative physical masses.

A `coordinate-plot` has explicit integer bounds and tick steps, units for both axes, exact rational points, and optional lines or segments. Each axis includes zero and permits at most eight intervals. Independent axis scales are labeled; visual line angle alone does not establish a rate.

- A line without a domain is clipped to the window using exact rational intersections. Arrowheads indicate continuation.
- A line with a domain has two included endpoints. Both endpoints must fit inside the window; filled endpoint markers show the closed interval.
- Discrete points are not connected automatically. Author a segment only when the intervening relationship is intended.
- Segments can represent a vertical relation or a rise/run construction. A zero-length segment is invalid.
- Point labels have at most three characters; segment labels have at most eight. Point label positions select a quadrant. Longer explanations belong in the caption or lesson text.

A `value-table` preserves authored row order and repeated inputs. This permits counterexamples to the function rule. An output may be `null`, rendered as an accessible question mark. Inputs must be known exact rational quantities; zero is a value, not a blank. Headers name the quantities and units. Tables contain one to six rows.

Every diagram requires an identifier, alternative text and a caption. Validators enforce quantity, domain and layout bounds, but an author must also inspect conceptual correspondence, neighboring label collisions and visual emphasis in the completed page. A valid plot does not establish that an accompanying equation, story or answer is correct.

Run `npx tsx scripts/verify-book-models.ts` for standalone phone and landscape model checks. Run `npx tsx scripts/verify-algebra-reader.ts` for complete reader frames at 320×568, 390×844 and 844×390, plus physical Letter proof pages. Both checks are included in `npm run test:ui`. The latter writes screenshots, a tagged proof PDF and layout results under `artifacts/algebra-reader`. The proof pages are layout fixtures, not an instructional book or a publication certification.

Publish an authored book through the registered-book CLI. Publication provenance includes the semantic contracts, exact arithmetic helpers and shared drawing source. Review the resulting complete pages and task keys independently before claiming reviewed instructional content.
