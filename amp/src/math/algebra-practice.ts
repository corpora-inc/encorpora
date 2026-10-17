import { createHash } from "node:crypto";
import { algebraDefinitions } from "../content/algebra-definitions.js";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
export const algebraTemplates: readonly TemplateMetadata[] =
  algebraDefinitions.map((d) => ({
    id: d.id,
    title: d.title,
    skillId: d.skillId,
    description: d.description,
    version: 1,
    gradeBand: "6–8",
    ...(d.mode === "choice"
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }));
function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= limit);
    return lo + (n % span);
  };
}
function fraction(n: number, d = 1): string {
  if (d === 0 || !Number.isSafeInteger(n) || !Number.isSafeInteger(d))
    throw new Error("Invalid exact fraction");
  if (d < 0) {
    n = -n;
    d = -d;
  }
  let a = Math.abs(n),
    b = d;
  while (b) {
    [a, b] = [b, a % b];
  }
  return d / a === 1 ? String(n / a) : `${n / a}/${d / a}`;
}
const signed = (n: number) => (n < 0 ? `− ${Math.abs(n)}` : `+ ${n}`);
const term = (n: number) =>
  n === 1 ? "x" : n === -1 ? "−x" : `${n < 0 ? "−" : ""}${Math.abs(n)}x`;
const linear = (a: number, b: number) => `${term(a)} ${signed(b)}`;
const paren = (s: string) => `(${s.replace("-", "−")})`;
type Choice = { label: string; correct?: true; feedback?: string };
export function generateAlgebraProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = algebraTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown algebra template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed),
    nz = (max: number) => r(1, max) * (r(0, 1) ? 1 : -1);
  let prompt = "",
    answer = "",
    label = "Value",
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined,
    choices: Choice[] | undefined;
  switch (templateId) {
    case "substitute-linear-expression": {
      const a = nz(6),
        b = r(-9, 9),
        n = r(-12, 12),
        x = fraction(n, 2);
      prompt = `Find the value of ${linear(a, b)} when x = ${x}.`;
      answer = fraction(a * n + 2 * b, 2);
      label = "Expression value";
      hint =
        "Replace x with the entire given value, including its sign. Multiply before adding.";
      explanation = [
        `Substitute: ${a} × ${paren(x)} ${signed(b)}.`,
        `Multiply first: ${fraction(a * n, 2)} ${signed(b)} = ${answer}.`,
      ];
      break;
    }
    case "distributive-expression-choice": {
      const a = nz(5),
        aa = a < 0 ? a - 1 : a + 1,
        b = nz(6);
      prompt = `Which expression equals ${aa}(x ${signed(b)}) for every real x?`;
      answer = "";
      hint =
        "Every term inside the brackets is multiplied by the outside number.";
      choices = [
        { label: linear(aa, aa * b), correct: true },
        {
          label: linear(aa, b),
          feedback: `The constant also needs multiplying by ${aa}.`,
        },
        {
          label: linear(aa, -aa * b),
          feedback:
            "The constant has the opposite sign from the product. Multiply its two signed factors carefully.",
        },
      ];
      explanation = [
        `${aa}(x ${signed(b)}) = ${aa} × x + ${aa} × ${paren(String(b))}.`,
        `The equivalent expression is ${linear(aa, aa * b)}. Both terms were multiplied.`,
      ];
      break;
    }
    case "combine-like-coefficient": {
      const a = nz(8),
        b = nz(8),
        c = r(-9, 9);
      prompt = `Combine like terms in ${term(a)} ${b < 0 ? "−" : "+"} ${term(Math.abs(b))} ${signed(c)}. What is the coefficient of x?`;
      answer = String(a + b);
      label = "Coefficient of x";
      hint =
        "Combine the signed numbers multiplying x. The constant is a different kind of term.";
      explanation = [
        `${a} copies of x plus ${b} copies of x gives ${a + b} copies of x.`,
        `The coefficient is ${answer}. The constant ${c} does not contribute to it.`,
        ...(a + b === 0
          ? [
              "The x terms cancel; zero is the coefficient, even though the x term can be omitted.",
            ]
          : []),
      ];
      break;
    }
    case "grouped-linear-equation": {
      const a = nz(6),
        b = r(-8, 8),
        c = r(-20, 20);
      prompt = `Solve ${a}(x ${signed(b)}) = ${c}.`;
      answer = fraction(c - a * b, a);
      label = "x";
      hint =
        "Divide both sides by the nonzero outside multiplier. Then undo the addition inside.";
      explanation = [
        `Divide both sides by ${a}: x ${signed(b)} = ${fraction(c, a)}.`,
        `Subtract ${paren(String(b))}: x = ${answer}.`,
        `Check: ${a} × ${paren(fraction(c, a))} = ${c}.`,
      ];
      break;
    }
    case "negative-coefficient-equation": {
      const a = -r(1, 6),
        b = r(-12, 12),
        c = r(-12, 12);
      prompt = `Solve ${linear(a, b)} = ${c}.`;
      answer = fraction(c - b, a);
      label = "x";
      hint = "Undo the constant first, then divide by the signed coefficient.";
      explanation = [
        `Subtract ${paren(String(b))} from both sides: ${term(a)} = ${c - b}.`,
        `Divide by ${a}: x = ${answer}.`,
        `Substitute into the original: ${a} × ${paren(answer)} ${signed(b)} = ${c - b} ${signed(b)} = ${c}.`,
      ];
      break;
    }
    case "rational-coefficient-equation": {
      const p = [-5, -3, -1, 1, 3, 5][r(0, 5)]!,
        q = [2, 4, 6][r(0, 2)]!,
        b = r(-9, 9),
        c = r(-9, 9),
        coefficient = fraction(p, q);
      prompt = `Solve (${coefficient})x ${signed(b)} = ${c}.`;
      answer = fraction((c - b) * q, p);
      label = "x";
      hint =
        "Remove the added constant, then multiply both sides by the reciprocal of the nonzero coefficient.";
      explanation = [
        `Subtract ${paren(String(b))}: (${coefficient})x = ${c - b}.`,
        `Multiply by ${fraction(q, p)}: x = ${answer}.`,
        `Check: (${coefficient}) × ${paren(answer)} ${signed(b)} = ${c - b} ${signed(b)} = ${c}.`,
      ];
      break;
    }
    case "both-sides-linear-equation": {
      const a = nz(6),
        b = r(-12, 12);
      let c = nz(6);
      while (c === a) c = nz(6);
      const d = r(-12, 12);
      prompt = `Solve ${linear(a, b)} = ${linear(c, d)}.`;
      answer = fraction(d - b, a - c);
      label = "x";
      hint =
        "Subtract the same x term from both sides, then the same constant. Keep the signs.";
      explanation = [
        `Subtract ${term(c)} and ${paren(String(b))} from both sides: ${term(a - c)} = ${d - b}.`,
        `The coefficient ${a - c} is nonzero, so divide: x = ${answer}.`,
        `Both original sides become ${fraction(a * (d - b) + b * (a - c), a - c)} at this value.`,
      ];
      break;
    }
    case "check-equation-candidate": {
      const a = nz(6),
        b = r(-9, 9),
        x = r(-6, 6),
        lhs = a * x + b,
        c = lhs + (r(0, 1) ? 0 : nz(4)),
        ok = lhs === c;
      prompt = `Does x = ${x} satisfy ${linear(a, b)} = ${c}? Choose the accurate check.`;
      const check = (left: number, right: number) =>
        `Left = ${left}; right = ${right}. ${left === right ? "Yes" : "No"}.`;
      choices = [
        { label: check(lhs, c), correct: true },
        {
          label: check(lhs + a, c),
          feedback:
            "Substitute the proposed value into the entire left expression. This left-side calculation is incorrect.",
        },
        {
          label: check(lhs, c + 1),
          feedback:
            "The right side is the original constant; substitution does not change it.",
        },
      ];
      hint =
        "Evaluate the original left and right sides separately at the proposed value.";
      explanation = [
        `Left: ${a} × ${paren(String(x))} ${signed(b)} = ${lhs}. Right: ${c}.`,
        ok
          ? "The two sides agree, so this proposed value is a solution."
          : "The sides differ, so this proposed value is not a solution.",
      ];
      break;
    }
    case "unequal-step-rate": {
      const p = nz(6),
        q = r(1, 4),
        b = r(-5, 5),
        x = r(0, 3),
        h = r(1, 4);
      let k = r(1, 4);
      while (k === h) k = r(1, 4);
      const y = (v: number) => fraction(p * v + b * q, q);
      prompt = `A linear rule gives (${x}, ${y(x)}), (${x + h}, ${y(x + h)}), and (${x + h + k}, ${y(x + h + k)}). What is its output change per input unit?`;
      answer = fraction(p, q);
      label = "Rate of change";
      hint =
        "Divide output change by input change. The input steps are not the same size.";
      explanation = [
        `The first input step is ${h}; its output change is ${fraction(p * h, q)}.`,
        `Rate = ${fraction(p * h, q)} ÷ ${h} = ${answer}.`,
        `The second step gives ${fraction(p * k, q)} ÷ ${k} = ${answer}, confirming the same rate.`,
      ];
      break;
    }
    case "recover-linear-intercept": {
      const p = nz(6),
        q = r(1, 4),
        b = r(-8, 8),
        x = r(1, 6),
        y = fraction(p * x + b * q, q);
      prompt = `A linear rule has rate ${fraction(p, q)} and passes through (${x}, ${y}). What is its output when the input is 0?`;
      answer = String(b);
      label = "Output at zero";
      hint =
        "The known output contains the initial value plus rate × input. Remove that change.";
      explanation = [
        `Use y = mx + b: ${y} = (${fraction(p, q)}) × ${x} + b.`,
        `Subtract the accumulated change ${fraction(p * x, q)}: b = ${answer}.`,
        `At input zero, the rate contributes zero; the output is ${answer}.`,
      ];
      break;
    }
    case "predict-linear-output": {
      const p = nz(6),
        q = r(1, 4),
        b = r(-5, 5),
        x1 = r(0, 2),
        x2 = r(3, 5),
        x3 = r(6, 9),
        y = (x: number) => fraction(p * x + b * q, q);
      prompt = `Assume a linear rule through (${x1}, ${y(x1)}) and (${x2}, ${y(x2)}). What is the output at input ${x3}?`;
      answer = y(x3);
      label = "Predicted output";
      hint =
        "Find output change per input unit. Extend from either known point.";
      explanation = [
        `Rate = (${y(x2)} − ${paren(y(x1))}) ÷ (${x2} − ${x1}) = ${fraction(p, q)}.`,
        `From input ${x2} to ${x3}, the output changes by ${fraction(p * (x3 - x2), q)}.`,
        `Add this to ${y(x2)} to get ${answer}. The prediction depends on the stated linear assumption.`,
      ];
      break;
    }
    case "relation-function-choice": {
      const x = r(-5, 3),
        y = r(-5, 3),
        duplicate = r(0, 1) === 0;
      const pairs = (rows: number[][]) =>
        rows.map(([a, b]) => `(${a}, ${b})`).join(", ");
      choices = [
        {
          label: pairs(
            duplicate
              ? [
                  [x, y],
                  [x, y],
                  [x + 1, y + 1],
                ]
              : [
                  [x, y],
                  [x + 1, y],
                  [x + 2, y],
                ],
          ),
          correct: true,
        },
        {
          label: pairs([
            [x, y],
            [x, y + 1],
            [x + 1, y + 1],
          ]),
          feedback: `Input ${x} is paired with two different outputs, ${y} and ${y + 1}.`,
        },
        {
          label: pairs([
            [x, y],
            [x + 1, y],
            [x + 1, y + 2],
          ]),
          feedback: `Input ${x + 1} is paired with two different outputs, ${y} and ${y + 2}.`,
        },
      ];
      prompt = "Which list of (input, output) pairs represents a function?";
      hint =
        "Look for an input assigned two different outputs. A repeated identical pair is harmless; different inputs may share an output.";
      explanation = [
        duplicate
          ? "The repeated identical pair records the same assignment twice. It does not introduce a second output."
          : "The different inputs share one output, which is allowed.",
        "Every input in the selected list has exactly one output. The other lists assign conflicting outputs to a repeated input.",
      ];
      break;
    }
    case "proportional-rule-choice": {
      const k = nz(6),
        b = nz(8);
      prompt = "Which rule is proportional for all real inputs x?";
      hint =
        "A proportional rule has one constant multiplier and gives zero when the input is zero.";
      choices = [
        { label: `y = ${term(k)}`, correct: true },
        {
          label: `y = ${linear(k, b)}`,
          feedback: `At input zero, this rule gives ${b}, not zero.`,
        },
        {
          label: `y = ${linear(-k, -b)}`,
          feedback: `This rule has a fixed added amount, ${-b}; it does not pass through the origin.`,
        },
      ];
      explanation = [
        `The selected rule has the form y = kx, with constant multiplier ${k}.`,
        `For every nonzero x, y/x = ${k}; at x = 0, y = 0. Negative multipliers are allowed in this real-valued algebraic setting.`,
      ];
      break;
    }
    case "shared-plan-input":
    case "first-cheaper-whole-input": {
      const high = r(2, 8),
        low = r(1, high - 1),
        fee = r(1, 20),
        delta = high - low,
        cross = fraction(fee, delta),
        whole = templateId === "first-cheaper-whole-input";
      prompt = whole
        ? `Plan A costs ${fee} + ${low}x dollars; B costs ${high}x dollars. For whole inputs x from 0 to 24, what is the first x where A is strictly cheaper?`
        : `Plan A costs ${fee} + ${low}x dollars; B costs ${high}x dollars. For real inputs x from 0 to 24, at what x do they cost the same?`;
      answer = whole ? String(Math.floor(fee / delta) + 1) : cross;
      label = whole ? "First whole input" : "Shared input";
      hint = whole
        ? "First find the tie point. Strictly cheaper requires moving beyond it, even when the tie is a whole number."
        : "Set the two costs equal. The fixed fee must be balanced by the difference in rates.";
      explanation = [
        `Equal costs mean ${fee} + ${low}x = ${high}x, so ${fee} = ${delta}x.`,
        `The tie is at x = ${cross}. Each additional input saves ${delta} dollars under A.`,
        ...(whole
          ? [
              `A is strictly cheaper when x > ${cross}. The first whole input is ${answer}.`,
              `At x = ${answer}, A costs ${fee + low * Number(answer)} dollars and B costs ${high * Number(answer)} dollars. At x = ${Number(answer) - 1}, A is not strictly cheaper.`,
            ]
          : [
              `At this input both costs equal ${fraction(high * fee, delta)} dollars.`,
            ]),
      ];
      break;
    }
    case "distance-graph-meaning": {
      const start = r(4, 8),
        drop = r(0, 1) ? r(1, 3) : 0,
        end = start - drop;
      prompt =
        "x: time (minutes). y: distance from home (meters). What happens to the distance from A to B?";
      figure = {
        kind: "coordinate-plane",
        xMin: -1,
        xMax: 5,
        yMin: -1,
        yMax: 10,
        points: [
          { x: 0, y: start, label: "A" },
          { x: 4, y: end, label: "B" },
        ],
        lines: [{ m: -drop / 4, b: start }],
      };
      choices = [
        {
          label: drop
            ? "Distance from home decreases."
            : "Distance from home stays constant.",
          correct: true,
        },
        {
          label: drop
            ? "Distance from home increases."
            : "The traveler must be standing still.",
          feedback: drop
            ? "Read the vertical coordinate as time increases; it gets smaller."
            : "Someone could move around a circle centered on home while keeping the same distance.",
        },
        {
          label: drop
            ? "Distance from home stays constant."
            : "Distance from home decreases.",
          feedback: drop
            ? "The endpoints have different vertical coordinates, so the distance changes."
            : "A level segment has the same vertical coordinate throughout.",
        },
      ];
      hint =
        "Follow the graph from left to right. Describe distance from home, rather than guessing the exact route.";
      explanation = [
        `At 0 minutes the distance is ${start} meters; at 4 minutes it is ${end} meters.`,
        drop
          ? "The graph falls, so distance from home decreases. This alone does not specify the route or the total distance traveled."
          : "The graph is level, so distance from home is constant. It does not prove the traveler is stationary.",
      ];
      break;
    }
    default:
      throw new Error(`Missing algebra generator: ${templateId}`);
  }
  let choiceFeedback: Record<string, string> | undefined;
  let response: GeneratedProblem["public"]["response"] = {
    kind: "fraction",
    label,
  };
  if (choices) {
    for (let i = choices.length - 1; i > 0; i--) {
      const j = r(0, i);
      [choices[i], choices[j]] = [choices[j]!, choices[i]!];
    }
    choiceFeedback = {};
    const options = choices.map((c, i) => {
      const id = `option-${"abcd"[i]}`;
      if (c.correct) answer = id;
      else choiceFeedback![id] = c.feedback!;
      return { id, label: c.label };
    });
    response = { kind: "choice", label: "Choose one answer", options };
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
      skillId: meta.skillId,
      response,
      ...(figure ? { figure } : {}),
    },
    answer,
    hint,
    explanation,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
}
