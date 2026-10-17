# Illustrated books in the learning workspace

The lesson library opens a reading edition of each released book. Practice links to a book when its instructional alignment includes the current skill. The reader presents a picture, a short passage, a worked decision, or a task in a dedicated workspace. Previous, Next, and Contents provide navigation; a worked example retains its question beside each step. A task's comparison panel contains its reasoned answer. Reading tasks invite drawing and explanation on paper; they are not automatically graded assessments.

The reading and print editions share the same authored text, rational quantities, task identities, and answer keys. Screen diagrams use separate layouts with HTML labels so that a print-sized illustration does not make phone text unreadable. Long prose is divided at sentence boundaries without removing text. A model from the current section can be reopened while considering a task. Ordinary phone layouts keep navigation in the viewport; internal scrolling provides an accessibility fallback for enlarged text or unusually short windows.

Reading position is retained in memory per learner and book while the app is open. Closing the reader restores its opening control and the library's scroll position. Signing out clears these positions. Cross-device bookmarks and offline book storage are not available.

## Delivery and learning evidence

Book metadata and book contents have separate endpoints. Reading and downloads require an owned learner, verified parent consent, and an active license in hosted mode. Development access is limited to the local development server. Reading a related book before submitting a problem marks that instance as assisted. It does not award progress or change an already recorded attempt. A book visit unrelated to the active skill does not mark that problem as assisted.

PDF delivery requires a publication manifest whose book ID, version, semantic-content hash, page count, and PDF hash match the current catalog. Missing or mismatched artifacts return an availability message while the reading edition remains accessible. Download bytes are bounded and read from the same open file handle used for validation. Authenticated responses prohibit caching.

Publish the book with `npx tsx scripts/publish-book.ts` from `amp`, following [publication design](publication-design.md). Install its PDF and `validation.json` together under `amp/artifacts/books/<book-id>/`. This is a release artifact, not a generated-on-demand inference request.

## Verification

`npm test` checks that reading frames retain every authored passage, worked step, and task. The database suite checks parent ownership, licenses, immutable assistance evidence, and missing or corrupt publication artifacts. With the test database configured, `npx tsx scripts/verify-book-ui.ts` exercises every reading frame at 390×844, 320×568, and 844×390 and captures the diagram screens for visual review. These browser checks use a dedicated learner and isolated local ports.
