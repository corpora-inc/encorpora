import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { assemble, pick, seeded, shuffle } from "./algebra-one-kit";
import { scene, triangle } from "./scene/author";
import type { Point } from "./scene/spec";

export const congruenceTemplates: readonly TemplateMetadata[] = [
  {
    id: "triangle-congruence-criteria",
    version: 1,
    title: "Which givens fix the triangle?",
    skillId: "congruence-criteria",
    gradeBand: "9–12",
    requiredFigureCapability: "scenes-v1",
    requiredResponseCapability: "single-choice-v1",
    description:
      "Identify SSS, SAS, ASA and AAS, reject ambiguous SSA and AAA, or complete a specified criterion from corresponding givens.",
  },
];
type Rule = "SSS" | "SAS" | "ASA" | "AAS" | "SSA" | "AAA";
// Indices 0–2 name AB, BC, CA; indices 3–5 name angles A, B, C.
const facts: Record<Rule, readonly number[]> = {
  SSS: [0, 1, 2],
  SAS: [0, 2, 3],
  ASA: [0, 3, 4],
  AAS: [1, 3, 4],
  SSA: [0, 2, 4],
  AAA: [3, 4, 5],
};
const labels: Record<Rule, string> = {
  SSS: "SSS: three corresponding sides fix the triangle.",
  SAS: "SAS: two corresponding sides and their included angle fix the triangle.",
  ASA: "ASA: two corresponding angles and their included side fix the triangle.",
  AAS: "AAS: two corresponding angles and a non-included side fix the triangle.",
  SSA: "Not sufficient: these two sides and a non-included angle allow different triangles.",
  AAA: "Not sufficient: three matching angles allow different sizes.",
};
const reasons: Record<Rule, string> = {
  SSS: "All three corresponding side lengths are fixed. Placing one side on its match leaves the third vertex at the intersection of two circles. The two possible positions are reflections, so SSS proves congruence.",
  SAS: "The given angle is at the shared endpoint of the two given sides. Once that angle is matched, the two lengths locate both remaining vertices, so SAS proves congruence.",
  ASA: "The given side joins the vertices of the two given angles. Match this side; the angle rays at its endpoints intersect at the third vertex. ASA proves congruence.",
  AAS: "The given side does not join the two given angle vertices. The third angle is fixed because triangle angles sum to $180^\\circ$. This supplies an ASA configuration, so AAS proves congruence.",
  SSA: "The given angle is opposite the shorter given side, rather than between the two given sides. For these lengths and this angle, the free endpoint can occupy two different positions. The triangles need not be congruent.",
  AAA: "Matching angles fix shape but allow scaling. A dilation changes every length by the same positive factor and keeps every angle unchanged. AAA does not prove congruence.",
};
const equalities = [
  "$AB = DE$",
  "$BC = EF$",
  "$CA = FD$",
  "$m\\angle A = m\\angle D$",
  "$m\\angle B = m\\angle E$",
  "$m\\angle C = m\\angle F$",
];

export function congruenceCase(id: string, seed: string) {
  const meta = congruenceTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown congruence template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed),
    frame = r(0, 2),
    k = r(1, 8);
  const rule = pick(
    r,
    frame === 2
      ? (["SSS", "SAS", "ASA", "AAS"] as const)
      : (Object.keys(facts) as Rule[]),
  );
  const missing = { SSS: 1, SAS: 3, ASA: 0, AAS: 1, SSA: 0, AAA: 0 }[rule];
  const given = facts[rule].filter((i) => frame !== 2 || i !== missing);
  const lengthLabels = [String(7 * k), `${4 * k}√2`, String(5 * k)];
  const givens = given
    .map((i) =>
      i < 3
        ? `${equalities[i]!.slice(0, -1)} = ${i === 1 ? `${4 * k}\\sqrt{2}` : lengthLabels[i]}$ cm`
        : i === 4
          ? "$m\\angle B = m\\angle E = 45^\\circ$"
          : equalities[i]!,
    )
    .join("; ");
  const cue = given.some((i) => i < 3)
    ? lengthLabels[given.find((i) => i < 3)!]!
    : "45";
  const cueText =
    cue === "45"
      ? "$45^\\circ$ angle"
      : cue.includes("√")
        ? `$${cue.replace("√2", "\\sqrt{2}")}$ cm side`
        : `${cue} cm side`;
  const header = `Triangles $ABC$ and $DEF$ have correspondence $A \\leftrightarrow D$, $B \\leftrightarrow E$, $C \\leftrightarrow F$. Given: ${givens}. Use only the stated givens and matching marks; unmarked features supply no facts.`;
  const prompt =
    frame === 2
      ? `${header} Which additional fact completes ${rule} using exactly the stated pairs?`
      : `${header} ${frame === 0 ? "Which criterion or limitation describes these givens?" : "A student claims these givens prove congruence. Which assessment of that claim is justified?"}`;
  const options =
    frame === 2
      ? [
          missing,
          ...shuffle(
            r,
            // With angles A and B given, either BC or CA completes AAS.
            // Offer only one of those valid non-included side pairs.
            [0, 1, 2, 3, 4, 5].filter(
              (i) => i !== missing && !(rule === "AAS" && i === 2),
            ),
          ).slice(0, 3),
        ].map((i) => ({
          label: equalities[i]!,
          ...(i === missing
            ? { correct: true as const }
            : {
                feedback: `To complete ${rule} with the stated pairs, use ${equalities[missing]}. ${reasons[rule]}`,
              }),
        }))
      : [
          rule,
          ...shuffle(
            r,
            (Object.keys(facts) as Rule[]).filter((s) => s !== rule),
          ).slice(0, 3),
        ].map((s) => ({
          label: labels[s],
          ...(s === rule
            ? { correct: true as const }
            : { feedback: reasons[rule] }),
        }));
  // Coordinates are exact multiples of (0,0), (7,0), (3,4).
  // SSA's second triangle instead uses (4,3): same two lengths and 45° at B,
  // but BC is 3√2 instead of 4√2. AAA's second triangle is twice as large.
  const pair = ([false, true] as const).map((second) => {
    const scale = second && rule === "AAA" ? 2 : 1;
    const apex = second && rule === "SSA" ? [4, 3] : [3, 4];
    const points = [[0, 0], [7, 0], apex].map(
      ([x, y]) => [x! * scale + (second ? 11 : 0), y! * scale] as Point,
    ) as [Point, Point, Point];
    const t = triangle(points)
      .names(
        ...((second ? ["D", "E", "F"] : ["A", "B", "C"]) as [
          string,
          string,
          string,
        ]),
      )
      .id(second ? "right" : "left");
    for (const i of given) {
      if (i < 3)
        t.side(i as 0 | 1 | 2, { ticks: i + 1, label: lengthLabels[i] });
      else
        t.angle((i - 3) as 0 | 1 | 2, {
          mark: "arc",
          arcs: i - 2,
        });
    }
    return t;
  });
  return assemble(
    meta,
    seed,
    {
      prompt,
      choices: options,
      scene: scene(...pair).build({
        title: "Corresponding triangle givens",
        note: "Matching tick counts mark equal side lengths in centimeters; matching arc counts mark equal angles. Only marked facts are given.",
      }),
      hint:
        frame === 2
          ? `Start with the given ${cueText}. Locate its matching part, then check which missing side or angle would put the stated pairs in the order required by ${rule}.`
          : `Locate the given ${cueText} and its match. List the marked side pairs and angle pairs, then check which angle lies between which sides.`,
      explanation: [
        `The correspondence pairs $AB$ with $DE$, $BC$ with $EF$, $CA$ with $FD$, and angles at $A$, $B$, $C$ with those at $D$, $E$, $F$.`,
        ...(frame === 2
          ? [`The additional fact is ${equalities[missing]}.`]
          : []),
        reasons[rule],
        "A rotation, reflection or translation preserves lengths and angles. Congruence requires such a match of the whole triangles; appearance alone supplies no proof.",
      ],
      tags: [["identify", "assess-claim", "complete-criterion"][frame]!, rule],
    },
    r,
    frame === 2 ? "Additional fact" : "Criterion or limitation",
  );
}
export function generateCongruenceProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return congruenceCase(id, seed).problem;
}
