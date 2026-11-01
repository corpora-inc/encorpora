import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { isAre, wasWere } from "./agreement.js";

type Random = (low: number, high: number) => number;
/** Grade levels of the catalog skills these families serve. */
const definitions = [
  [
    "number-bond-missing",
    "Find the other part",
    "number-bonds",
    "Find a missing part of a number through ten from an equation, a number bond, or a story.",
  ],
  [
    "unknown-addend-story",
    "Find what was added",
    "missing-addend",
    "Find a missing addend within twenty from a story or an equation, with a bar model.",
  ],
  [
    "balanced-addition",
    "Make both sides equal",
    "equality",
    "Find the number that makes both sides of an equation equal, shown on a level balance.",
  ],
  [
    "three-addend-story",
    "Combine three groups",
    "three-addends",
    "Add three one-digit numbers with a total at most twenty, often by making ten.",
  ],
  [
    "two-step-change",
    "Follow two changes",
    "two-step-stories",
    "Solve a two-step joining and separating story within one hundred, with the result, a change, or the start unknown.",
  ],
] as const;
export const earlyOperationsTemplates: readonly TemplateMetadata[] =
  definitions.map(([id, title, skillId, description]) => ({
    id,
    title,
    skillId,
    description,
    gradeBand: "K–2",
    version: 1,
  }));

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
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
/** "1 block", "3 blocks". */
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const countOn = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i + 1).join(", ");

const bondStories = [
  (whole: number, part: number) =>
    `${whole} apples are in a bowl. ${part} ${isAre(part)} red and the rest are green. How many are green?`,
  (whole: number, part: number) =>
    `${whole} birds sit on a fence. ${part} ${isAre(part)} big and the rest are small. How many are small?`,
  (whole: number, part: number) =>
    `${whole} ducks are at the pond. ${part} ${isAre(part)} in the water and the rest are on the grass. How many are on the grass?`,
];
const threeStories = [
  (a: number, b: number, c: number) =>
    `A box holds ${count(a, "red block")}, ${count(b, "blue block")}, and ${count(c, "green block")}. How many blocks?`,
  (a: number, b: number, c: number) =>
    `Sam read ${count(a, "page")} on Monday, ${count(b, "page")} on Tuesday and ${count(c, "page")} on Wednesday. How many pages did he read?`,
  (a: number, b: number, c: number) =>
    `A team scored ${count(a, "point")}, then ${count(b, "point")}, then ${count(c, "point")}. How many points did the team score?`,
];

export function generateEarlyOperationsProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = earlyOperationsTemplates.find((t) => t.id === templateId);
  if (!meta)
    throw new Error(`Unknown early-operations template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = 0,
    hint = "",
    explanation: string[] = [],
    figure: SemanticFigure;
  switch (templateId) {
    case "number-bond-missing": {
      const whole = r(2, 10),
        // Mostly two nonzero parts; now and then a part of 0 or the whole.
        part = r(0, 7) ? r(1, whole - 1) : pick(r, [0, whole]),
        frame = r(0, 3);
      answer = whole - part;
      const left = frame === 1 || (frame === 2 && r(0, 1) === 1);
      figure = {
        kind: "number-bond",
        whole,
        parts: left ? [null, part] : [part, null],
      };
      prompt =
        frame === 0
          ? `${whole} = ${part} + □. What number belongs in the box?`
          : frame === 1
            ? `□ + ${part} = ${whole}. What number belongs in the box?`
            : frame === 2
              ? "What number is missing from the number bond?"
              : pick(r, bondStories)(whole, part);
      hint =
        part === whole
          ? `One part is already all ${whole}. What is left for the other part?`
          : `The whole is ${whole} and one part is ${part}. Count on from ${part} to ${whole}.`;
      explanation = [
        `The whole is the total. The two parts together make the whole.`,
        `Here the whole is ${whole} and one part is ${part}, so the missing part is what you add to ${part} to reach ${whole}.`,
        part === whole
          ? `${part} is already the whole, so nothing is left for the other part.`
          : part === 0
            ? `A part of 0 is nothing, so the other part must be the whole ${whole}.`
            : `Count on from ${part} to ${whole}: ${countOn(part, whole)}. That is ${answer} counts.`,
        `Check: ${part} + ${answer} = ${whole}. The missing number is ${answer}.`,
      ];
      break;
    }
    case "unknown-addend-story": {
      const start = r(1, 15),
        added = r(1, 20 - start),
        total = start + added,
        frame = r(0, 3);
      answer = added;
      figure = {
        kind: "bar-model",
        whole: total,
        parts: frame === 3 ? [null, start] : [start, null],
      };
      prompt =
        frame === 0
          ? `There ${wasWere(start)} ${count(start, "block")}. More blocks were added. There are ${total} now. How many were added?`
          : frame === 1
            ? `${start} + □ = ${total}. What number belongs in the box?`
            : frame === 2
              ? `Mia has ${count(start, "shell")}. How many more shells does she need to have ${total}?`
              : `□ + ${start} = ${total}. What number belongs in the box?`;
      hint = `Write it as ${start} + □ = ${total}. Count up from ${start} to ${total} and keep track of how many you count.`;
      explanation = [
        `The total, ${total}, is the whole. ${start} is one part, and the other part is missing.`,
        `A missing part is the whole minus the part you know, because the two parts make the whole.`,
        total - start <= 5
          ? `Count up from ${start} to ${total}: ${countOn(start, total)}. That is ${added} counts.`
          : `Subtract: ${total} − ${start} = ${added}.`,
        `Check: ${start} + ${added} = ${total}. The missing part is ${added}.`,
      ];
      break;
    }
    case "balanced-addition": {
      const a = r(1, 9),
        b = r(1, 10),
        sum = a + b,
        c = r(1, sum - 1),
        frame = r(0, 3);
      if (frame === 3) {
        answer = sum;
        figure = { kind: "equal-balance", left: [null], right: [a, b] };
        prompt = `□ = ${a} + ${b}. What number belongs in the box?`;
        hint = `The equal sign means both sides have the same value. Find ${a} + ${b}.`;
        explanation = [
          `The equal sign (=) means both sides have the same value. It does not mean "the answer comes next".`,
          `So the box must have the same value as ${a} + ${b}.`,
          `${a} + ${b} = ${sum}, so ${sum} belongs in the box.`,
        ];
        break;
      }
      answer = sum - c;
      const right: [number | null, number | null] =
        frame === 1 ? [c, null] : [null, c];
      figure =
        frame === 2
          ? { kind: "equal-balance", left: right, right: [a, b] }
          : { kind: "equal-balance", left: [a, b], right };
      const boxSide = frame === 1 ? `${c} + □` : `□ + ${c}`;
      prompt =
        frame === 2
          ? `${boxSide} = ${a} + ${b}. What number makes both sides equal?`
          : `${a} + ${b} = ${boxSide}. What number makes both sides equal?`;
      hint = `First find ${a} + ${b}. The box and ${c} together must make that same total.`;
      explanation = [
        `The equal sign (=) means both sides have the same value, like a balanced scale.`,
        `${a} + ${b} = ${sum}, so ${boxSide} must also be ${sum}.`,
        `What adds to ${c} to reach ${sum}? ${sum} − ${c} = ${answer}.`,
        `Check: both sides equal ${sum}. The box holds ${answer}.`,
      ];
      break;
    }
    case "three-addend-story": {
      let a: number, b: number, c: number;
      if (r(0, 1)) {
        // Two of the addends make ten.
        const x = r(1, 9),
          y = 10 - x,
          z = r(1, 9);
        [a, b, c] = pick(r, [
          [x, y, z],
          [x, z, y],
          [z, x, y],
        ]);
      } else {
        a = r(1, 8);
        b = r(1, Math.min(9, 18 - a));
        c = r(1, Math.min(9, 20 - a - b));
      }
      const frame = r(0, 3);
      answer = a + b + c;
      figure = { kind: "addend-groups", addends: [a, b, c] };
      prompt =
        frame === 3
          ? `What is ${a} + ${b} + ${c}?`
          : threeStories[frame]!(a, b, c);
      const ten = (
        [
          [a, b, c],
          [b, c, a],
          [a, c, b],
        ] as const
      ).find(([x, y]) => x + y === 10);
      const totalLine = [
        `There are ${answer} blocks.`,
        `Sam read ${answer} pages.`,
        `The team scored ${answer} points.`,
        `${a} + ${b} + ${c} = ${answer}.`,
      ][frame]!;
      hint = ten
        ? `Look for a ten first: ${ten[0]} + ${ten[1]} = 10. Then add the other ${ten[2]}.`
        : `Add two numbers first, ${a} + ${b}. Then add the ${c}.`;
      explanation = ten
        ? [
            `You may add numbers in any order; the total stays the same.`,
            `So add the two that make 10 first, because 10 is easy to add to: ${ten[0]} + ${ten[1]} = 10.`,
            `Then add the rest: 10 + ${ten[2]} = ${answer}.`,
            totalLine,
          ]
        : [
            `Add two numbers first, then add the third to that. Any order gives the same total.`,
            `${a} + ${b} = ${a + b}.`,
            `${a + b} + ${c} = ${answer}.`,
            totalLine,
          ];
      break;
    }
    case "two-step-change": {
      const frame = r(0, 3);
      if (frame === 0) {
        const start = r(10, 60),
          added = r(5, 100 - start),
          removed = r(1, start + added);
        answer = start + added - removed;
        figure = {
          kind: "change-chain",
          start,
          steps: [
            { op: "+", value: added },
            { op: "−", value: removed },
          ],
          end: null,
        };
        prompt = `There are ${start} books. Add ${added} books, then take away ${removed}. How many books remain?`;
        hint = `Do the changes in order. First find ${start} + ${added}, the books there are before any are taken away.`;
        explanation = [
          `Do the changes in the order they happen.`,
          `Adding ${added} books makes more: ${start} + ${added} = ${start + added}.`,
          `Taking away ${removed} makes fewer: ${start + added} − ${removed} = ${answer}.`,
          `${answer} ${answer === 1 ? "book remains" : "books remain"}.`,
        ];
      } else if (frame === 1) {
        const start = r(20, 80),
          off = r(1, start - 1),
          on = r(1, 100 - (start - off));
        answer = start - off + on;
        figure = {
          kind: "change-chain",
          start,
          steps: [
            { op: "−", value: off },
            { op: "+", value: on },
          ],
          end: null,
        };
        prompt = `A bus has ${start} people. At a stop, ${off} ${off === 1 ? "gets" : "get"} off and then ${on} ${on === 1 ? "gets" : "get"} on. How many people are on the bus now?`;
        hint = `First find how many are left after ${off} get off: ${start} − ${off}.`;
        explanation = [
          `Follow the changes in order: first people get off, then people get on.`,
          `Getting off makes fewer, so subtract: ${start} − ${off} = ${start - off}.`,
          `Getting on makes more, so add: ${start - off} + ${on} = ${answer}.`,
          `There ${answer === 1 ? "is 1 person" : `are ${answer} people`} on the bus now.`,
        ];
      } else if (frame === 2) {
        const start = r(10, 50),
          came = r(5, 40),
          gone = r(1, start + came - 1),
          end = start + came - gone;
        answer = gone;
        figure = {
          kind: "change-chain",
          start,
          steps: [
            { op: "+", value: came },
            { op: "−", value: null },
          ],
          end,
        };
        prompt = `There were ${start} birds in a tree. ${came} more came. Then some flew away, and now there ${isAre(end)} ${end}. How many flew away?`;
        hint = `First find how many birds there were before any flew away: ${start} + ${came}.`;
        explanation = [
          `First find how many birds there were before any flew away.`,
          `${came} more came, so add: ${start} + ${came} = ${start + came}.`,
          `The number that flew away is the drop from ${start + came} to ${end}: ${start + came} − ${end} = ${gone}.`,
          `Check: ${start} + ${came} − ${gone} = ${end}. ${gone} ${gone === 1 ? "bird" : "birds"} flew away.`,
        ];
      } else {
        const start = r(10, 60),
          added = r(5, 30),
          removed = r(1, start + added - 1),
          end = start + added - removed;
        answer = start;
        figure = {
          kind: "change-chain",
          start: null,
          steps: [
            { op: "+", value: added },
            { op: "−", value: removed },
          ],
          end,
        };
        prompt = `Some marbles were in a bag. ${added} were put in, then ${removed} ${wasWere(removed)} taken out. Now there are ${end}. How many marbles were in the bag at first?`;
        hint = `Work backward from ${end}: put back the ${removed} taken out first.`;
        explanation = [
          `To find the start, work backward and undo each change, last change first.`,
          `${removed} ${removed === 1 ? "was" : "were"} taken out last, so put ${removed === 1 ? "it" : "them"} back: ${end} + ${removed} = ${end + removed}.`,
          `${added} ${added === 1 ? "was" : "were"} put in first, so take ${added === 1 ? "it" : "them"} out: ${end + removed} − ${added} = ${start}.`,
          `Check: ${start} + ${added} − ${removed} = ${end}. There were ${start} marbles in the bag at first.`,
        ];
      }
      break;
    }
    default:
      throw new Error(`Unknown early-operations template: ${templateId}`);
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
      figure,
    },
    answer: String(answer),
    hint,
    explanation,
  };
}
