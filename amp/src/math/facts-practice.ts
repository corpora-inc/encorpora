import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { formatWhole } from "./comparison-practice";

type Random = (low: number, high: number) => number;
const definitions = [
  [
    "facts-to-five",
    "Facts to five",
    "facts-within-5",
    "Add or subtract with numbers from 0 to 5 and a result from 0 to 5.",
  ],
  [
    "count-on-back",
    "Count on or back",
    "counting-arithmetic",
    "Count on or back 1 to 4 steps from a marked number on a 0–20 number line.",
  ],
  [
    "counted-steps",
    "How many counts?",
    "counting-arithmetic",
    "Name the number added or subtracted by a shown count on or count back.",
  ],
  [
    "make-ten-fact",
    "Make ten to add",
    "addition-facts",
    "Add two one-digit numbers whose sum is 11 to 18, shown on two ten-frames.",
  ],
  [
    "related-subtraction",
    "Subtract by thinking addition",
    "addition-facts",
    "Subtract within 20, mostly across ten, using the related addition fact.",
  ],
  [
    "mental-ten-hundred",
    "Ten or one hundred more or less",
    "mental-tens-hundreds",
    "Add or subtract 10 or 100 to or from a number from 100 to 900.",
  ],
] as const;
export const factsTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, description]) => ({
    id,
    title,
    skillId,
    description,
    gradeBand: "K–2",
    version: 1,
  }),
);

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}
const counts = (from: number, steps: number, direction: 1 | -1) =>
  Array.from({ length: steps }, (_, i) => from + direction * (i + 1));
const unit = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
/** "4 hundreds, 7 tens, 0 ones" with singular units for 1. */
const places = (n: number) =>
  [
    unit(Math.floor(n / 100), "hundred", "hundreds"),
    unit(Math.floor(n / 10) % 10, "ten", "tens"),
    unit(n % 10, "one", "ones"),
  ].join(", ");

export function generateFactsProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = factsTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown facts template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = 0,
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure | undefined;
  switch (templateId) {
    case "facts-to-five": {
      if (r(0, 1)) {
        const a = r(0, 5),
          b = r(0, 5 - a);
        prompt = `What is ${a} + ${b}?`;
        answer = a + b;
        const big = Math.max(a, b),
          small = Math.min(a, b);
        hint = small
          ? `Hold ${big} in your head and count on ${small}, one finger for each count.`
          : `Nothing is added to ${big} when you add 0.`;
        explanation =
          b === 0 || a === 0
            ? [
                `Adding 0 adds nothing: ${a} + ${b} = ${answer}.`,
                `${Math.max(a, b)} stays ${answer}.`,
              ]
            : [
                `Start at ${Math.max(a, b)} and count on ${Math.min(a, b)}: ${counts(Math.max(a, b), Math.min(a, b), 1).join(", ")}.`,
                `${a} + ${b} = ${answer}.`,
              ];
      } else {
        const a = r(1, 5),
          b = r(0, a);
        prompt = `What is ${a} − ${b}?`;
        answer = a - b;
        hint = `Think of the addition: ${b} + □ = ${a}.`;
        explanation = [
          `${b} + ${answer} = ${a}, so ${answer} ${answer === 1 ? "is" : "are"} left when ${b} ${b === 1 ? "is" : "are"} taken from ${a}.`,
          `${a} − ${b} = ${answer}.`,
        ];
      }
      break;
    }
    case "count-on-back": {
      const steps = r(1, 4),
        on = r(0, 1) === 1;
      // Half the counts cross ten: 8 on 3 lands on 11; 12 back 4 lands on 8.
      const cross = r(0, 1) === 1;
      const start = on
        ? cross
          ? r(10 - steps, 9)
          : r(0, 1)
            ? r(0, 9 - steps)
            : r(10, 20 - steps)
        : cross
          ? r(10, 9 + steps)
          : r(0, 1)
            ? r(steps, 9)
            : r(10 + steps, 20);
      answer = start + (on ? steps : -steps);
      figure = { kind: "number-line", min: 0, max: 20, points: [start] };
      prompt = `Start at ${start}. Count ${on ? "on" : "back"} ${steps}. What number do you land on?`;
      hint = `Start at ${start} and jump ${steps === 1 ? "once" : `${steps} times`} to the ${on ? "right" : "left"}, one step each time. Do not count ${start} itself.${cross ? " You will cross ten." : ""}`;
      explanation = [
        `Count ${on ? "on" : "back"} ${steps} from ${start}: ${counts(start, steps, on ? 1 : -1).join(", ")}.`,
        `${steps === 1 ? "That 1 count" : `Those ${steps} counts`} ${on ? "add" : "subtract"}${steps === 1 ? "s" : ""} ${steps}: ${start} ${on ? "+" : "−"} ${steps} = ${answer}.`,
      ];
      break;
    }
    case "counted-steps": {
      const steps = r(2, 5),
        on = r(0, 1) === 1,
        start = on ? r(3, 20 - steps) : r(steps + 1, 20);
      const said = counts(start, steps, on ? 1 : -1);
      prompt = on
        ? `Count on from ${start}: ${said.join(", ")}. How many were added to ${start}?`
        : `Count back from ${start}: ${said.join(", ")}. How many were subtracted from ${start}?`;
      answer = steps;
      hint = `${start} is the starting point, not a step. Count only the numbers said after it.`;
      explanation = [
        `The counts after ${start} are ${said.join(", ")}: ${steps} numbers.`,
        `Each count is one more${on ? "" : " taken away"}, so ${start} ${on ? "+" : "−"} ${steps} = ${said.at(-1)}.`,
      ];
      break;
    }
    case "make-ten-fact": {
      const a = r(2, 9),
        b = r(11 - a, 9),
        need = 10 - a,
        rest = b - need;
      figure = { kind: "ten-frame-pair", first: a, second: b };
      prompt = `What is ${a} + ${b}?`;
      answer = a + b;
      hint = `Fill the first frame to make ten, then add what is left of ${b}.`;
      explanation = [
        `${a} needs ${need} more to make 10.`,
        `Split ${b} into ${need} and ${rest}.`,
        `10 + ${rest} = ${answer}.`,
      ];
      break;
    }
    case "related-subtraction": {
      let whole: number, part: number;
      if (r(0, 4)) {
        // Across ten: 15 − 8.
        part = r(2, 9);
        whole = r(11, part + 9);
      } else {
        whole = r(11, 20);
        part = r(1, Math.min(9, whole - 10));
      }
      answer = whole - part;
      prompt = `What is ${whole} − ${part}?`;
      hint = `Think of the addition fact: ${part} + □ = ${whole}.`;
      explanation =
        whole - part >= 10
          ? [
              `${whole} is 10 and ${whole - 10}. Take ${part} from the ${whole - 10} ones.`,
              `${whole - 10} − ${part} = ${whole - 10 - part}, and 10 + ${whole - 10 - part} = ${answer}.`,
              `Check: ${part} + ${answer} = ${whole}.`,
            ]
          : [
              `Think ${part} + □ = ${whole}. From ${part}, ${10 - part} more makes 10.`,
              `From 10, ${whole - 10} more makes ${whole}. In all, ${10 - part} + ${whole - 10} = ${answer}.`,
              `So ${part} + ${answer} = ${whole} and ${whole} − ${part} = ${answer}.`,
            ];
      break;
    }
    case "mental-ten-hundred": {
      const step = r(0, 1) ? 10 : 100,
        up = r(0, 1) === 1;
      let n: number;
      if (step === 10 && r(0, 1)) {
        // Crossing a hundred: 396 + 10 or 503 − 10.
        n = up ? r(1, 8) * 100 + 90 + r(0, 9) : r(2, 8) * 100 + r(0, 9);
      } else n = r(up ? 100 : 100 + step, up ? 900 : 900);
      answer = n + (up ? step : -step);
      const sign = up ? "+" : "−";
      prompt = `What is ${n} ${sign} ${step}?`;
      const crossed =
        Math.floor(answer / 100) !== Math.floor(n / 100) && step === 10;
      const tens = Math.floor(n / 10) % 10;
      hint =
        step === 100
          ? `${n} has ${Math.floor(n / 100)} hundreds. ${up ? "Adding" : "Taking away"} 100 changes only the hundreds digit.`
          : up && tens === 9
            ? `${n} has 9 tens. One more ten makes ten tens, which is one more hundred.`
            : !up && tens === 0
              ? `${n} has no tens to take, so trade 1 hundred for 10 tens first.`
              : `${n} has ${tens} tens. ${up ? "Adding" : "Taking away"} 10 changes only the tens digit.`;
      explanation = [
        `${n} is ${places(n)}.`,
        crossed
          ? up
            ? `One more ten makes 10 tens, which is 1 more hundred: ${places(answer)}.`
            : `There are no tens to take, so trade 1 hundred for 10 tens and take 1: ${places(answer)}.`
          : `${up ? "One more" : "One fewer"} ${step === 10 ? "ten" : "hundred"}: ${places(answer)}.`,
        `${n} ${sign} ${step} = ${formatWhole(answer)}.`,
      ];
      break;
    }
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
      response: { kind: "number", label: "Answer" },
      ...(figure ? { figure } : {}),
    },
    answer: String(answer),
    hint,
    explanation,
  };
}
