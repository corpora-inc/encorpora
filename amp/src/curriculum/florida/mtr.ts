import type { FloridaRow } from "./types";

const note =
  "Cross-cutting process standard embedded in instruction for every benchmark; AMP item practice does not assess it and it is not counted as reconciled.";
const row = (n: number, summary: string, limitation: string): FloridaRow => [
  `MA.K12.MTR.${n}.1`,
  "pdf p.12-15",
  summary,
  "Applies to every grade and course; teacher-facing clarifications describe classroom practice.",
  "unreviewed",
  [],
  [],
  `${limitation} ${note}`,
  "",
  "",
];

/** Mathematical Thinking and Reasoning standards are recorded, never claimed. */
export const floridaMtrRows: readonly FloridaRow[] = [
  row(
    1,
    "Persist in effortful learning alone and with others, adjusting methods on hard tasks.",
    "Persistence, questioning and collaboration are classroom behaviours, not graded answers.",
  ),
  row(
    2,
    "Show understanding by representing a problem in several ways and choosing a fitting representation.",
    "Individual problems may use one representation; choosing among representations is not assessed across a task.",
  ),
  row(
    3,
    "Complete tasks accurately and flexibly with efficient, adaptable methods.",
    "Accuracy is graded per item; method choice and efficiency are not assessed, and AMP never enforces speed.",
  ),
  row(
    4,
    "Discuss, compare and critique mathematical thinking, justifying methods and results.",
    "Oral or written discussion and justification are outside choice and numeric response formats.",
  ),
  row(
    5,
    "Notice and use patterns and structure to solve problems and generalise.",
    "Pattern use appears inside individual items but is not separately measured.",
  ),
  row(
    6,
    "Judge whether results and methods are reasonable and monitor progress.",
    "Reasonableness checks appear in selected items but are not separately measured.",
  ),
  row(
    7,
    "Apply mathematics to real-world situations and to other subjects.",
    "Context problems exist, but breadth of application and other-subject use are not measured.",
  ),
];
