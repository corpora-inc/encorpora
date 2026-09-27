# ¡AHA! mathematics curriculum v1

The bundled catalog contains **229 numbered K–8 CCSS content standards and 88
lettered component references**, across all 43 grade/domain combinations.
`standards.ts` supplies original short navigation summaries and exact identifiers;
it does not reproduce the standards' explanatory prose. Every record links to the
official grade/domain page at the [Common Core State Standards Initiative](https://www.thecorestandards.org/Math/).
The full official requirements, examples, grade-specific restrictions and context
remain authoritative. Source review date: 2026-09-27. This is an app-authored
mapping, not approval or certification by CCSS's authors.

Identifiers, cluster letters and component references were checked against the
linked grade/domain pages. The official [mathematics document](https://corestandards.org/wp-content/uploads/2023/09/Math_Standards1.pdf)
provides an alternate stable source; K–8 content is on printed pages 9–56.
The eight mathematical practices are pedagogical cross-cutting goals; they are
not counted as numbered K–8 content standards or as independently graded skills.
The current app does not claim state-specific alignment beyond CCSS.

| Grade | Numbered standards | Graded numerical facets | Guided-only standards |
| --- | ---: | ---: | ---: |
| K | 22 | 4 | 18 |
| 1 | 21 | 9 | 12 |
| 2 | 26 | 10 | 16 |
| 3 | 25 | 15 | 10 |
| 4 | 28 | 13 | 15 |
| 5 | 26 | 12 | 14 |
| 6 | 29 | 14 | 15 |
| 7 | 24 | 7 | 17 |
| 8 | 28 | 6 | 22 |
| Total | 229 | 90 | 139 |

`coverageAudit()` emits the exact machine-readable ID lists. Tests check catalog
counts, unique IDs, provenance and every graph edge. A **graded numerical facet**
means the app verifies a supported task, not that it assesses every requirement
of the corresponding standard. For example, fraction calculation cannot certify
a learner's explanation of a visual proof, and computing prism surface area does
not establish skill in constructing nets. No whole-standard “mastered” label
should be inferred from the numerical projection.

The 139 guided-only records remain navigable through `getSkillNeighborhood()`
and `buildTeachingContext()`. They can support concise teaching and discussion,
but cannot produce scored tasks or progress from an LLM's answer key. Coverage
of drawing/construction, clock and measurement tools, proof/explanation, general
word-problem modeling, irrational-number reasoning, transformations, systems,
statistical inference and additional subskills requires further independently
checkable task families. Keep those gaps visible when reporting coverage.

Prerequisite edges are **¡AHA!-inferred** and labeled as such on each skill. CCSS
provides grade/domain structure, not this application's dependency graph. The
LLM receives evidence and a neighborhood and proposes a next question; local code
validates the proposal rather than assigning a hidden global ability score.
No Dynawalla assessment engine or curriculum implementation was reused.

Local generators are legitimate deterministic practice, labeled `source: local`;
they never impersonate a paid model response. The test file's fixed examples are
verification fixtures and are not selected as live lesson content.
