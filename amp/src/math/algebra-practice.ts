import { createHash } from "node:crypto";
import { algebraDefinitions } from "../content/algebra-definitions.js";
import { graph } from "./scene/author.js";
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
    ...(d.id === "relation-point-removal"
      ? { requiredFigureCapability: "scenes-v1" as const }
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
      const times = a === 1 ? "" : a === -1 ? "−" : `${a} × `;
      hint = `Replace $x$ with ${paren(x)}: ${times}${paren(x)} ${signed(b)}. Multiply first, keeping the signs.`;
      explanation = [
        `To substitute means to put the number in place of the letter. Write ${paren(x)} wherever $x$ appears.`,
        `$${term(a)}$ means ${a} times $x$, so the expression becomes ${a} × ${paren(x)} ${signed(b)}.`,
        `Multiply before adding, by the order of operations: ${a} × ${paren(x)} = ${fraction(a * n, 2)}.`,
        `Then ${fraction(a * n, 2)} ${signed(b)} = ${answer}.`,
        `The expression has the value ${answer} when x = ${x}.`,
      ];
      break;
    }
    case "distributive-expression-choice": {
      const a = nz(5),
        aa = a < 0 ? a - 1 : a + 1,
        b = nz(6);
      prompt = `Which expression equals $${aa}(x ${signed(b)})$ for every real $x$?`;
      answer = "";
      hint = `Multiply ${aa} by both terms inside the brackets: ${aa} × x and ${aa} × ${paren(String(b))}.`;
      choices = [
        { label: linear(aa, aa * b), correct: true },
        {
          label: linear(aa, b),
          feedback: `You multiplied only the $x$ by ${aa}. The ${aa} multiplies everything inside the parentheses, so ${b} must be multiplied by ${aa} too: ${aa} × ${paren(String(b))} = ${aa * b}.`,
        },
        {
          label: linear(aa, -aa * b),
          feedback: `The sign of the second term is flipped. ${aa} × ${paren(String(b))} = ${aa * b}: ${aa < 0 === b < 0 ? "two numbers with the same sign multiply to a positive number" : "a positive times a negative is negative"}.`,
        },
      ];
      explanation = [
        `A number written right before parentheses multiplies everything inside them.`,
        `So multiply ${aa} by each term (each part joined by + or −): ${aa} × x and ${aa} × ${paren(String(b))}.`,
        `${aa} × x = ${term(aa)}, and ${aa} × ${paren(String(b))} = ${aa * b}, because ${aa < 0 === b < 0 ? "same signs multiply to a positive" : "opposite signs multiply to a negative"}.`,
        `So $${aa}(x ${signed(b)})$ equals ${linear(aa, aa * b)} for every $x$.`,
      ];
      break;
    }
    case "combine-like-coefficient": {
      const a = nz(8),
        b = nz(8),
        c = r(-9, 9);
      prompt = `Combine like terms in ${term(a)} ${b < 0 ? "−" : "+"} ${term(Math.abs(b))} ${signed(c)}. What is the coefficient of $x$?`;
      answer = String(a + b);
      label = "Coefficient of $x$";
      hint = `The $x$ terms are $${term(a)}$ and $${term(b)}$. Add their signed coefficients, ${a} + ${paren(String(b))}; the plain number is not an $x$ term.`;
      explanation = [
        `Like terms have the same letter part, so they can be added. The coefficient is the number that multiplies $x$.`,
        `The $x$ terms are $${term(a)}$ and $${term(b)}$. Think of them as ${a} of $x$ and ${b} of $x$.`,
        `Add the coefficients, keeping their signs: ${a} + ${paren(String(b))} = ${a + b}.`,
        `The number ${c} has no $x$, so it is not a like term and does not change the coefficient.`,
        ...(a + b === 0
          ? [
              "The $x$ terms cancel to 0 copies of $x$, so the coefficient is 0.",
            ]
          : []),
        `The coefficient of $x$ is ${answer}.`,
      ];
      break;
    }
    case "grouped-linear-equation": {
      const a = nz(6),
        b = r(-8, 8),
        c = r(-20, 20);
      prompt = `Solve $${a}(x ${signed(b)}) = ${c}$.`;
      answer = fraction(c - a * b, a);
      label = "x";
      hint = `Undo the multiplication by ${a} first: divide both sides of $${a}(x ${signed(b)}) = ${c}$ by ${a}.`;
      explanation = [
        `To solve means to find the $x$ that makes both sides equal. Undo the steps done to $x$, last step first.`,
        `$${a}(x ${signed(b)})$ means ${a} times the group $(x ${signed(b)})$. The multiplying happened last, so undo it first.`,
        `Divide both sides by ${a}, so they stay equal: $x ${signed(b)} = ${fraction(c, a)}$.`,
        b === 0
          ? `Nothing is added to $x$, so x = ${answer}.`
          : `Now undo the ${signed(b)}: ${b > 0 ? `subtract ${b} from` : `add ${-b} to`} both sides. x = ${answer}.`,
        `Check: ${a} × ${paren(fraction(c, a))} = ${c}. So x = ${answer}.`,
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
      hint = b
        ? `Undo the ${signed(b)} first on both sides, then divide both sides by ${a}, sign included.`
        : `Divide both sides by ${a}, sign included: ${c} ÷ ${paren(String(a))}.`;
      explanation = [
        `To solve means to find the $x$ that makes both sides equal. Undo the steps done to $x$, last step first.`,
        b === 0
          ? `Nothing is added to ${term(a)}, so go straight to the multiplying.`
          : `First undo the ${signed(b)}: ${b > 0 ? `subtract ${b} from` : `add ${-b} to`} both sides, so they stay equal. That gives ${term(a)} = ${c - b}.`,
        `${term(a)} means ${a} times $x$. Divide both sides by ${a}, keeping its negative sign: x = ${c - b} ÷ ${paren(String(a))} = ${answer}.`,
        `Check in the original: ${a} × ${paren(answer)} ${signed(b)} = ${c - b} ${signed(b)} = ${c}. So x = ${answer}.`,
      ];
      break;
    }
    case "rational-coefficient-equation": {
      const p = [-5, -3, -1, 1, 3, 5][r(0, 5)]!,
        q = [2, 4, 6][r(0, 2)]!,
        b = r(-9, 9),
        c = r(-9, 9),
        coefficient = fraction(p, q);
      prompt = `Solve $(${coefficient})x ${signed(b)} = ${c}$.`;
      answer = fraction((c - b) * q, p);
      label = "x";
      hint = b
        ? `Undo the ${signed(b)} first on both sides. Then multiply both sides by the reciprocal of ${coefficient}.`
        : `Multiply both sides by the reciprocal of ${coefficient}, so the $x$ stands alone.`;
      explanation = [
        `To solve means to find the $x$ that makes both sides equal. Undo the steps done to $x$, last step first.`,
        b === 0
          ? `Nothing is added, so only the fraction multiplies $x$: (${coefficient})x = ${c}.`
          : `First undo the ${signed(b)}: ${b > 0 ? `subtract ${b} from` : `add ${-b} to`} both sides. That gives (${coefficient})x = ${c - b}.`,
        `The reciprocal of a fraction is the fraction flipped over: the reciprocal of ${coefficient} is ${fraction(q, p)}. A number times its reciprocal is 1.`,
        `So multiplying both sides by ${fraction(q, p)} leaves $x$ alone: x = ${c - b} × ${paren(fraction(q, p))} = ${answer}.`,
        `Check: (${coefficient}) × ${paren(answer)} ${signed(b)} = ${c - b} ${signed(b)} = ${c}. So x = ${answer}.`,
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
      hint = `Collect the $x$ terms on one side: subtract $${term(c)}$ from both sides of $${linear(a, b)} = ${linear(c, d)}$.`;
      explanation = [
        `$x$ appears on both sides. Get all the $x$ terms on one side and the plain numbers on the other.`,
        `Subtract $${term(c)}$ from both sides, so they stay equal. The $x$ terms combine to $${term(a - c)}$.`,
        b === 0
          ? `The left side has no plain number, so $${term(a - c)} = ${d}$.`
          : `Then ${b > 0 ? `subtract ${b} from` : `add ${-b} to`} both sides to move the plain number: $${term(a - c)} = ${d - b}$.`,
        `Divide both sides by ${a - c}: x = ${d - b} ÷ ${paren(String(a - c))} = ${answer}.`,
        `Check: both original sides equal ${fraction(a * (d - b) + b * (a - c), a - c)} when x = ${answer}. So x = ${answer}.`,
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
          feedback: `The left side was worked out wrongly. Put ${x} in for $x$, multiply first, ${a} × ${paren(String(x))} = ${a * x}, then ${signed(b)}: the left side is ${lhs}.`,
        },
        {
          label: check(lhs, c + 1),
          feedback: `The right side is just the number ${c}. It has no $x$, so putting in a value for $x$ does not change it.`,
        },
      ];
      hint = `Put x = ${x} into the left side, ${a} × ${paren(String(x))} ${signed(b)}, and work it out. Then compare it with the right side, ${c}.`;
      explanation = [
        `A value satisfies an equation when putting it in for $x$ makes both sides equal.`,
        `Left side: put ${x} in for $x$ and multiply first: ${a} × ${paren(String(x))} ${signed(b)} = ${a * x} ${signed(b)} = ${lhs}.`,
        `Right side: ${c}. It has no $x$, so it stays ${c}.`,
        ok
          ? `${lhs} equals ${c}, so x = ${x} satisfies the equation.`
          : `${lhs} does not equal ${c}, so x = ${x} does not satisfy the equation.`,
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
      hint = `The inputs ${x}, ${x + h} and ${x + h + k} are not equally spaced. Divide the output change from (${x}, ${y(x)}) to (${x + h}, ${y(x + h)}) by the input change between them, not by one.`;
      explanation = [
        `The output change per input unit (the rate of change) is how much the output changes when the input goes up by 1.`,
        `From (${x}, ${y(x)}) to (${x + h}, ${y(x + h)}), the input goes up ${h} and the output changes by ${fraction(p * h, q)}.`,
        h === 1
          ? `The input moved exactly 1, so the rate is ${fraction(p * h, q)} ÷ 1 = ${answer}.`
          : `The input moved ${h}, not 1, so share the change over ${h} units: ${fraction(p * h, q)} ÷ ${h} = ${answer}.`,
        `Check with the next pair: ${fraction(p * k, q)} ÷ ${k} = ${answer}. A linear rule keeps one rate.`,
        `The output changes by ${answer} per input unit.`,
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
      hint = `Going back from input ${x} to input 0 takes away ${x} steps of ${fraction(p, q)}. Subtract ${x} × ${paren(fraction(p, q))} from ${y}.`;
      explanation = [
        `A rate of ${fraction(p, q)} means the output changes by ${fraction(p, q)} each time the input goes up by 1.`,
        `From input 0 to input ${x} is ${x} steps, so the output changed by ${x} × ${paren(fraction(p, q))} = ${fraction(p * x, q)}.`,
        `To go back to input 0, undo that change: ${y} − ${paren(fraction(p * x, q))} = ${answer}.`,
        `The output is ${answer} when the input is 0.`,
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
      hint = `Find the rate from (${x1}, ${y(x1)}) to (${x2}, ${y(x2)}): output change ÷ input change. Then extend it from input ${x2} to input ${x3}.`;
      explanation = [
        `A linear rule changes the output by the same amount for each input unit. That amount is the rate.`,
        `Rate = output change ÷ input change = (${y(x2)} − ${paren(y(x1))}) ÷ (${x2} − ${x1}) = ${fraction(p, q)}.`,
        `From input ${x2} to ${x3} is ${x3 - x2} units, so the output changes by ${x3 - x2} × ${paren(fraction(p, q))} = ${fraction(p * (x3 - x2), q)}.`,
        `Add that change to the output at ${x2}: ${y(x2)} + ${paren(fraction(p * (x3 - x2), q))} = ${answer}.`,
        `The output at input ${x3} is ${answer}.`,
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
          feedback: `Input ${x} is paired with two different outputs, ${y} and ${y + 1}. A function gives each input only one output.`,
        },
        {
          label: pairs([
            [x, y],
            [x + 1, y],
            [x + 1, y + 2],
          ]),
          feedback: `Input ${x + 1} is paired with two different outputs, ${y} and ${y + 2}. A function gives each input only one output.`,
        },
      ];
      prompt = "Which list of (input, output) pairs represents a function?";
      hint = `In each list, check the inputs ${x} and ${x + 1}: is either one paired with two different outputs? Repeating the very same pair is allowed.`;
      explanation = [
        "A function is a rule that gives each input exactly one output.",
        "So look for an input that appears with two different outputs. That breaks the rule.",
        duplicate
          ? `In the correct list, (${x}, ${y}) appears twice, but it is the same pair, so input ${x} still has only one output.`
          : `In the correct list, the inputs ${x}, ${x + 1} and ${x + 2} share the output ${y}. Different inputs may share an output.`,
        "In each other list, one input has two different outputs, so that list is not a function.",
      ];
      break;
    }
    case "relation-point-removal": {
      const sharedX = r(-1, 1);
      const points = [
        { x: r(-4, -2), y: r(-3, 3), shared: false },
        { x: sharedX, y: r(-4, -2), shared: true },
        { x: sharedX, y: r(2, 4), shared: true },
        { x: r(2, 4), y: r(-3, 3), shared: false },
      ];
      // Vary the letters attached to the conflicting pair. Coordinates, graph,
      // feedback and grading all use this one point model.
      for (let i = points.length - 1; i > 0; i--) {
        const j = r(0, i);
        [points[i], points[j]] = [points[j]!, points[i]!];
      }
      const labeled = points.map((point, i) => ({
        ...point,
        label: "ABCD"[i]!,
      }));
      const conflicting = labeled.filter((point) => point.shared);
      const others = labeled.filter((point) => !point.shared);
      const pair = (a: string, b: string) =>
        [a, b]
          .sort()
          .map((name) => `$${name}$`)
          .join(" or ");
      const correct = pair(conflicting[0]!.label, conflicting[1]!.label);
      choices = [
        { label: correct, correct: true },
        {
          label: pair(others[0]!.label, others[1]!.label),
          feedback: `Removing either of these points keeps both points at input ${sharedX}, so that input still has two outputs.`,
        },
        {
          label: pair(conflicting[0]!.label, others[0]!.label),
          feedback: `Removing $${others[0]!.label}$ leaves both points at input ${sharedX}. Check every proposed removal separately.`,
        },
        {
          label: pair(conflicting[1]!.label, others[1]!.label),
          feedback: `Removing $${others[1]!.label}$ leaves both points at input ${sharedX}. Check every proposed removal separately.`,
        },
      ];
      figure = {
        kind: "scene",
        scene: labeled
          .reduce(
            (builder, point) => builder.point(point.x, point.y, point.label),
            graph({ id: "relation", x: [-5, 5], y: [-5, 5], grid: 1 }),
          )
          .scene({
            title: labeled
              .map(
                (point) =>
                  `Point ${point.label} is at (${point.x}, ${point.y})`,
              )
              .join("; "),
          }),
      };
      prompt = `The graph shows four points, including two at $x = ${sharedX}$. Which choice lists every point that could be removed, one at a time, so the remaining relation is a function?`;
      hint = `At $x = ${sharedX}$, compare the outputs of the two plotted points. For each possible removal, ask whether that input would have just one output afterward.`;
      explanation = [
        `A relation (a set of input-output pairs) is a function when each input has exactly one output.`,
        `At $x = ${sharedX}$, points $${conflicting[0]!.label}$ and $${conflicting[1]!.label}$ have different outputs. That one input breaks the rule.`,
        `Removing either $${conflicting[0]!.label}$ or $${conflicting[1]!.label}$ leaves only one output for $x = ${sharedX}$.`,
        `Removing any other point leaves both of those points, so the problem stays.`,
        `The points that could be removed are ${correct}.`,
      ];
      break;
    }
    case "proportional-rule-choice": {
      const k = nz(6),
        b = nz(8);
      prompt = "Which rule is proportional for all real inputs $x$?";
      hint = `Put x = 0 into each rule. A proportional rule must give 0, so it cannot add ${b} or ${-b}.`;
      choices = [
        { label: `y = ${term(k)}`, correct: true },
        {
          label: `y = ${linear(k, b)}`,
          feedback: `This rule adds ${b}, so at x = 0 it gives y = ${b}, not 0. A proportional rule only multiplies $x$ by one number.`,
        },
        {
          label: `y = ${linear(-k, -b)}`,
          feedback: `This rule adds ${-b}, so at x = 0 it gives y = ${-b}, not 0. Its graph misses the origin, (0, 0), so it is not proportional.`,
        },
      ];
      explanation = [
        `A rule is proportional when $y$ is always the same number times $x$: y = kx, for one number $k$.`,
        `Then x = 0 always gives y = 0, and the graph is a line through (0, 0).`,
        `y = ${term(k)} only multiplies $x$ by ${k}, so it is proportional. The multiplier may be negative.`,
        `The other rules add a number, so x = 0 does not give 0. The proportional rule is y = ${term(k)}.`,
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
        ? `Plan A costs ${fee} + ${low}x dollars; Plan B costs ${high}x dollars. For whole inputs $x$ from 0 to 24, what is the first $x$ where A is strictly cheaper?`
        : `Plan A costs ${fee} + ${low}x dollars; Plan B costs ${high}x dollars. For real inputs $x$ from 0 to 24, at what $x$ do they cost the same?`;
      answer = whole ? String(Math.floor(fee / delta) + 1) : cross;
      label = whole ? "First whole input" : "Shared input";
      hint = whole
        ? `First find the tie: ${fee} + ${low}x = ${high}x. A is strictly cheaper only for inputs after the tie.`
        : `Set the costs equal, ${fee} + ${low}x = ${high}x, then collect the $x$ terms on one side.`;
      explanation = [
        `The plans cost the same when their cost expressions are equal: ${fee} + ${low}x = ${high}x.`,
        `Subtract $${term(low)}$ from both sides, so they stay equal: $${fee} = ${term(delta)}$.`,
        `Divide both sides by ${delta}: x = ${cross}. That is where the costs tie.`,
        ...(whole
          ? [
              `B grows ${delta} dollars faster per unit, so after the tie A is cheaper. "Strictly cheaper" means less, not equal, so $x$ must be greater than ${cross}.`,
              `The first whole number greater than ${cross} is ${answer}. Check: at x = ${answer}, A costs ${fee + low * Number(answer)} dollars and B costs ${high * Number(answer)} dollars.`,
              `A is first strictly cheaper at x = ${answer}.`,
            ]
          : [
              `Check: at x = ${cross}, both plans cost ${fraction(high * fee, delta)} dollars.`,
              `The plans cost the same at x = ${cross}.`,
            ]),
      ];
      break;
    }
    case "distance-graph-meaning": {
      const start = r(4, 8),
        drop = r(0, 1) ? r(1, 3) : 0,
        end = start - drop;
      prompt =
        "$x$: minutes; $y$: meters from home. From $A$ to $B$, how does $y$ change?";
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
            ? `The height of the graph is the distance from home. It goes down from ${start} at $A$ to ${end} at $B$, so the distance gets smaller, not larger.`
            : "A level graph means the distance from home does not change. Someone could still be moving, for example walking around home in a circle.",
        },
        {
          label: drop
            ? "Distance from home stays constant."
            : "Distance from home decreases.",
          feedback: drop
            ? `The graph is not level: it goes from ${start} meters at $A$ down to ${end} meters at $B$, so the distance changes.`
            : "The graph is level, so its height, the distance from home, stays the same. It does not go down.",
        },
      ];
      hint = `At $A$ the graph is at ${start} meters from home. Read the height at $B$, then compare: $y$ is distance from home, not the route.`;
      explanation = [
        `The height of a point on this graph ($y$) is the distance from home. Left to right is time passing.`,
        `At $A$, after 0 minutes, the distance is ${start} meters. At $B$, after 4 minutes, it is ${end} meters.`,
        drop
          ? `${end} is less than ${start}, so the graph goes down. The traveler got closer to home: the distance from home decreases.`
          : `The height stays at ${start}, so the graph is level. The distance from home stays constant, though the traveler might still be moving.`,
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
