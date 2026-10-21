import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, seeded, pick } from "./algebra-one-kit";

export const geometryProofTemplates: readonly TemplateMetadata[] = [
  {
    id: "geometry-proof-step",
    title: "Justify an angle proof step",
    skillId: "geometric-proof",
    version: 1,
    gradeBand: "9–12",
    difficultyOffset: -0.5,
    requiredResponseCapability: "single-choice-v1",
    description:
      "Choose the theorem supporting an angle statement from explicit geometric givens.",
  },
];
const cases = [
  {
    tag: "vertical",
    givens:
      "Straight lines $AC$ and $BD$ intersect at $O$, with $O$ between $A$ and $C$ and between $B$ and $D$.",
    target: "$m\\angle AOB = m\\angle COD$",
    reason: "Vertical angles are congruent.",
    hint: "Use the stated order on $AC$ and $BD$ to identify the opposite rays at $O$. Then locate the two angles named in the proof step.",
    explanation:
      "The rays from $O$ toward $A$ and $C$ are opposite; so are those toward $B$ and $D$. Thus the angles named in the statement are opposite angles at the crossing, called vertical angles. Vertical angles have equal measures.",
  },
  {
    tag: "linear-pair",
    givens:
      "Points $A$, $B$ and $D$ lie in that order on one straight line. Ray $BC$ starts at $B$ and is not on that line.",
    target: "$m\\angle ABC + m\\angle CBD = 180^\\circ$",
    reason: "Angles that form a linear pair are supplementary.",
    hint: "The target adds two angles to $180^\\circ$. Check their shared ray and whether their other rays point in opposite directions along the stated line.",
    explanation:
      "The two angles share ray $BC$. Their other rays, $BA$ and $BD$, are opposite because $B$ lies between $A$ and $D$. They form a linear pair and together fill a straight angle, whose measure is $180^\\circ$.",
  },
  {
    tag: "corresponding",
    givens:
      "A straight transversal crosses two parallel lines. Angles 1 and 2 occupy corresponding positions at the two crossings.",
    target: "$m\\angle 1 = m\\angle 2$",
    reason:
      "Corresponding angles formed by a transversal of parallel lines are congruent.",
    hint: "Locate angles 1 and 2 at the two different crossings. Check the stated relationship between the crossed lines before choosing an equal-angle theorem.",
    explanation:
      "A transversal is a line crossing the other lines. Corresponding positions match at its two crossings. The crossed lines are given as parallel, so the corresponding angles 1 and 2 have equal measures.",
  },
  {
    tag: "triangle-sum",
    givens:
      "The interior angles of triangle $ABC$ are $\\angle A$, $\\angle B$ and $\\angle C$.",
    target: "$m\\angle A + m\\angle B + m\\angle C = 180^\\circ$",
    reason: "The interior angles of a triangle sum to 180 degrees.",
    hint: "The target adds three angles to $180^\\circ$. Check that $\\angle A$, $\\angle B$ and $\\angle C$ are exactly the inside angles of the stated triangle.",
    explanation:
      "The statement adds all three interior angle measures of triangle $ABC$. In a Euclidean plane those measures sum to $180^\\circ$; no information about side lengths or individual angle measures is required.",
  },
] as const;

export function geometryProofCase(id: string, seed: string) {
  const meta = geometryProofTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown geometry-proof template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed),
    item = pick(r, cases);
  return assemble(
    meta,
    seed,
    {
      prompt: `${item.givens} A proof states ${item.target}. Which reason justifies this step?`,
      choices: cases.map((candidate) =>
        candidate.tag === item.tag
          ? { label: candidate.reason, correct: true as const }
          : {
              label: candidate.reason,
              feedback: `That is a valid theorem, but its configuration does not justify this step. ${item.explanation}`,
            },
      ),
      explanation: [
        item.explanation,
        `Therefore ${item.target}. The reason is: ${item.reason}`,
      ],
      hint: item.hint,
      tags: [item.tag],
    },
    r,
    "Reason for the proof step",
  );
}
export function generateGeometryProofProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return geometryProofCase(id, seed).problem;
}
