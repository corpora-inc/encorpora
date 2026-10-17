import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
const definitions = [
  [
    "join-within-10",
    "Join two small groups",
    "addition-within-10",
    "K",
    "Model joining within ten with a ten-frame.",
  ],
  [
    "take-away-within-10",
    "Take some away",
    "subtraction-within-10",
    "K",
    "Find a remainder in a removal story within ten.",
  ],
  [
    "number-bond-missing",
    "Find the other part",
    "number-bonds",
    "K",
    "Complete a two-part decomposition of a number through ten.",
  ],
  [
    "ten-frame-complement",
    "Fill a ten-frame",
    "make-ten",
    "K",
    "Find the empty places needed to complete ten.",
  ],
  [
    "teen-frame-compose",
    "One ten and extra ones",
    "teen-place-value",
    "K",
    "Compose eleven through nineteen from ten ones and extras.",
  ],
  [
    "unknown-addend-story",
    "Find what was added",
    "missing-addend",
    "1",
    "Recover an unknown change from a start and total within twenty.",
  ],
  [
    "missing-start-story",
    "Find the starting amount",
    "addition-stories",
    "1",
    "Recover a starting amount from a removal and remaining amount.",
  ],
  [
    "balanced-addition",
    "Make both sides equal",
    "equality",
    "1",
    "Find a missing number in an equation with arithmetic on both sides.",
  ],
  [
    "three-addend-story",
    "Combine three groups",
    "three-addends",
    "1",
    "Add three quantities with a total at most twenty.",
  ],
  [
    "make-ten-remainder",
    "Split an addend to make ten",
    "addition-within-20",
    "1",
    "Find the part of an addend left after completing a ten.",
  ],
  [
    "subtract-through-ten",
    "Split a subtraction at ten",
    "subtraction-within-20",
    "1",
    "Find the amount still to subtract after reaching ten.",
  ],
  [
    "tens-ones-model",
    "Read tens and ones",
    "tens-and-ones",
    "1",
    "Compose a two-digit number from ten rods and unit squares.",
  ],
  [
    "ten-more-or-less",
    "Change one ten",
    "ten-more-less",
    "1",
    "Find ten more or ten less without recounting ones.",
  ],
  [
    "add-ones-regroup",
    "Make a new ten",
    "add-two-digit",
    "1",
    "Add a one-digit number to a two-digit number by regrouping ones.",
  ],
  [
    "subtract-whole-tens",
    "Subtract bundles of ten",
    "ten-more-less",
    "1",
    "Subtract whole tens with a nonnegative result.",
  ],
  [
    "hundreds-model",
    "Read hundreds tens and ones",
    "hundreds-place-value",
    "2",
    "Compose a three-digit number including zero-place cases.",
  ],
  [
    "expanded-form-missing",
    "Complete expanded form",
    "hundreds-place-value",
    "2",
    "Find a missing place-value amount in an expanded equation.",
  ],
  [
    "exchange-base-ten",
    "Exchange equal units",
    "hundreds-place-value",
    "2",
    "Regroup ten ones or ten tens while preserving value.",
  ],
  [
    "add-several-two-digit",
    "Add several groups",
    "multiple-addends",
    "2",
    "Combine three or four two-digit quantities.",
  ],
  [
    "add-with-regrouping",
    "Regroup a three-digit sum",
    "regroup-hundreds",
    "2",
    "Add within one thousand with a required ones-to-tens exchange.",
  ],
  [
    "subtract-with-regrouping",
    "Exchange to subtract",
    "regroup-hundreds",
    "2",
    "Subtract within one thousand including borrowing across a zero tens place.",
  ],
  [
    "skip-count-missing",
    "Find the next count",
    "skip-counting",
    "2",
    "Continue a count by fives tens or hundreds within one thousand.",
  ],
  [
    "two-step-change",
    "Follow two changes",
    "two-step-stories",
    "2",
    "Solve a join-then-remove story within one hundred.",
  ],
  [
    "continue-count-to-120",
    "Continue counting",
    "tens-and-ones",
    "1",
    "Continue by ones from any supported starting point through 120.",
  ],
] as const;
export const elementaryTemplates: readonly TemplateMetadata[] = definitions.map(
  ([id, title, skillId, , description]) => ({
    id,
    title,
    skillId,
    description,
    version: 1,
    gradeBand: "K–2",
  }),
);
export const elementaryGrades = Object.fromEntries(
  definitions.map(([id, , , grade]) => [id, grade]),
) as Record<string, "K" | "1" | "2">;
function random(id: string, seed: string) {
  let counter = 0;
  return (min: number, max: number) => {
    const range = max - min + 1,
      limit = Math.floor(0x100000000 / range) * range;
    let n: number;
    do {
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (n >= limit);
    return min + (n % range);
  };
}
function blocks(n: number): SemanticFigure {
  return {
    kind: "base-ten",
    hundreds: Math.floor(n / 100),
    tens: Math.floor(n / 10) % 10,
    ones: n % 10,
  };
}
export function generateElementaryProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = elementaryTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown elementary template: ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let prompt = "",
    answer = 0,
    hint = "",
    explanation: string[] = [];
  let figure: SemanticFigure | undefined;
  switch (templateId) {
    case "join-within-10": {
      const a = r(1, 8),
        b = r(1, 10 - a);
      figure = { kind: "ten-frame", first: a, second: b, capacity: 10 };
      prompt = `There are ${a} round counters and ${b} square counters. How many counters altogether?`;
      answer = a + b;
      hint = "Count both groups, touching each counter once.";
      explanation = [
        `The two parts are ${a} and ${b}.`,
        `Join the parts: ${a} + ${b} = ${answer}.`,
      ];
      break;
    }
    case "take-away-within-10": {
      const a = r(2, 10),
        b = r(1, a);
      figure = { kind: "ten-frame", first: a, second: 0, capacity: 10 };
      prompt = `There are ${a} counters. Take away ${b}. How many are left?`;
      answer = a - b;
      hint =
        "The picture shows the starting group. Cover the counters you take away.";
      explanation = [
        `Start with ${a} counters.`,
        `Remove ${b}: ${a} − ${b} = ${answer}.`,
        `Check: ${answer} + ${b} = ${a}.`,
      ];
      break;
    }
    case "number-bond-missing": {
      const total = r(2, 10),
        part = r(0, total);
      prompt = `${total} = ${part} + □. What number belongs in the box?`;
      answer = total - part;
      hint = "Find the part that joins the known part to make the whole.";
      explanation = [
        `The whole is ${total}; one part is ${part}.`,
        `The other part is ${total} − ${part} = ${answer}.`,
        `Together: ${part} + ${answer} = ${total}.`,
      ];
      break;
    }
    case "ten-frame-complement": {
      const n = r(1, 9);
      figure = { kind: "ten-frame", first: n, second: 0, capacity: 10 };
      prompt = "How many more counters will fill this ten-frame?";
      answer = 10 - n;
      hint = "Count the empty places. Each place holds one counter.";
      explanation = [
        `The frame has 10 places and ${n} counters.`,
        `There are 10 − ${n} = ${answer} empty places.`,
        `${n} + ${answer} = 10.`,
      ];
      break;
    }
    case "teen-frame-compose": {
      const extra = r(1, 9);
      figure = { kind: "ten-frame", first: 10, second: extra, capacity: 20 };
      prompt =
        "One frame is full. How many counters are in both frames altogether?";
      answer = 10 + extra;
      hint = "A full ten-frame holds ten. Count on for the extras.";
      explanation = [
        `The full frame has 10 counters.`,
        `The other frame has ${extra}.`,
        `10 + ${extra} = ${answer}.`,
      ];
      break;
    }
    case "unknown-addend-story": {
      const start = r(1, 15),
        added = r(1, 20 - start),
        total = start + added;
      prompt = `There were ${start} blocks. More blocks were added. There are ${total} now. How many were added?`;
      answer = added;
      hint = "Count from the starting amount up to the total.";
      explanation = [
        `The missing change makes ${start} + □ = ${total}.`,
        `Find it by subtracting: ${total} − ${start} = ${added}.`,
        `Check: ${start} + ${added} = ${total}.`,
      ];
      break;
    }
    case "missing-start-story": {
      const total = r(3, 20),
        removed = r(1, total - 1),
        left = total - removed;
      prompt = `Some blocks were in a box. ${removed} were taken out and ${left} stayed. How many were in the box at first?`;
      answer = total;
      hint = "Put the removed blocks and the remaining blocks back together.";
      explanation = [
        `The starting group was split into ${removed} removed and ${left} remaining.`,
        `The start was ${removed} + ${left} = ${total}.`,
        `Check: ${total} − ${removed} = ${left}.`,
      ];
      break;
    }
    case "balanced-addition": {
      const a = r(1, 9),
        b = r(1, 10),
        c = r(0, a + b);
      prompt = `${a} + ${b} = □ + ${c}. What number makes both sides equal?`;
      answer = a + b - c;
      hint =
        "Find the total on the left. The right side must have that same total.";
      explanation = [
        `The left side is ${a} + ${b} = ${a + b}.`,
        `The missing part is ${a + b} − ${c} = ${answer}.`,
        `Both sides equal ${a + b}.`,
      ];
      break;
    }
    case "three-addend-story": {
      const a = r(1, 8),
        b = r(1, 8),
        c = r(1, 20 - a - b);
      prompt = `A box holds ${a} red blocks, ${b} blue blocks, and ${c} green blocks. How many blocks?`;
      answer = a + b + c;
      hint = "Combine two groups, then add the third group.";
      explanation = [
        `First combine ${a} + ${b} = ${a + b}.`,
        `Then add ${c}: ${a + b} + ${c} = ${answer}.`,
        `Changing the grouping does not change the total.`,
      ];
      break;
    }
    case "make-ten-remainder": {
      const a = r(6, 9),
        b = r(11 - a, 9),
        needed = 10 - a;
      figure = { kind: "ten-frame", first: a, second: b, capacity: 20 };
      prompt = `To add ${a} + ${b}, move ${needed} from ${b} to make ten. How much of ${b} is left?`;
      answer = b - needed;
      hint = "Split the second addend into the part used and the part left.";
      explanation = [
        `${a} needs ${needed} more to make 10.`,
        `Split ${b} into ${needed} and ${answer}.`,
        `Then ${a} + ${b} = 10 + ${answer} = ${a + b}.`,
      ];
      break;
    }
    case "subtract-through-ten": {
      const a = r(11, 18),
        first = a - 10,
        b = r(first + 1, 9);
      prompt = `To find ${a} − ${b}, first take away ${first} to reach ten. How many more must you take away?`;
      answer = b - first;
      hint = "The total amount to remove has two parts.";
      explanation = [
        `You must remove ${b} in all.`,
        `${first} have been removed, leaving ${b} − ${first} = ${answer} more to remove.`,
        `The final amount is 10 − ${answer} = ${a - b}.`,
      ];
      break;
    }
    case "tens-ones-model": {
      const tens = r(1, 9),
        ones = r(0, 9);
      figure = { kind: "base-ten", hundreds: 0, tens, ones };
      prompt = "What number do these tens and ones show?";
      answer = 10 * tens + ones;
      hint = "Each long rod holds ten ones. Each small square is one.";
      explanation = [
        `${tens} tens have the value ${tens * 10}.`,
        `Add ${ones} ones: ${tens * 10} + ${ones} = ${answer}.`,
      ];
      break;
    }
    case "ten-more-or-less": {
      const n = r(20, 79),
        more = r(0, 1) === 1;
      figure = blocks(n);
      prompt = `What is ten ${more ? "more" : "less"} than ${n}?`;
      answer = n + (more ? 10 : -10);
      hint = `${more ? "Add" : "Remove"} one ten. Keep the ones unchanged.`;
      explanation = [
        `${n} is ${Math.floor(n / 10)} tens and ${n % 10} ones.`,
        `${more ? "One more" : "One fewer"} ten gives ${Math.floor(answer / 10)} tens and ${answer % 10} ones: ${answer}.`,
      ];
      break;
    }
    case "add-ones-regroup": {
      const tens = r(1, 8),
        ones = r(2, 9),
        b = r(10 - ones, 9),
        a = 10 * tens + ones;
      figure = blocks(a);
      prompt = `The blocks show ${a}. Add ${b} ones. What is the new total?`;
      answer = a + b;
      hint = "Combine the ones. Exchange ten ones for one new ten.";
      explanation = [
        `The ones give ${ones} + ${b} = ${ones + b}.`,
        `Exchange 10 ones for a ten, leaving ${ones + b - 10} ones.`,
        `There are ${tens + 1} tens and ${ones + b - 10} ones: ${answer}.`,
      ];
      break;
    }
    case "subtract-whole-tens": {
      const a = 10 * r(1, 9),
        b = 10 * r(1, a / 10);
      figure = blocks(a);
      prompt = `The model shows ${a}. Take away ${b}. What number is left?`;
      answer = a - b;
      hint = "Subtract the number of tens, then name their value.";
      explanation = [
        `${a} is ${a / 10} tens; ${b} is ${b / 10} tens.`,
        `${a / 10} − ${b / 10} = ${answer / 10} tens.`,
        `${answer / 10} tens have value ${answer}.`,
      ];
      break;
    }
    case "hundreds-model": {
      const h = r(1, 9),
        t = r(0, 9),
        o = r(0, 9);
      figure = { kind: "base-ten", hundreds: h, tens: t, ones: o };
      prompt = "What number does this base-ten model show?";
      answer = h * 100 + t * 10 + o;
      hint = "Add the value of the hundreds, the tens, and the ones.";
      explanation = [
        `${h} hundreds = ${100 * h}; ${t} tens = ${10 * t}; ${o} ones = ${o}.`,
        `${100 * h} + ${10 * t} + ${o} = ${answer}.`,
        `A place with no blocks has digit 0.`,
      ];
      break;
    }
    case "expanded-form-missing": {
      const h = r(1, 9),
        t = r(0, 9),
        o = r(0, 9),
        n = 100 * h + 10 * t + o;
      prompt = `${n} = ${100 * h} + □ + ${o}. What value belongs in the box?`;
      answer = 10 * t;
      hint =
        "The middle part gives the value of the tens, not just the tens digit.";
      explanation = [
        `${n} has ${h} hundreds, ${t} tens, and ${o} ones.`,
        `${t} tens have value ${answer}.`,
        `${100 * h} + ${answer} + ${o} = ${n}.`,
      ];
      break;
    }
    case "exchange-base-ten": {
      const tradeOnes = r(0, 1) === 1,
        h = r(1, 7),
        t = tradeOnes ? r(1, 8) : r(10, 19),
        o = tradeOnes ? r(10, 19) : r(0, 9);
      figure = { kind: "base-ten", hundreds: h, tens: t, ones: o };
      prompt = `Trade ten ${tradeOnes ? "ones for one ten" : "tens for one hundred"}. How many ${tradeOnes ? "tens" : "hundreds"} will there be?`;
      answer = tradeOnes ? t + 1 : h + 1;
      hint = "An exchange changes the groups, but not their total value.";
      explanation = tradeOnes
        ? [
            `Exchange 10 of the ${o} ones for one ten.`,
            `The ${t} tens become ${answer} tens; ${o - 10} ones remain.`,
            `The value stays ${100 * h + 10 * t + o}.`,
          ]
        : [
            `Exchange 10 of the ${t} tens for one hundred.`,
            `The ${h} hundreds become ${answer} hundreds; ${t - 10} tens remain.`,
            `The value stays ${100 * h + 10 * t + o}.`,
          ];
      break;
    }
    case "add-several-two-digit": {
      const values = Array.from({ length: r(3, 4) }, () => r(10, 59)),
        tens = values.reduce((s, v) => s + Math.floor(v / 10), 0),
        ones = values.reduce((s, v) => s + (v % 10), 0);
      prompt = `Find the total: ${values.join(" + ")}.`;
      answer = values.reduce((s, v) => s + v, 0);
      hint =
        "Combine the tens and the ones separately, then exchange any group of ten ones.";
      explanation = [
        `The tens contribute ${tens * 10}; the ones contribute ${ones}.`,
        `${tens * 10} + ${ones} = ${answer}.`,
        `Check by adding one number at a time.`,
      ];
      break;
    }
    case "add-with-regrouping": {
      const a = 100 * r(1, 4) + 10 * r(1, 7) + r(6, 9),
        b = 100 * r(1, 3) + 10 * r(1, 7) + r(6, 9),
        o = (a % 10) + (b % 10),
        t = (Math.floor(a / 10) % 10) + (Math.floor(b / 10) % 10) + 1,
        h = Math.floor(a / 100) + Math.floor(b / 100);
      prompt = `Add: ${a} + ${b}.`;
      answer = a + b;
      hint =
        "Add ones first. Exchange ten ones for a ten, then check whether the tens make a hundred.";
      explanation = [
        `Ones: ${a % 10} + ${b % 10} = ${o}. Keep ${o - 10} ones and exchange 10 ones for 1 ten.`,
        `Tens including that exchange: ${t}. ${t >= 10 ? `Exchange 10 tens for 1 hundred and keep ${t - 10} tens.` : `Keep ${t} tens.`}`,
        `Hundreds: ${h} + ${t >= 10 ? 1 : 0} = ${h + (t >= 10 ? 1 : 0)}. The sum is ${answer}.`,
      ];
      break;
    }
    case "subtract-with-regrouping": {
      const h = r(2, 9),
        t = r(0, 8),
        o = r(0, 4),
        a = h * 100 + t * 10 + o,
        b = r(0, h - 1) * 100 + r(1, 8) * 10 + r(5, 9);
      prompt = `Subtract: ${a} − ${b}.`;
      answer = a - b;
      let hh = h,
        tt = t,
        oo = o;
      explanation = [];
      if (tt === 0) {
        hh--;
        tt = 10;
        explanation.push(
          `Exchange 1 hundred for 10 tens: ${hh} hundreds and ${tt} tens.`,
        );
      }
      tt--;
      oo += 10;
      explanation.push(
        `Exchange 1 ten for 10 ones: ${tt} tens and ${oo} ones.`,
      );
      if (tt < Math.floor(b / 10) % 10) {
        hh--;
        tt += 10;
        explanation.push(
          `Exchange another hundred: there are ${hh} hundreds and ${tt} tens.`,
        );
      }
      explanation.push(
        `Subtract ones: ${oo} − ${b % 10} = ${oo - (b % 10)}.`,
        `Subtract tens: ${tt} − ${Math.floor(b / 10) % 10} = ${tt - (Math.floor(b / 10) % 10)}.`,
        `Subtract hundreds: ${hh} − ${Math.floor(b / 100)} = ${hh - Math.floor(b / 100)}. The difference is ${answer}.`,
      );
      hint =
        "Exchange a ten for ones. If there are no tens, first exchange a hundred for ten tens.";
      break;
    }
    case "skip-count-missing": {
      const step = [5, 10, 100][r(0, 2)]!,
        start = r(0, Math.floor((1000 - 3 * step) / step)) * step;
      prompt = `Count by ${step}: ${start}, ${start + step}, ${start + 2 * step}, □. What comes next?`;
      answer = start + 3 * step;
      hint = "Add the same step each time.";
      explanation = [
        `Each step adds ${step}.`,
        `${start + 2 * step} + ${step} = ${answer}.`,
      ];
      break;
    }
    case "two-step-change": {
      const start = r(10, 60),
        added = r(5, 100 - start),
        removed = r(1, start + added);
      prompt = `There are ${start} books. Add ${added} books, then take away ${removed}. How many books remain?`;
      answer = start + added - removed;
      hint =
        "Follow the changes in order. Find the amount after adding before taking any away.";
      explanation = [
        `After adding: ${start} + ${added} = ${start + added}.`,
        `After removing: ${start + added} − ${removed} = ${answer}.`,
      ];
      break;
    }
    case "continue-count-to-120": {
      const start = r(0, 117);
      prompt = `Count on by ones: ${start}, ${start + 1}, ${start + 2}, □. What comes next?`;
      answer = start + 3;
      hint =
        "Each next number is one more, including when a new ten or hundred begins.";
      explanation = [
        `The count increases by 1 each time.`,
        `${start + 2} + 1 = ${answer}.`,
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
