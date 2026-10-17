import { numberBuilders } from "./book.js";
export interface NumberAlignment {
  id: string;
  skillId: string;
  relation: "taught" | "practiced" | "reference";
  pageIds: string[];
  taskIds: string[];
  templateIds: string[];
  standardIds: string[];
  scope: string;
  unassessedRequirements: string[];
}
const row = (
  id: string,
  skillId: string,
  pageIds: string[],
  standardIds: string[],
  scope: string,
  unassessedRequirements: string[],
  templateIds: string[] = [],
  relation: NumberAlignment["relation"] = "taught",
  taskIds?: string[],
): NumberAlignment => ({
  id,
  skillId,
  pageIds,
  standardIds,
  scope,
  unassessedRequirements,
  templateIds,
  relation,
  taskIds:
    taskIds ??
    numberBuilders.pages
      .filter((p) => pageIds.includes(p.id))
      .flatMap((p) =>
        p.blocks.filter((b) => b.kind === "task").map((b) => b.id),
      ),
});
/** Selected instructional links, not complete standards or mastery claims. */
export const numberAlignments: readonly NumberAlignment[] = [
  row(
    "count-and-conserve",
    "count-to-20",
    [
      "route",
      "count-your-way",
      "same-seven",
      "empty-mat",
      "one-more",
      "same-eight",
      "make-a-collection",
    ],
    ["K.CC.B.4", "K.CC.B.5"],
    "One-to-one counting, cardinality, one more, zero and conserved rearrangements using small collections.",
    [
      "Scattered pictured collections are at most ten; this is not a complete count-to-twenty assessment.",
      "Entering a count does not demonstrate counting order or conservation reasoning.",
    ],
    ["count-objects"],
  ),
  row(
    "record-a-count",
    "write-numerals",
    ["make-a-collection", "empty-mat"],
    ["K.CC.A.3"],
    "Connect a small collection and zero to written numerals.",
    [
      "Selected numeral examples, not independent writing of every numeral 0–20.",
    ],
    [],
    "taught",
    ["name-collection", "zero-change"],
  ),
  row(
    "compare-collections",
    "compare-small-groups",
    ["matching", "same-eight"],
    ["K.CC.C.6"],
    "Match and compare groups of at most ten; reject spacing as quantity.",
    [
      "Human review is needed for matching and explanation; no runtime comparison family is bound.",
    ],
  ),
  row(
    "join-small-groups",
    "addition-within-10",
    ["join"],
    ["K.OA.A.1", "K.OA.A.2"],
    "Join small groups using a model and a story.",
    [
      "Selected whole-number joins; spoken and drawn reasoning are not automatically assessed.",
    ],
    ["join-within-10"],
  ),
  row(
    "remove-small-parts",
    "subtraction-within-10",
    ["take-away", "invent-story"],
    ["K.OA.A.1", "K.OA.A.2"],
    "Model removal, remaining quantity and a learner-created removal story.",
    [
      "Numeric practice does not assess constructing a story or explaining the action.",
    ],
    ["take-away-within-10"],
  ),
  row(
    "parts-of-a-whole",
    "number-bonds",
    ["five-parts", "covered-part", "see-seven", "ten-partners"],
    ["K.OA.A.3"],
    "Decompose selected wholes through ten and recover a covered part.",
    [
      "Not an exhaustive inventory of all decompositions; open alternatives need human review.",
    ],
    ["number-bond-missing"],
  ),
  row(
    "partners-of-ten",
    "make-ten",
    ["ten-has-room", "ten-partners", "full-ten", "mixed-return"],
    ["K.OA.A.4"],
    "Find a missing partner of ten and distinguish occupied from empty places.",
    [
      "Bound practice omits the zero/ten boundary; reading a numeric response does not show the strategy.",
    ],
    ["ten-frame-complement"],
    "taught",
    [
      "seven-to-ten",
      "eight-to-ten",
      "invent-ten-pair",
      "full-ten-empty",
      "mixed-ten",
    ],
  ),
  row(
    "teen-units",
    "teen-place-value",
    ["teen-team", "teen-repair", "teen-build"],
    ["K.NBT.A.1"],
    "Compose a ten and extra ones and repair a unit-confusion claim.",
    [
      "Selected teen examples and numeric practice, not learner-created explanations for every teen number.",
    ],
    ["teen-frame-compose"],
  ),
  row(
    "tens-unit-value",
    "tens-and-ones",
    [
      "one-new-unit",
      "name-twenty-four",
      "trade-back",
      "another-name",
      "zero-ones",
      "number-message",
      "later-return",
    ],
    ["1.NBT.B.2"],
    "Interpret tens and loose ones, zero ones and equivalent noncanonical names.",
    [
      "Diagrams use at most six rods; practice may use nine. The same ten-unit meaning transfers, but every representation is not pictured.",
      "Counting to120 and the complete 1.NBT.A.1 requirement are not claimed.",
    ],
    ["tens-ones-model"],
    "taught",
    [
      "ten-exchange",
      "name-24",
      "trade-24",
      "rename-32",
      "forty-or-four",
      "secret-number",
      "later-trade",
    ],
  ),
  row(
    "compare-place-values",
    "compare-two-digit",
    ["compare-tens", "same-tens", "mixed-return"],
    ["1.NBT.B.3"],
    "Compare selected two-digit amounts by tens, then ones.",
    [
      "Comparison symbols appear in the keys; independent recording with every symbol is not assessed.",
    ],
    [],
    "taught",
    ["compare-42-24", "compare-36-39", "mixed-units"],
  ),
  row(
    "change-tens",
    "ten-more-less",
    ["change-one-ten", "tens-as-units"],
    ["1.NBT.C.5", "1.NBT.C.6"],
    "Add or remove one ten and subtract selected whole-ten amounts.",
    [
      "No timed mental-fluency claim or complete enumeration of multiples10–90.",
    ],
    ["ten-more-or-less", "subtract-whole-tens"],
  ),
  row(
    "unknown-story-quantities",
    "addition-stories",
    [
      "parts-no-move",
      "unknown-change-story",
      "unknown-start-story",
      "more-than",
      "invent-story",
      "later-return",
      "reflection",
    ],
    ["1.OA.A.1"],
    "Distinguish part–whole, change, start-unknown and comparison situations.",
    [
      "Selected stories, not every within-twenty word-problem form. Numeric practice does not assess invented explanations.",
    ],
    ["missing-start-story"],
    "taught",
    [
      "parts-whole",
      "unknown-change",
      "unknown-start",
      "compare-difference",
      "invent-seven-three",
      "later-missing",
      "show-a-change",
    ],
  ),
  row(
    "missing-number-positions",
    "missing-addend",
    ["unknown-change-story", "missing-box"],
    ["1.OA.D.8"],
    "Recover a missing change and solve selected addition/subtraction equations with different unknown positions.",
    [
      "Bound practice checks a numeric change only, not the learner’s equation construction.",
    ],
    ["unknown-addend-story"],
  ),
  row(
    "add-through-ten",
    "addition-within-20",
    ["bridge-add", "bridge-add-try", "near-doubles"],
    ["1.OA.C.6"],
    "Use make-ten and near-double structure in selected sums through twenty.",
    [
      "No fluency certification. The remainder template assesses an intermediate part, not the total or a full strategy explanation.",
    ],
    ["add-within-20", "make-ten-remainder"],
  ),
  row(
    "subtract-through-ten",
    "subtraction-within-20",
    ["bridge-subtract", "bridge-subtract-try"],
    ["1.OA.B.4", "1.OA.C.6"],
    "Split a removal at ten and check subtraction with addition.",
    [
      "No fluency certification. The bridge template asks for the amount still to remove, not the final remainder.",
    ],
    ["subtract-within-20", "subtract-through-ten"],
  ),
  row(
    "equal-values",
    "equality",
    ["equals"],
    ["1.OA.D.7"],
    "Interpret equality as the same value, including expressions on either side.",
    [
      "Selection of a numeric missing part does not demonstrate a written equality argument.",
    ],
    ["balanced-addition"],
  ),
  row(
    "compose-new-tens",
    "add-two-digit",
    ["combine-units", "new-ten"],
    ["1.NBT.C.4"],
    "Combine like units and compose a new ten when enough ones accumulate.",
    [
      "Selected two-digit cases only; practice returns a total without grading the regrouping explanation.",
    ],
    ["add-ones-regroup"],
  ),
  row(
    "selected-within-hundred-addition",
    "addition-within-100",
    ["combine-units", "new-ten"],
    ["2.NBT.B.5"],
    "Use place-value strategies in selected sums below100.",
    ["Not complete within100 coverage or a fluency claim."],
  ),
  row(
    "selected-within-hundred-subtraction",
    "subtraction-within-100",
    ["unpack-for-subtraction", "repair-trade", "choose-a-method"],
    ["2.NBT.B.5"],
    "Preserve quantity when unpacking a ten and compare a compensating subtraction strategy.",
    [
      "Selected two-digit examples only; no hundreds/1000 instruction or automatic grading of constructed strategies.",
    ],
  ),
  row(
    "two-step-sequence",
    "two-step-stories",
    ["picnic"],
    ["2.OA.A.1"],
    "Track one removal and one arrival in a small two-step context.",
    [
      "One task is a transfer invitation, not complete two-step word-problem coverage.",
    ],
  ),
];
export function validateNumberAlignments(
  skills: readonly {
    id: string;
    alignments: readonly { standardId: string }[];
  }[],
  templates: readonly { id: string; skillId: string }[],
  standards: readonly { id: string }[],
  alignments: readonly NumberAlignment[] = numberAlignments,
): void {
  const skillMap = new Map(skills.map((s) => [s.id, s])),
    templateMap = new Map(templates.map((t) => [t.id, t])),
    standardIds = new Set(standards.map((s) => s.id)),
    pages = new Map(numberBuilders.pages.map((p) => [p.id, p])),
    seen = new Set<string>();
  for (const a of alignments) {
    if (!a.id.trim() || seen.has(a.id))
      throw new Error(`Duplicate or empty number alignment: ${a.id}`);
    seen.add(a.id);
    const skill = skillMap.get(a.skillId);
    if (!skill) throw new Error(`Unknown skill: ${a.skillId}`);
    if (
      !["taught", "practiced", "reference"].includes(a.relation) ||
      !a.scope.trim() ||
      !a.pageIds.length ||
      !a.standardIds.length ||
      !a.unassessedRequirements.length ||
      a.unassessedRequirements.some((s) => !s.trim())
    )
      throw new Error(`Incomplete alignment scope: ${a.id}`);
    for (const id of a.standardIds)
      if (
        !standardIds.has(id) ||
        !skill.alignments.some((s) => s.standardId === id)
      )
        throw new Error(`Standard outside skill crosswalk: ${a.skillId}/${id}`);
    for (const id of a.pageIds)
      if (!pages.has(id)) throw new Error(`Unknown page: ${id}`);
    for (const id of a.taskIds)
      if (
        !a.pageIds.some((p) =>
          pages.get(p)!.blocks.some((b) => b.kind === "task" && b.id === id),
        )
      )
        throw new Error(`Task outside alignment pages: ${id}`);
    for (const id of a.templateIds)
      if (templateMap.get(id)?.skillId !== a.skillId)
        throw new Error(`Template skill mismatch: ${id}`);
  }
}
