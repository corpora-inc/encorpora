import { withArticle } from "./agreement";
import { count, nounFor, term } from "./agreement";
import {
  choice,
  clean,
  figures,
  fraction,
  fracTex,
  line,
  math,
  multi,
  numeric,
  parts,
  pick,
  show,
  type Item,
  type Rng,
} from "./number-geometry-clause-kit";
import { numberLine, scene } from "./scene/author";
import type { Element } from "./scene/spec";

const zeroContexts = [
  [
    "A submarine",
    "meters",
    "Positive positions are above sea level; negative positions are below sea level.",
    "sea level",
    "the ocean floor",
    "having no depth",
    "the submarine's starting position",
  ],
  [
    "A thermometer",
    "°C",
    "Positive temperatures are above water's freezing point; negative temperatures are below it.",
    "water's freezing point",
    "the coldest possible temperature",
    "having no temperature",
    "the day's starting temperature",
  ],
  [
    "An account",
    "dollars",
    "Positive balances are money available; negative balances are money owed.",
    "no money available and no debt",
    "the greatest possible debt",
    "having no bank account",
    "the opening deposit",
  ],
  [
    "A football play",
    "yards",
    "Positive positions are ahead of the line of scrimmage; negative positions are behind it.",
    "the line of scrimmage",
    "the end of the field",
    "having no football field",
    "the player's starting position on the sideline",
  ],
  [
    "An elevator",
    "floors",
    "Positive floors are above the ground floor; negative floors are below it.",
    "the ground floor",
    "the lowest basement",
    "having no elevator",
    "the floor where the passenger entered",
  ],
  [
    "A rocket countdown",
    "seconds",
    "Positive times are after launch; negative times are before launch.",
    "the instant of launch",
    "the earliest recorded time",
    "having no clock",
    "the instant the countdown began",
  ],
  [
    "A golf score",
    "strokes relative to par",
    "Positive scores are above par; negative scores are below par.",
    "a score equal to par",
    "the lowest possible score",
    "no strokes played",
    "the score before the round",
  ],
  [
    "An object's net charge",
    "charge units",
    "Positive values mean excess positive charge; negative values mean excess negative charge.",
    "equal amounts of positive and negative charge",
    "the most negative possible charge",
    "having no object",
    "the object's initial charge",
  ],
] as const;

function zeroMeaning(r: Rng): Item {
  const [subject, unit, convention, reference, ...wrong] = pick(
    r,
    zeroContexts,
  );
  const n = r(1, 40) * (r(0, 9) < 7 ? -1 : 1),
    both = r(0, 2) === 0;
  const unitOne: Record<string, string> = {
    meters: "meter",
    dollars: "dollar",
    yards: "yard",
    floors: "floor",
    seconds: "second",
    "charge units": "charge unit",
    "strokes relative to par": "stroke relative to par",
  };
  const amount = `${show(n)} ${unitOne[unit] ? nounFor(Math.abs(n), unitOne[unit]!) : unit}`;
  const intro = `${subject} has a recorded value of ${amount}. ${convention}`;
  const explanation = [
    `Zero represents ${reference}. The convention states the reference from which positive and negative values are measured.`,
    `${show(n)} is ${count(Math.abs(n), "unit")} on the ${n < 0 ? "negative" : "positive"} side of that reference. Zero is a reference value, not the absence of the object.`,
  ];
  return {
    prompt: `${intro} ${both ? "Choose the signed value and the meaning of 0." : "What does 0 represent?"}`,
    ...(both
      ? parts(r, [
          { label: "Signed value", correct: show(n), wrong: [show(-n), "0"] },
          { label: "Meaning of 0", correct: reference, wrong: [...wrong] },
        ])
      : choice(r, reference, [...wrong])),
    hint: `Use the positive and negative convention to find the dividing reference for ${amount}.`,
    explanation,
  };
}
function opposite(r: Rng): Item {
  const form = r(0, 2),
    why =
      "The opposite is the mirror image across 0. A point at the mirror stays in place, so $-0 = 0$.";
  return {
    prompt:
      form === 0
        ? "What is the opposite of the number at point $P$?"
        : form === 1
          ? "Which number is its own opposite?"
          : "Which statement about opposites is true?",
    ...(form === 0
      ? { ...numeric(0), figure: line([{ at: 0, label: "P" }]) }
      : form === 1
        ? choice(r, "0", ["−1", "1", "No number is its own opposite"])
        : choice(
            r,
            "0 is its own opposite: it is 0 units from 0 on both sides.",
            [
              "0 has no opposite.",
              "The opposite of 0 is −0, a different number.",
              "1 and −1 are each their own opposite.",
            ],
          )),
    hint: "Reflect the point across 0. Consider what happens to a point on the mirror itself.",
    explanation: [why],
  };
}
function position(r: Rng): Item {
  const d = pick(r, [1, 2, 4, 10]);
  let a = -r(2, 90) / 10,
    b = -r(2, 90) / 10;
  a = -r(1, 9 * d) / d;
  b = r(0, 9) < 3 ? r(1, 9 * d) / d : -r(1, 9 * d) / d;
  if (a === b) b = clean(a + 1 / d);
  const right = a > b,
    form = r(0, 1),
    sign = right ? ">" : "<",
    opposite = right ? "<" : ">";
  const equation = `${show(a)} ${sign} ${show(b)}`;
  const response =
    form === 0
      ? choice(
          r,
          `${show(a)} is to the ${right ? "right" : "left"} of ${show(b)}.`,
          [
            `${show(a)} is to the ${right ? "left" : "right"} of ${show(b)}.`,
            `${show(a)} and ${show(b)} occupy the same point.`,
            "The sign of each number has no effect on its position.",
          ],
        )
      : choice(r, math(equation), [
          math(`${show(a)} ${opposite} ${show(b)}`),
          math(`${show(a)} = ${show(b)}`),
          math(`${show(b)} ${sign} ${show(a)}`),
        ]);
  return {
    prompt:
      form === 0
        ? `On a number line increasing to the right, what does $${equation}$ say about the positions?`
        : `Point $A$ is at ${show(a)} and point $B$ at ${show(b)}. Which inequality describes their positions?`,
    ...response,
    figure: line(
      [
        { at: a, label: "A" },
        { at: b, label: "B" },
      ],
      1 / d,
    ),
    hint: `Locate ${show(a)} and ${show(b)}. Greater numbers lie farther right.`,
    explanation: [
      `From left to right the numbers are ${show(Math.min(a, b))}, then ${show(Math.max(a, b))}.`,
      `So $${equation}$. Position, not distance from zero, determines this order.`,
    ],
  };
}
function distance(r: Rng, variant: string): Item {
  if (variant === "absolute-distance") {
    if (r(0, 1) === 0) {
      const p =
        (r(0, 9) < 7 ? -1 : 1) * pick(r, [1.25, 2.5, 3.75, 4.5, 6.25, 8.5]);
      return {
        prompt: "What is the absolute value of the number at point $P$?",
        figure: line([{ at: p, label: "P" }], 0.25),
        ...numeric(Math.abs(p)),
        hint: `Absolute value measures distance from 0. Count the units between ${show(p)} and 0.`,
        explanation: [
          `The bars mean distance from zero: $|${show(p)}| = ${Math.abs(p)}$.`,
          `Distance is nonnegative, regardless of which side contains the point.`,
        ],
      };
    }
    const k = pick(r, [3, 4.5, 6, 7.5]),
      values = [-k, k, -k + 2, k - 1];
    return {
      prompt: `Select every point whose number has absolute value ${k}.`,
      figure: line(
        values.map((at, i) => ({ at, label: String.fromCharCode(65 + i) })),
        0.5,
      ),
      ...multi(r, ["Point $A$", "Point $B$", "Point $C$", "Point $D$"], [0, 1]),
      hint: `Find points ${k} units from 0, checking both directions.`,
      explanation: [
        `Both ${show(-k)} and ${k} are ${k} units from 0. Select points $A$ and $B$.`,
        `The other distances are ${Math.abs(values[2]!)} and ${values[3]}, not ${k}.`,
      ],
    };
  }
  const a = -pick(r, [1.25, 2.5, 3.75, 4.5, 6.25]),
    b =
      r(0, 9) < 7 ? pick(r, [1.5, 2.5, 4, 5.75]) : -pick(r, [0.25, 0.5, 0.75]);
  const value = clean(b - a),
    formula = r(0, 1) === 0;
  return {
    prompt: formula
      ? `Points $A$ and $B$ are at ${show(a)} and ${show(b)}. Select the two expressions giving their distance.`
      : `How far apart are ${show(a)} and ${show(b)} on the number line?`,
    ...(formula
      ? multi(
          r,
          [
            math(`|${a}-${term(b)}|`),
            math(`|${b}-${term(a)}|`),
            math(`-|${a}-${term(b)}|`),
            math(`|${a}+${b}|`),
          ],
          [0, 1],
        )
      : numeric(value)),
    ...(formula
      ? {
          figure: line(
            [
              { at: a, label: "A" },
              { at: b, label: "B" },
            ],
            0.25,
          ),
        }
      : {}),
    hint: `Subtract one endpoint from the other, then take the nonnegative distance. Start with ${show(b)} minus ${show(a)}.`,
    explanation: [
      `The distance is $|${b}-${term(a)}| = |${value}| = ${value}$.`,
      `Reversing the subtraction gives $|${a}-${term(b)}| = |${-value}| = ${value}$. Either order inside the absolute-value bars gives the same distance.`,
    ],
  };
}
function contextOrder(r: Rng): Item {
  const context = r(0, 4),
    step = context === 0 ? 1 : pick(r, [1, 0.5, 0.25]);
  const a = -r(1, 8) * step,
    b = a - r(1, 8) * step;
  const bank = [
    [
      `Monday's temperature was ${show(a)}°C and Tuesday's was ${show(b)}°C. Monday was warmer.`,
      `${show(a)}°C is warmer than ${show(b)}°C.`,
      "colder",
    ],
    [
      `Two elevations are ${show(a)} m and ${show(b)} m. The first is higher.`,
      `${show(a)} m is higher than ${show(b)} m.`,
      "lower",
    ],
    [
      `Account A has ${show(a)} dollars and account B has ${show(b)} dollars. Account A has the greater balance.`,
      `${show(a)} dollars is a greater balance than ${show(b)} dollars.`,
      "smaller",
    ],
    [
      `Two golf scores relative to par are ${show(a)} and ${show(b)}. The first is greater.`,
      `${show(a)} is a greater score than ${show(b)}.`,
      "smaller",
    ],
    [
      `Two times relative to launch are ${show(a)} s and ${show(b)} s. The first is later.`,
      `${show(a)} s is later than ${show(b)} s.`,
      "earlier",
    ],
  ] as const;
  const [story, statement] = bank[context]!,
    reverse = r(0, 1) === 0;
  return {
    prompt: reverse
      ? `Which statement does $${a} > ${b}$ express in this situation? ${story.split(". ")[0]}.`
      : `${story} Which inequality expresses this fact?`,
    ...(reverse
      ? choice(r, statement, [
          "The first quantity is above 0.",
          `The first quantity is ${bank[context]![2]} than the second.`,
          "Both quantities are positive.",
        ])
      : choice(r, math(`${a}>${b}`), [
          math(`${a}<${b}`),
          math(`${b}>${a}`),
          math(`|${a}|>|${b}|`),
        ])),
    figure:
      context === 0
        ? {
            kind: "scene",
            scene: scene(
              {
                type: "thermometer",
                min: -20,
                max: 5,
                minor: 1,
                major: 5,
                reading: a,
                unit: "C",
                label: "Monday",
              },
              {
                type: "thermometer",
                at: [8, 0],
                min: -20,
                max: 5,
                minor: 1,
                major: 5,
                reading: b,
                unit: "C",
                label: "Tuesday",
              },
            ).build(),
          }
        : line(
            [
              { at: a, label: "A" },
              { at: b, label: "B" },
            ],
            step,
          ),
    hint: `Order ${show(a)} and ${show(b)} on the scale. A greater number lies farther right or higher.`,
    explanation: [
      `${show(a)} is to the right of ${show(b)}, so $${a}>${b}$.`,
      statement,
      "The absolute values compare distances from the reference, not the signed quantities.",
    ],
  };
}
function story(r: Rng, variant: string): Item {
  if (variant === "estimate-check" && r(0, 1) === 0) {
    const door = r(24, 35) + 0.5,
      bar = r(6, 13) + 0.75,
      estimate = (Math.round(door) - Math.round(bar)) / 2,
      value = (door - bar) / 2;
    const options = [
      `(${Math.round(door)} − ${Math.round(bar)}) ÷ 2 = ${estimate}`,
      `${Math.round(door)} − ${Math.round(bar)} = ${2 * estimate}`,
      `${Math.round(door)} ÷ 2 = ${Math.round(door) / 2}`,
      `(${Math.round(door)} + ${Math.round(bar)}) ÷ 2 = ${(Math.round(door) + Math.round(bar)) / 2}`,
    ];
    const order = pick(r, [
        [0, 1, 2, 3],
        [1, 2, 3, 0],
        [2, 3, 0, 1],
        [3, 0, 1, 2],
      ]),
      bank = order.map((j, i) => ({
        id: String.fromCharCode(97 + i),
        label: options[j]!,
      })),
      answerId = bank[order.indexOf(0)]!.id;
    return {
      prompt: `A $${fracTex(bar * 4, 4)}$-inch towel bar is centered on a $${fracTex(door * 2, 2)}$-inch door. Choose an estimate for the gap at each edge, then find the exact gap in inches.`,
      response: {
        kind: "structured-work",
        layout: "steps",
        mode: "build",
        label: "Estimate and exact gap",
        banks: [{ id: "estimate", label: "Estimate", options: bank }],
        rows: [
          {
            id: "r1",
            label: "Estimate the gap",
            fields: [{ kind: "choice", label: "Estimate", bank: "estimate" }],
          },
          {
            id: "r2",
            label: "Exact gap at each edge",
            fields: [{ kind: "number", label: "Gap", unit: "inches" }],
          },
        ],
      },
      answer: JSON.stringify([[answerId], [String(value)]]),
      workGrading: {
        mode: "fields",
        fields: [
          [{ kind: "choice", accept: [answerId] }],
          [{ kind: "number", value: String(value) }],
        ],
      },
      hint: `The door is ${door} inches wide. Subtract the bar's width before splitting the leftover equally between two edges.`,
      explanation: [
        `Round the widths: $(${Math.round(door)}-${Math.round(bar)})\\div2 = ${estimate}$ inches.`,
        `Exactly, $(${door}-${bar})\\div2 = ${value}$ inches. This is close to the estimate. The estimate checks the answer; it does not replace it.`,
      ],
    };
  }
  const den = pick(r, [2, 4, 5, 8]),
    n = r(2, 14) * den + r(1, den - 1),
    start = -n / den,
    rise = r(11, 39) / 10,
    fall = pick(r, [0.5, 1.25, 1.5, 2.5]),
    hours = r(2, 3),
    value = clean(start + rise - hours * fall);
  const text = `At dawn the temperature was $-${fracTex(n, den)}$°C. It rose ${rise}°C, then fell $${fracTex(fall * 4, 4)}$°C each hour for ${hours} hours.`;
  if (variant === "mixed-forms")
    return {
      prompt: `${text} What was the final temperature in °C? Give a decimal or exact fraction.`,
      ...numeric(value),
      hint: `Rename $-${fracTex(n, den)}$ as a decimal. The fall of ${fall}°C happens ${hours} times.`,
      explanation: [
        `Use one form: the starting temperature is ${show(start)}°C, and each fall is ${fall}°C.`,
        `The total fall is $${hours}\\times${fall}=${hours * fall}$.`,
        `The result is $${start}+${rise}-${hours * fall}=${value}$°C.`,
      ],
    };
  const s = Math.round(start),
    up = Math.round(rise),
    down = Math.round(hours * fall),
    estimate = s + up - down;
  const claimed = clean(-start + rise + hours * fall);
  return {
    prompt: `${text} Lena claims the answer is ${claimed}°C. Which estimate checks her answer?`,
    ...choice(
      r,
      `${s} + ${up} − ${down} = ${estimate}; ${claimed}°C is not reasonable.`,
      [
        `${-s} + ${up} + ${down} = ${-s + up + down}; the positive claim is reasonable.`,
        `${s} + ${up} = ${s + up}; ignore the repeated fall.`,
        `${s} − ${up} − ${down} = ${s - up - down}; treat the rise as a fall.`,
      ],
    ),
    hint: `Round the starting value ${show(start)}, the rise ${rise}, and the entire ${hours}-hour fall, keeping their signs.`,
    explanation: [
      `Round the starting temperature to ${s}, the rise to ${up}, and the total fall to ${down}.`,
      `The estimate is $${s}+${up}-${down}=${estimate}$°C. The claimed ${claimed}°C has all changes added as positive amounts.`,
      `Exactly, $${start}+${rise}-${hours * fall}=${value}$°C.`,
    ],
  };
}
function jumps(r: Rng): Item {
  const vertical = r(0, 3) === 0,
    d = vertical ? 1 : pick(r, [1, 2]);
  let p: number, q: number;
  do {
    p = r(-10 * d, 10 * d) / d;
    q = r(-10 * d, 10 * d) / d;
  } while (!p || !q || p === q || p === 2 * q || p === -q || p === -2 * q);
  const subtract = r(0, 1) === 1,
    walk = subtract ? -q : q;
  const starts = [p, p, p, -p],
    ends = [p + walk, p - walk, walk, -p + walk];
  const min = Math.floor(Math.min(0, ...starts, ...ends)) - 1,
    max = Math.ceil(Math.max(0, ...starts, ...ends)) + 1;
  const options = ends.map((end, i) => {
    const start = starts[i]!;
    const elements: Element[] = [
      { type: "segment", from: [0, min], to: [0, max], arrow: "both" },
      ...Array.from({ length: max - min + 1 }, (_, j) => ({
        type: "text" as const,
        at: [-1, min + j] as [number, number],
        text: String(min + j),
      })),
      { type: "point", at: [0, start] },
      { type: "arrow", from: [0.5, start], to: [0.5, end], stroke: "accent" },
    ];
    return {
      label: `${withArticle(vertical ? "vertical" : "horizontal", true)} number line: start ${show(start)}, arrow ends at ${show(end)}.`,
      scene: vertical
        ? scene(...elements).build({ width: 260, maxHeight: 290 })
        : numberLine({
            min,
            max,
            step: 1 / d,
            marks: [
              { at: start, label: true },
              { at: end, label: true },
            ],
            hops: [
              { from: start, by: end - start, landing: "shown", label: false },
            ],
          }).scene({ width: 260, maxHeight: 240 }),
    };
  });
  return {
    prompt: vertical
      ? `Which vertical number line shows a temperature of ${show(p)}°C ${walk > 0 ? "rising" : "falling"} ${Math.abs(walk)}°C?`
      : `Which number line represents $${p} ${subtract ? "-" : "+"}${term(q)}$?`,
    ...figures(r, options[0]!, options.slice(1)),
    hint: `Start at ${show(p)}. ${subtract ? "Subtracting reverses the second number's direction." : "The second number tells the signed change."}`,
    explanation: [
      `Start at ${show(p)} and move ${count(Math.abs(walk), "unit")} ${vertical ? (walk > 0 ? "up" : "down") : walk > 0 ? "right" : "left"}.`,
      `The endpoint is $${p}+${term(walk)}=${clean(p + walk)}$. The initial position and the change have different jobs.`,
    ],
  };
}
function changes(r: Rng, variant: string): Item {
  if (variant === "make-zero") {
    const k = r(10, 30);
    if (r(0, 1)) {
      const values = [k, -k, -6, -6, 7, -8];
      return {
        prompt: "Select the two changes in the table that combine to make 0.",
        figure: {
          kind: "scene",
          scene: scene({
            type: "table",
            columns: ["Signed amount"],
            rows: values.map((v, i) => ({
              label: String.fromCharCode(65 + i),
              cells: [show(v)],
            })),
          }).build(),
        },
        ...multi(
          r,
          values.map(
            (v, i) => `Change $${String.fromCharCode(65 + i)}$: ${show(v)}`,
          ),
          [0, 1],
        ),
        hint: `To make 0, look for equal sizes with opposite signs. Find the partner of ${k}.`,
        explanation: [
          `The changes $${k}+(-${k})=0$.`,
          `Two changes of −6 total −12; 7 and −8 total −1. Neither pair cancels.`,
        ],
      };
    }
    const object = pick(r, ["A diver", "An elevator"]);
    return {
      prompt:
        "Which situation describes opposite quantities combining to make 0?",
      ...choice(r, `${object} descends ${k} m, then rises ${k} m.`, [
        `${object} descends ${k} m, then descends ${k} m more.`,
        `${object} descends ${k} m, then rises ${k - 2} m.`,
        `${object} rises ${k} m twice.`,
      ]),
      hint: `A net change of 0 means returning to the starting position. Compare both distances with ${k} m and check their directions.`,
      explanation: [
        `The downward change is −${k} m and the upward change is ${k} m. Their sum is 0.`,
        `The other net changes are ${-2 * k}, −2 and ${2 * k} meters.`,
      ],
    };
  }
  const a = r(11, 29),
    b = r(21, 29) + pick(r, [0, 0.25, 0.5]),
    c = Math.ceil(b / 10) * 10 - b,
    total = b + c;
  const labels = [
    `(${-a} + ${a}) + (${b} + ${c}) = ${total}`,
    `(${a} + ${a}) + (${b} + ${c}) = ${2 * a + total}`,
    `(${-a} + ${b}) − (${a} + ${c}) = ${clean(b - c - 2 * a)}`,
    `(${-a} + ${a}) + (${b} − ${c}) = ${clean(b - c)}`,
  ];
  return {
    prompt: `Find $${-a}+${b}+${a}+${c}$. Which regrouping keeps its value and makes mental addition easy?`,
    ...choice(r, labels[0]!, labels.slice(1)),
    hint: `Look for the opposite of ${-a}, then pair the other two numbers. Keep each number's sign.`,
    explanation: [
      `Reorder and regroup without changing signs: $(${-a}+${a})+(${b}+${c})=0+${total}=${total}$.`,
      `Reordering is the commutative property; regrouping is the associative property of addition.`,
    ],
  };
}
function inverse(r: Rng, fractional: boolean): Item {
  const d = fractional ? pick(r, [2, 3, 4, 5, 8, 10, 12]) : 1,
    n = r(1, 60),
    negative = r(0, 1) ? n : -n,
    form = r(0, 2),
    decimal = fractional && [2, 4, 5, 10].includes(d) && r(0, 1) === 0,
    t = decimal ? String(negative / d) : fracTex(negative, d),
    opp = decimal ? String(-negative / d) : fracTex(-negative, d);
  return {
    prompt:
      form === 0
        ? `What is $${t}+${term(opp)}$?`
        : form === 1
          ? `What number must be added to $${t}$ to get 0?`
          : "Which sum equals 0?",
    ...(form === 2
      ? choice(r, math(`${t}+${term(opp)}`), [
          math(`${t}+${term(t)}`),
          math(`${opp}+${term(opp)}`),
          math(`${t}+0`),
        ])
      : numeric(form === 0 ? 0 : fraction(-negative, d))),
    hint: `${form === 2 ? "A sum of 0 requires equal sizes and opposite signs. " : ""}${fractional ? `Keep the size of $${t}$ and reverse its sign. For a fraction, the denominator stays the same.` : `Opposites have equal sizes and opposite signs. Find the opposite of $${t}$.`}`,
    explanation: [
      `The opposite of $${t}$ is $${opp}$.`,
      `Together, $${t}+${term(opp)}=0$. These numbers are called additive inverses because their sum is 0.`,
    ],
  };
}
function rewrite(r: Rng): Item {
  const d = pick(r, [1, 2, 3, 4, 5, 8, 10]),
    pn = r(2, 19) * (r(0, 1) ? 1 : -1),
    fractionForm = d === 3 || r(0, 1) === 0;
  let qn = r(1, 18) * (r(0, 2) < 2 ? -1 : 1);
  while (Math.abs(qn) === Math.abs(pn)) qn = r(1, 18) * (r(0, 2) < 2 ? -1 : 1);
  const text = (n: number) => (fractionForm ? fracTex(n, d) : String(n / d));
  const p = text(pn),
    q = text(qn),
    np = text(-pn),
    nq = text(-qn);
  const reverse = r(0, 1) === 0;
  const correct = reverse ? `${p}-${term(nq)}` : `${p}+${term(nq)}`;
  const wrong = reverse
    ? [`${p}-${term(q)}`, `${np}-${term(nq)}`, `${nq}-${term(p)}`]
    : [`${p}+${term(q)}`, `${np}+${term(nq)}`, `${np}+${term(q)}`];
  return {
    prompt: reverse
      ? `Which subtraction expression has the same value as $${p}+${term(q)}$?`
      : `Which addition expression has the same value as $${p}-${term(q)}$?`,
    ...choice(r, math(correct), wrong.map(math)),
    hint: `Keep $${p}$ fixed. Changing between subtraction and addition reverses the sign of the second number, $${q}$.`,
    explanation: [
      `Subtracting a number means adding its opposite: $p-q=p+(-q)$.`,
      `Here, $${reverse ? `${p}+${term(q)}` : `${p}-${term(q)}`}=${correct}=${fracTex(reverse ? pn + qn : pn - qn, d)}$.`,
    ],
  };
}
function multiply(r: Rng, variant: string): Item {
  const a = r(2, 9),
    b = r(2, 9);
  if (variant === "undefined-divisor")
    return r(0, 1)
      ? {
          prompt: "Which expression is undefined?",
          ...choice(r, math(`${-a}\\div0`), [
            math(`0\\div(${-a})`),
            math(`(${-a})\\div(${-a})`),
            math(`${a}\\div1`),
          ]),
          hint: `Division asks for a missing factor. Which expression would require $0\\times ?=${-a}$?`,
          explanation: [
            `No number multiplied by 0 gives ${-a}, so dividing ${-a} by 0 is undefined.`,
            `Zero divided by a nonzero number is 0: $(${-a})\\times0=0$.`,
          ],
        }
      : {
          prompt: `What is $0\\div(${-a})$?`,
          ...numeric(0),
          hint: `Find the missing factor in $(${-a})\\times ?=0$.`,
          explanation: [
            `$(${-a})\\times0=0$, so $0\\div(${-a})=0$. The divisor is nonzero.`,
          ],
        };
  if (variant === "sign-rule") {
    const form = r(0, 2);
    return {
      prompt:
        form === 0
          ? `Continue the pattern: $3(-${b})=${-3 * b},\ 2(-${b})=${-2 * b},\ 1(-${b})=${-b},\ 0(-${b})=0$.`
          : form === 1
            ? `$(-${a})(-${b})+(-${a})(${b})=(-${a})(-${b}+${b})=0$, and $(-${a})(${b})=${-a * b}$. What must $(-${a})(-${b})$ equal?`
            : "Which line uses distribution to justify $(-1)(-1)=1$?",
      ...(form === 0
        ? parts(r, [
            {
              label: `$(-1)(-${b})$`,
              correct: String(b),
              wrong: [String(-b), "0"],
            },
            {
              label: `$(-2)(-${b})$`,
              correct: String(2 * b),
              wrong: [String(-2 * b), String(b)],
            },
          ])
        : form === 1
          ? numeric(a * b)
          : choice(
              r,
              "$(-1)(-1)+(-1)(1)=(-1)(0)=0$; the second product is −1, so the first is 1.",
              [
                "$(-1)(-1)=1$ because two minus signs disappear; no reason is needed.",
                "$(-1)(-1)=-1$ because the first factor is negative.",
                "$(-1)(-1)=0$ because opposite signs cancel.",
              ],
            )),
      hint:
        form === 0
          ? `Each step increases the product by ${b}. Continue the same change past 0.`
          : form === 1
            ? `The two products sum to 0. Find the opposite of ${-a * b}.`
            : "Distribute −1 over the sum −1 + 1, which equals 0.",
      explanation: [
        `Distribution keeps $(-${a})(-${b})+(-${a})(${b})=(-${a})(0)=0$.`,
        `Since the second product is ${-a * b}, the first must be ${a * b}. Two negative factors therefore have a positive product.`,
      ],
    };
  }
  const mode = r(0, 7),
    rate = b + pick(r, [0, 0.5]);
  if (mode >= 4 && mode < 6 && a === b) return multiply(r, variant);
  if (mode > 0 && mode < 4 && clean(a - rate) === clean(-rate / a))
    return multiply(r, variant);
  if (mode === 0) {
    const total = a * b;
    return {
      prompt: `Which situation is described by $(-${a})(-${b})=${total}$?`,
      ...choice(
        r,
        `${a} fees of ${b} dollars are cancelled; find the balance increase.`,
        [
          `${a} fees of ${b} dollars are charged; find the balance change.`,
          `${a} dollars are divided among ${b} people; find each share.`,
          `${a} dollars are deposited, then ${b} dollars withdrawn; find the change.`,
        ],
      ),
      hint: `A fee changes the balance by −${b}. Removing ${a} such changes reverses their total.`,
      explanation: [
        `${a} fees would change the balance by ${-total} dollars. Cancelling them changes it by ${total} dollars.`,
      ],
    };
  }
  if (mode < 4) {
    const total = clean(a * rate);
    return {
      prompt: `Which situation is described by $${a}\\times(-${rate})$?`,
      ...choice(
        r,
        `A tank drains ${rate} L per minute for ${a} minutes; find the total change.`,
        [
          `A tank fills ${rate} L per minute for ${a} minutes; find the total change.`,
          `A tank loses ${rate} L, then gains ${a} L; find the change.`,
          `A tank loses ${rate} L over ${a} minutes; find the change per minute.`,
        ],
      ),
      hint: `The factor ${a} counts equal changes; the rate is −${rate} liters per minute.`,
      explanation: [
        `There are ${a} copies of −${rate}: $${a}(-${rate})=${-total}$ L.`,
      ],
    };
  }
  const total = a * b,
    duration = mode >= 6;
  return {
    prompt: `Which situation is described by $(-${total})\\div(${duration ? -b : a})=${duration ? a : -b}$?`,
    ...choice(
      r,
      duration
        ? `The temperature fell ${total}° at ${b}° per hour; find the hours.`
        : `A debt of ${total} dollars is split among ${a} people; find each signed share.`,
      duration
        ? [
            `The temperature rises ${b}° each hour for ${total} hours; find the total change.`,
            `The temperature falls ${total}° each hour for ${b} hours; find the total change.`,
            `The temperature falls ${total}°, then another ${b}°; find the total change.`,
          ]
        : [
            `${a} people each owe ${total} dollars; find the total signed debt.`,
            `${total} dollars are shared among ${a} people; find each positive share.`,
            `A debt of ${total} dollars is split into debts of ${b} dollars; find the number of people.`,
          ],
    ),
    hint: `Division finds a missing factor: $${term(duration ? -b : a)}\\times ?=${-total}$.`,
    explanation: [
      `The matching situation requires $${-total}\\div(${duration ? -b : a})=${duration ? a : -b}$.`,
      duration
        ? "A negative rate times positive time gives a negative change."
        : "Each person's share is negative because it represents money owed.",
    ],
  };
}
function productStrategy(r: Rng): Item {
  const a = r(2, 12),
    b = r(2, 12),
    dec = pick(r, [0.1, 0.25, 0.5]);
  if (r(0, 1) === 0)
    return {
      prompt: `Which expression distributes over a sum to compute $(-${a})(${b + dec})$ with the same value?`,
      ...choice(r, math(`(-${a})(${b})+(-${a})(${dec})`), [
        math(`(-${a})(${b})+${dec}`),
        math(`(-${a})(${b})-(-${a})(${dec})`),
        math(`(-${a})(${b})\\times(-${a})(${dec})`),
      ]),
      hint: `Split ${b + dec} into ${b} + ${dec}. Multiply both parts by −${a}.`,
      explanation: [
        `$(-${a})(${b}+${dec})=(-${a})(${b})+(-${a})(${dec})=${clean(-a * (b + dec))}$.`,
        `Distribution multiplies each addend; the resulting products are added.`,
      ],
    };
  const n = pick(r, [2, 3, 4]),
    d = n + 1,
    k = r(2, 12),
    f = fracTex(n, d),
    inv = fracTex(d, n);
  return {
    prompt: `Which regrouping keeps the value of $(-${f})(${k})(-${inv})$ and makes the multiplication easy?`,
    ...choice(r, math(`((-${f})(-${inv}))\\times${k}=1\\times${k}`), [
      math(`(${f})(${inv})(-${k})`),
      math(`(-${f})+(-${inv})+${k}`),
      math(`((-${f})+(-${inv}))\\times${k}`),
    ]),
    hint: `Look for two factors whose product is 1. Keep both negative signs when moving $-${f}$.`,
    explanation: [
      `The two negative reciprocal factors multiply to 1: $(-${f})(-${inv})=1$.`,
      `Regrouping and reordering do not change a product. The value is $1\\times${k}=${k}$.`,
    ],
  };
}
export function signedClause(id: string, variant: string, r: Rng): Item {
  switch (id) {
    case "signed-quantity":
      return zeroMeaning(r);
    case "opposite-on-line":
      return opposite(r);
    case "number-line-distance":
      return distance(r, variant);
    case "signed-context-order":
      return variant === "position-inequality" ? position(r) : contextOrder(r);
    case "signed-story":
      return story(r, variant);
    case "signed-jumps":
      return jumps(r);
    case "signed-changes-sum":
      return changes(r, variant);
    case "integer-addition":
      return inverse(r, false);
    case "signed-fraction-sum":
      return variant === "additive-inverse" ? inverse(r, true) : rewrite(r);
    case "fl-integer-multiply-divide":
      return multiply(r, variant);
    case "signed-fraction-product":
      return productStrategy(r);
    default:
      throw new Error(`Unknown signed clause ${id}`);
  }
}
