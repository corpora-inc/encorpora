import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";

export const rightTriangleTemplates: readonly TemplateMetadata[] = [
  {
    id: "right-triangle-missing-leg",
    version: 1,
    title: "Find a missing leg",
    skillId: "pythagorean-theorem",
    gradeBand: "6–8",
    description:
      "Find either leg of an integer right triangle from its hypotenuse and other leg.",
  },
  {
    id: "pythagorean-converse",
    version: 1,
    title: "Recognize a right triangle from its sides",
    skillId: "pythagorean-theorem",
    gradeBand: "6–8",
    description:
      "Use the Pythagorean theorem and its converse to decide whether three given triangle sides form a right triangle.",
    requiredResponseCapability: "single-choice-v1",
  },
];

type Triple = readonly [number, number, number];
const integerRightTriangles: Triple[] = [];
const classificationDomains: [Triple[], Triple[], Triple[]] = [[], [], []];
for (let c = 1; c <= 50; c++) {
  for (let b = 1; b <= c; b++) {
    for (let a = 1; a <= b; a++) {
      if (a + b <= c) continue;
      const difference = a * a + b * b - c * c;
      if (difference === 0) integerRightTriangles.push([a, b, c]);
      if (c <= 30)
        classificationDomains[
          difference === 0 ? 0 : difference > 0 ? 1 : 2
        ].push([a, b, c]);
    }
  }
}

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1;
    const limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return lo + (value % span);
  };
}

export function generateRightTriangleProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const metadata = rightTriangleTemplates.find(
    (template) => template.id === templateId,
  );
  if (!metadata)
    throw new Error(`Unknown right-triangle template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt: string, answer: string, hint: string, explanation: string[];
  let response: GeneratedProblem["public"]["response"];
  let choiceFeedback: Record<string, string> | undefined;
  if (templateId === "right-triangle-missing-leg") {
    const [a, b, c] =
      integerRightTriangles[r(0, integerRightTriangles.length - 1)]!;
    const known = r(0, 1) === 0 ? a : b;
    const missing = known === a ? b : a;
    prompt = `A right triangle has a hypotenuse of ${c} cm and one leg of ${known} cm. What is the length of the other leg, in centimeters?`;
    answer = String(missing);
    response = { kind: "number", label: "Missing leg length in centimeters" };
    hint =
      "The hypotenuse is opposite the right angle. Its squared length equals the sum of the two squared leg lengths. Subtract the known leg's square, then take the positive square root.";
    explanation = [
      `Let x be the missing leg length in centimeters. The Pythagorean theorem gives x² + ${known}² = ${c}².`,
      `Square the known lengths: ${known}² = ${known} × ${known} = ${known * known} and ${c}² = ${c} × ${c} = ${c * c}.`,
      `Subtract ${known * known} from both sides: x² = ${c * c} − ${known * known} = ${missing * missing}.`,
      `Since ${missing} × ${missing} = ${missing * missing} and a length is positive, x = ${missing}. The missing leg is ${missing} cm long.`,
      `Check: ${missing}² + ${known}² = ${missing * missing} + ${known * known} = ${c * c} = ${c}².`,
    ];
  } else {
    // Half the draws are right triangles; each nonright inequality gets a quarter.
    const draw = r(0, 3);
    const category = draw < 2 ? 0 : draw - 1;
    const domain = classificationDomains[category]!;
    const [a, b, c] = domain[r(0, domain.length - 1)]!;
    const sides = [a, b, c];
    for (let i = sides.length - 1; i > 0; i--) {
      const j = r(0, i);
      [sides[i], sides[j]] = [sides[j]!, sides[i]!];
    }
    prompt = `A triangle has side lengths ${sides[0]} cm, ${sides[1]} cm, and ${sides[2]} cm. Is it a right triangle?`;
    const labels = ["Right triangle", "Not a right triangle"];
    if (r(0, 1)) labels.reverse();
    const correct = category === 0 ? "Right triangle" : "Not a right triangle";
    const options = labels.map((label, index) => ({
      id: `option-${"ab"[index]}`,
      label,
    }));
    answer = options.find((option) => option.label === correct)!.id;
    response = { kind: "choice", label: "Choose one classification", options };
    hint =
      "Find the longest side. Square its length, then compare that result with the sum of the squares of the other two lengths. The triangle is right exactly when the results are equal.";
    explanation = [
      `The longest side is ${c} cm. If the triangle were right, this side would be its hypotenuse.`,
      `Square the other two lengths and add: ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}.`,
      `Square the longest length: ${c}² = ${c} × ${c} = ${c * c}.`,
      category === 0
        ? `The results are equal: ${a * a + b * b} = ${c * c}. By the converse of the Pythagorean theorem, the triangle is right.`
        : `The results differ: ${a * a + b * b} ≠ ${c * c}. Every right triangle satisfies the square relationship, so this triangle is not right.`,
    ];
    choiceFeedback = Object.fromEntries(
      options
        .filter((option) => option.id !== answer)
        .map((option) => [
          option.id,
          category === 0
            ? "The sum of the two smaller squares equals the largest square. That equality guarantees a right angle opposite the longest side."
            : "Use the longest side for the square on its own. The two results are unequal, so the triangle cannot have a right angle.",
        ]),
    );
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: metadata.skillId,
      response,
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
