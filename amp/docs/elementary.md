# K–2 arithmetic and place value

This cluster teaches small-group changes, missing parts, equality, ten-based strategies, and place-value exchanges. Twenty-four deterministic problem families connect to twelve original reference lessons. Each lesson produces printable reference instruction, a workbook, and matching worked solutions through the shared publication pipeline. These compact lessons are not a complete textbook treatment.

The material is one arithmetic and place-value slice. It is not the complete kindergarten, first-grade, or second-grade curriculum. Geometry, measurement, data, parity, array reasoning, broad story coverage, and other requirements need additional instruction. No skill or standard is promoted to verified mastery by adding these tasks.

## Instructional progression

Kindergarten work uses groups through ten, missing parts, ten-frame complements, and teen numbers. First-grade work adds unknown story amounts, equality, three small addends, strategies that cross ten, counting through 120, and tens-and-ones models. Second-grade work introduces hundreds, noncanonical unit exchanges, several two-digit addends, three-digit regrouping, larger skip-counts, and two changes in a story.

`elementaryGrades` identifies the intended grade of each template. The engine's broad K–2 band is not a substitute for the skill graph or a learner's demonstrated readiness. The several-addends and counting lessons have explicitly marked progressions; a parent should begin with their smaller-number sections before introducing the larger-number extensions.

Prompts ask one bounded numerical question. Hints support a strategy without stating its answer. Explanations show the relevant parts or exchanges, and parent notes invite physical models and discussion. Learning to explain, choose a representation, or recall facts fluently requires evidence beyond a correct numeric response.

## Requirement matrix

`src/content/elementary-coverage.ts` enumerates all 33 numbered standards in K.OA, K.NBT, 1.OA, 1.NBT, 2.OA and 2.NBT, plus the five lettered place-value components. Each record links to its official source, names associated template families, and states remaining requirements. Every record is either `partial-practice` or `planned`.

The sources reviewed on October 17, 2026 are [kindergarten operations](https://www.thecorestandards.org/Math/Content/K/OA/), [kindergarten place value](https://www.thecorestandards.org/Math/Content/K/NBT/), [grade-one operations](https://www.thecorestandards.org/Math/Content/1/OA/), [grade-one place value](https://www.thecorestandards.org/Math/Content/1/NBT/), [grade-two operations](https://www.thecorestandards.org/Math/Content/2/OA/), and [grade-two place value](https://www.thecorestandards.org/Math/Content/2/NBT/). Short labels are original navigation descriptions; official qualifications and examples control the source requirements.

The matrix explicitly leaves comparison notation, written number names, some operation domains, independent reasoning, and fluency unassessed. It does not infer standard completion from the presence of a template. Generated explanations are teaching content, not evidence that the learner can produce the explanation.

## Models and publication

Ten-frames have two rows of five places. Round and square counters distinguish parts without relying only on color. Empty places are visually distinct. A removal problem states that the picture shows its starting group.

Base-ten models preserve unit area ratios: one square represents one, a rod contains ten equal unit squares, and a flat contains ten rows of ten. Models can include up to nineteen ones or tens so that an exchange is an actual change of grouping. Their total value is bounded by 999. SVGs use a viewBox rather than a fixed pixel width, and accessible descriptions expose the same quantities as the visible model.

Schema checks reject overflowing frames, fractional block counts, invalid capacities, and oversized model totals. Deterministic tests verify exact answers from public givens, grade constraints, zero places, unit exchanges, and matching publication references. A separately derived Python solver checks the exported cases without importing the generator. Independent worker review is still required before recording any instructional-review evidence.
