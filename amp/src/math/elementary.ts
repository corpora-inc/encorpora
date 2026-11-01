import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { wasWere, hasHave, isAre } from "./agreement.js";

/** "1 ten", "3 tens": a count with its noun in agreement. */
const count = (n: number, word: string) =>
  `${n} ${n === 1 ? word : `${word}s`}`;
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
    "missing-start-story",
    "Find the starting amount",
    "addition-stories",
    "1",
    "Recover a starting amount from a removal and remaining amount.",
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
      prompt = `There ${isAre(a)} ${count(a, "round counter")} and ${count(b, "square counter")}. How many counters altogether?`;
      answer = a + b;
      hint = `Say ${a} for the ${count(a, "round counter")}. Then count on one number for each of the ${count(b, "square counter")}.`;
      explanation = [
        `"Altogether" means put the two groups together, so add.`,
        `There ${isAre(a)} ${a} round and ${b} square: those are the two parts.`,
        `Start at ${a} and count on ${b}: ${Array.from({ length: b }, (_, i) => a + i + 1).join(", ")}.`,
        `${a} + ${b} = ${answer}, so there are ${count(answer, "counter")} altogether.`,
      ];
      break;
    }
    case "take-away-within-10": {
      const a = r(2, 10),
        b = r(1, a);
      figure = { kind: "ten-frame", first: a, second: 0, capacity: 10 };
      prompt = `There are ${a} counters. Take away ${b}. How many are left?`;
      answer = a - b;
      hint = `Start with all ${a} counters. Cover ${b} of them, then count the counters still showing.`;
      explanation = [
        `"Take away" means some leave the group, so subtract.`,
        `Start with ${a} counters and remove ${b}: ${a} − ${b} = ${answer}.`,
        `Check by putting them back: ${answer} + ${b} = ${a}.`,
        `${answer === 1 ? "1 counter is" : `${answer} counters are`} left.`,
      ];
      break;
    }
    case "ten-frame-complement": {
      const n = r(1, 9);
      figure = { kind: "ten-frame", first: n, second: 0, capacity: 10 };
      prompt = "How many more counters will fill this ten-frame?";
      answer = 10 - n;
      hint =
        n >= 5
          ? "A ten-frame has 10 places, and the top row is full. Count the empty places in the bottom row."
          : "A ten-frame has 10 places. The bottom row is all empty, so start at 5 and count on the empty places in the top row.";
      explanation = [
        `A ten-frame has 10 places, so a full frame holds 10 counters.`,
        `${count(n, "place")} ${n === 1 ? "is" : "are"} filled, so the empty places are what is missing.`,
        `Count the empty places, or find 10 − ${n} = ${answer}.`,
        `Check: ${n} + ${answer} = 10. ${answer === 1 ? "1 more counter fills" : `${answer} more counters fill`} the frame.`,
      ];
      break;
    }
    case "teen-frame-compose": {
      const extra = r(1, 9);
      figure = { kind: "ten-frame", first: 10, second: extra, capacity: 20 };
      prompt =
        "One frame is full. How many counters are in both frames altogether?";
      answer = 10 + extra;
      hint =
        extra > 5
          ? "The full frame is 10. In the other frame, the top row adds 5 more; then count on through its bottom row."
          : "The full frame is 10. Say 10, then count on one number for each counter in the other frame.";
      explanation = [
        `A full ten-frame always holds 10 counters, so you do not need to count it.`,
        `Say 10, then count on the ${extra} in the other frame.`,
        `10 + ${extra} = ${answer}: a teen number is 1 ten and some ones.`,
        `There are ${answer} counters altogether.`,
      ];
      break;
    }
    case "missing-start-story": {
      const total = r(3, 20),
        removed = r(1, total - 1),
        left = total - removed;
      prompt = `Some blocks were in a box. ${removed} ${wasWere(removed)} taken out and ${left} stayed. How many were in the box at first?`;
      answer = total;
      hint = `At first the box held both groups: the ${removed} taken out and the ${left} that stayed. Put them back together.`;
      explanation = [
        `Every block that was in the box either was taken out or stayed.`,
        `So put the two groups back together: ${removed} + ${left} = ${total}.`,
        `Check: start with ${total} and take out ${removed}; then ${left} ${isAre(left)} left in the box.`,
        `There were ${count(total, "block")} in the box at first.`,
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
      hint = `Split ${b} into two parts: the ${needed} that moves to the ${a}, and the part that stays.`;
      explanation = [
        `Making a ten first helps, because 10 plus a number is easy to read.`,
        `${a} needs ${needed} more to make 10, so move ${needed} from the ${b} to the ${a}.`,
        `What stays is ${b} − ${needed} = ${answer}, because ${needed} + ${answer} = ${b}.`,
        `So ${a} + ${b} = 10 + ${answer} = ${a + b}. The part of ${b} left is ${answer}.`,
      ];
      break;
    }
    case "subtract-through-ten": {
      const a = r(11, 18),
        first = a - 10,
        b = r(first + 1, 9);
      prompt = `To find ${a} − ${b}, first take away ${first} to reach ten. How many more must you take away?`;
      answer = b - first;
      hint = `You take away ${b} in all, in two parts: ${first} first, then the rest: ${first} + □ = ${b}.`;
      explanation = [
        `Subtracting in two parts through 10 keeps each part small.`,
        `You take away ${b} in all. Taking ${first} first lands on 10, because ${a} − ${first} = 10.`,
        `${first} ${hasHave(first)} been taken, so the rest is ${b} − ${first} = ${answer}.`,
        `Then 10 − ${answer} = ${a - b}, so ${a} − ${b} = ${a - b}.`,
        `You must take away ${answer} more.`,
      ];
      break;
    }
    case "tens-ones-model": {
      const tens = r(1, 9),
        ones = r(0, 9);
      figure = { kind: "base-ten", hundreds: 0, tens, ones };
      prompt = "What number do these tens and ones show?";
      answer = 10 * tens + ones;
      hint = `There ${isAre(tens)} ${tens} ${tens === 1 ? "rod" : "rods"} of ten. Count ${tens === 1 ? "it" : "them"} by tens, then count on one for each small square.`;
      explanation = [
        `Each rod is a ten (10 small squares joined), and each small square is a one.`,
        tens === 1
          ? `There is 1 rod, which is 10.`
          : `Count the rods by tens: ${Array.from({ length: tens }, (_, i) => (i + 1) * 10).join(", ")}. That is ${tens * 10}.`,
        ones
          ? `Then count on ${count(ones, "one")}: ${tens * 10} + ${ones} = ${answer}.`
          : `There are no small squares, so there are 0 ones.`,
        `The blocks show ${answer}.`,
      ];
      break;
    }
    case "ten-more-or-less": {
      const n = r(20, 79),
        more = r(0, 1) === 1;
      figure = blocks(n);
      prompt = `What is ten ${more ? "more" : "less"} than ${n}?`;
      answer = n + (more ? 10 : -10);
      hint = `${n} is ${Math.floor(n / 10)} tens and ${n % 10} ones. Ten ${more ? "more adds" : "less removes"} one ten; the ${n % 10} ones stay.`;
      explanation = [
        `${n} is ${count(Math.floor(n / 10), "ten")} and ${count(n % 10, "one")}.`,
        `Ten ${more ? "more adds" : "less takes away"} exactly one ten, so only the tens digit changes.`,
        `${count(Math.floor(n / 10), "ten")} ${more ? "plus" : "minus"} 1 ten is ${count(Math.floor(answer / 10), "ten")}. The ones digit stays ${n % 10}.`,
        `Ten ${more ? "more" : "less"} than ${n} is ${answer}.`,
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
      hint = `The ones make ${ones} + ${b}, more than 9. Trade 10 of those ones for one new ten.`;
      explanation = [
        `${a} is ${count(tens, "ten")} and ${count(ones, "one")}. Add the ones first.`,
        `${ones} + ${b} = ${ones + b} ones, which is more than 9.`,
        `A place can hold at most 9, so trade 10 ones for 1 new ten. That leaves ${count(ones + b - 10, "one")}.`,
        `Now there are ${count(tens + 1, "ten")} and ${count(ones + b - 10, "one")}.`,
        `The new total is ${answer}.`,
      ];
      break;
    }
    case "subtract-whole-tens": {
      const a = 10 * r(1, 9),
        b = 10 * r(1, a / 10);
      figure = blocks(a);
      prompt = `The model shows ${a}. Take away ${b}. What number is left?`;
      answer = a - b;
      hint = `${a} is ${a / 10} tens and ${b} is ${b / 10} tens. Take ${b / 10} tens from ${a / 10} tens.`;
      explanation = [
        `Both numbers are whole tens, so subtract tens like counting objects.`,
        `${a} is ${count(a / 10, "ten")} and ${b} is ${count(b / 10, "ten")}.`,
        `${a / 10} − ${b / 10} = ${answer / 10}, so ${count(answer / 10, "ten")} ${answer / 10 === 1 ? "is" : "are"} left.`,
        `${count(answer / 10, "ten")} ${answer / 10 === 1 ? "is" : "make"} ${answer}, so ${answer} is left.`,
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
      hint = `There ${isAre(h)} ${h} ${h === 1 ? "flat" : "flats"} of one hundred: that is the hundreds digit. Then count the rods for the tens digit and the small squares for the ones digit.`;
      explanation = [
        `A flat is a hundred, a rod is a ten, and a small square is a one.`,
        `${count(h, "flat")} ${h === 1 ? "is" : "make"} ${100 * h}, ${count(t, "rod")} ${t === 1 ? "is" : "make"} ${10 * t}, and ${count(o, "small square")} ${o === 1 ? "is" : "make"} ${o}.`,
        ...(t === 0 || o === 0
          ? [`A place with no blocks still gets a digit: 0 holds its place.`]
          : []),
        `Add the parts: ${100 * h} + ${10 * t} + ${o} = ${answer}.`,
        `The model shows ${answer}.`,
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
      hint = t
        ? `${n} has the digit ${t} in the tens place. The box needs the value of ${t} tens, not the digit.`
        : `Read the tens digit of ${n}, its middle digit. The box needs that many tens, as a value.`;
      explanation = [
        `Expanded form writes a number as the sum of its place values.`,
        `${n} has ${count(h, "hundred")}, ${count(t, "ten")} and ${count(o, "one")}.`,
        `The box sits in the tens spot, so it needs the value of ${count(t, "ten")}: ${t} × 10 = ${answer}.`,
        `Check: ${100 * h} + ${answer} + ${o} = ${n}. The box holds ${answer}.`,
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
      hint = tradeOnes
        ? `Ten of the ${o} ones become one new ten, which joins the tens. Trading never changes the total.`
        : `Ten of the ${t} tens become one new hundred, which joins the hundreds. Trading never changes the total.`;
      explanation = tradeOnes
        ? [
            `10 ones are worth the same as 1 ten, so a trade keeps the total the same.`,
            `Take 10 of the ${o} ones and swap them for 1 ten. ${count(o - 10, "one")} ${o - 10 === 1 ? "stays" : "stay"}.`,
            `The new ten joins the ${count(t, "ten")}: ${t} + 1 = ${answer}.`,
            `The total is still ${100 * h + 10 * t + o}, and there will be ${count(answer, "ten")}.`,
          ]
        : [
            `10 tens are worth the same as 1 hundred, so a trade keeps the total the same.`,
            `Take 10 of the ${t} tens and swap them for 1 hundred. ${count(t - 10, "ten")} ${t - 10 === 1 ? "stays" : "stay"}.`,
            `The new hundred joins the ${count(h, "hundred")}: ${h} + 1 = ${answer}.`,
            `The total is still ${100 * h + 10 * t + o}, and there will be ${count(answer, "hundred")}.`,
          ];
      break;
    }
    case "add-several-two-digit": {
      const values = Array.from({ length: r(3, 4) }, () => r(10, 59)),
        tens = values.reduce((s, v) => s + Math.floor(v / 10), 0),
        ones = values.reduce((s, v) => s + (v % 10), 0);
      prompt = `Find the total: ${values.join(" + ")}.`;
      answer = values.reduce((s, v) => s + v, 0);
      hint = `Add the tens, ${values.map((v) => v - (v % 10)).join(" + ")}, and the ones, ${values.map((v) => v % 10).join(" + ")}, separately. Then combine them.`;
      explanation = [
        `Add tens with tens and ones with ones, so each place stays separate.`,
        `Tens: ${values.map((v) => v - (v % 10)).join(" + ")} = ${tens * 10}.`,
        `Ones: ${values.map((v) => v % 10).join(" + ")} = ${ones}.`,
        `Put the parts together: ${tens * 10} + ${ones} = ${answer}.`,
        `The total is ${answer}.`,
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
      hint = `Start with the ones: ${a % 10} + ${b % 10} is more than 9, so trade 10 of those ones for 1 ten.`;
      explanation = [
        `Add one place at a time, starting with the ones. A place can hold at most 9.`,
        `Ones: ${a % 10} + ${b % 10} = ${o}. That is too many, so keep ${count(o - 10, "one")} and trade 10 ones for 1 ten.`,
        `Tens: ${Math.floor(a / 10) % 10} + ${Math.floor(b / 10) % 10} + 1 traded ten = ${t}. ${t >= 10 ? `Keep ${count(t - 10, "ten")} and trade 10 tens for 1 hundred.` : `That fits, so keep ${count(t, "ten")}.`}`,
        `Hundreds: ${Math.floor(a / 100)} + ${Math.floor(b / 100)}${t >= 10 ? " + 1 traded hundred" : ""} = ${h + (t >= 10 ? 1 : 0)}.`,
        `The sum is ${answer}.`,
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
      explanation.push(
        `Subtract one place at a time, starting with the ones. Trade from the next place when a place is too small.`,
      );
      const tradedHundred = tt === 0;
      if (tt === 0) {
        hh--;
        tt = 10;
        explanation.push(
          `You cannot take ${count(b % 10, "one")} from ${count(o, "one")}, and there are no tens to trade. So first trade 1 hundred for 10 tens: now ${count(hh, "hundred")} and ${count(tt, "ten")}.`,
        );
      }
      tt--;
      oo += 10;
      explanation.push(
        tradedHundred
          ? `Now trade 1 of those tens for 10 ones. That leaves ${count(tt, "ten")} and ${count(oo, "one")}.`
          : `You cannot take ${count(b % 10, "one")} from ${count(o, "one")}, so trade 1 ten for 10 ones. Now there ${isAre(tt)} ${count(tt, "ten")} and ${count(oo, "one")}.`,
      );
      if (tt < Math.floor(b / 10) % 10) {
        hh--;
        tt += 10;
        explanation.push(
          `You cannot take ${count(Math.floor(b / 10) % 10, "ten")} from ${count(tt - 10, "ten")}, so trade 1 hundred for 10 tens. Now there ${isAre(hh)} ${count(hh, "hundred")} and ${count(tt, "ten")}.`,
        );
      }
      explanation.push(
        `Ones: ${oo} − ${b % 10} = ${oo - (b % 10)}. Tens: ${tt} − ${Math.floor(b / 10) % 10} = ${tt - (Math.floor(b / 10) % 10)}. Hundreds: ${hh} − ${Math.floor(b / 100)} = ${hh - Math.floor(b / 100)}.`,
        `The difference is ${answer}. Check: ${answer} + ${b} = ${a}.`,
      );
      hint = t
        ? `The ones are ${o} − ${b % 10}: not enough ones. Trade 1 of the ${t} tens in ${a} for 10 ones.`
        : `The ones are ${o} − ${b % 10}: not enough ones, and ${a} has no tens to trade. First trade 1 hundred for 10 tens.`;
      break;
    }
    case "skip-count-missing": {
      const step = [5, 10, 100][r(0, 2)]!,
        start = r(0, Math.floor((1000 - 3 * step) / step)) * step;
      prompt = `Count by ${step}: ${start}, ${start + step}, ${start + 2 * step}, □. What comes next?`;
      answer = start + 3 * step;
      hint = `Each number is ${step} more than the one before: ${start} + ${step} is ${start + step}. Go up ${step} more from ${start + 2 * step}.`;
      explanation = [
        `Counting by ${step} means each number is ${step} more than the one before.`,
        `Check the pattern: ${start} + ${step} = ${start + step}, and ${start + step} + ${step} = ${start + 2 * step}.`,
        `So add ${step} once more: ${start + 2 * step} + ${step} = ${answer}.`,
        `The next number is ${answer}.`,
      ];
      break;
    }
    case "continue-count-to-120": {
      const start = r(0, 117);
      prompt = `Count on by ones: ${start}, ${start + 1}, ${start + 2}, □. What comes next?`;
      answer = start + 3;
      const last = start + 2;
      hint =
        last % 10 === 9
          ? `${last} ends in 9, so one more starts a new ${(last + 1) % 100 ? "ten" : "hundred"}: the ones digit becomes 0.`
          : `Each number is one more than the one before. Say the number after ${last}.`;
      explanation = [
        `Counting on by ones means each number is 1 more than the one before.`,
        last % 10 === 9
          ? `${last} ends in 9, so 1 more fills the ones place and starts a new ${(last + 1) % 100 ? "ten" : "hundred"}: the ones digit becomes 0.`
          : `Only the ones digit changes: it goes up by 1.`,
        `${last} + 1 = ${answer}, so the next number is ${answer}.`,
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
