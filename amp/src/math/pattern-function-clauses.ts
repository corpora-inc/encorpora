import {
  blanks,
  choice,
  curveScene,
  figures,
  math as m,
  pick,
  picture,
  plot,
  round,
  scene,
  type ClauseExtension,
  type ClauseSurface,
} from "./clause-kit";
import { f, graph } from "./scene/author";
import type { Fn, Point, Scene } from "./scene/spec";
import { count, term } from "./agreement";
import type { Random } from "./variation/axes";

const grid = (xMax = 10, yMax = 10, xLabel = "x", yLabel = "y") => ({
  xMin: 0,
  xMax,
  yMin: 0,
  yMax,
  step: 1,
  xLabel,
  yLabel,
});
const slot = (label: string, correct: string, ...wrong: string[]) => ({
  label,
  correct,
  wrong,
});
const ext = (
  variants: string[],
  build: ClauseExtension["build"],
  capability: ClauseExtension["capability"] = "single-choice-v1",
): ClauseExtension => ({ variants, build, capability });
const table = (
  columns: string[],
  rows: { label: string; cells: (string | number)[] }[],
) => picture(scene([{ type: "table", columns, rows }]));

function tableProperty(r: Random): ClauseSurface {
  const form = r(0, 3),
    n = r(1, 10),
    half = r(1, 4),
    even = 2 * half;
  const nearby = [
    Math.max(1, Math.min(8, n - 1)),
    Math.max(1, Math.min(8, n - 1)) + 1,
    Math.max(1, Math.min(8, n - 1)) + 2,
  ];
  if (form === 0)
    return blanks(
      r,
      `Every product in the row for ${even} is even. Complete the explanation for ${even} × ${n}.`,
      [
        slot(
          `Split ${even} × ${n}: first group`,
          m(`${half}\\times${n}`),
          m(`${even}\\times${n}`),
          m(`${half + 1}\\times${n}`),
        ),
        slot(
          "Second equal group",
          m(`${half}\\times${n}`),
          m(`${even}\\times${n}`),
          m(`${half + 1}\\times${n}`),
        ),
        slot(
          "Value of the first group",
          String(half * n),
          String(even * n),
          String(half * n + 1),
        ),
        slot(
          "Value of the second group",
          String(half * n),
          String(even * n),
          String(half * n + 1),
        ),
        slot("A number added to itself is always", "even", "odd"),
      ],
      [
        `${even} groups split into two equal groups of ${half}.`,
        `${even} × ${n} = ${half * n} + ${half * n} = ${even * n}. Two equal groups always make an even number.`,
        `The same split works for ${n + 1}: ${even} × ${n + 1} = ${half * (n + 1)} + ${half * (n + 1)}.`,
      ],
      `Split the ${even} groups into two equal groups.`,
      table(nearby.map(String), [
        {
          label: `× ${even}`,
          cells: nearby.map((x) => even * x),
        },
      ]),
    );
  if (form === 1) {
    const p = r(1, 5),
      q = r(1, 5),
      sum = p + q;
    return choice(
      r,
      `The row for ${sum} is the sum of the rows for ${p} and ${q}. For example, ${p} × ${n} + ${q} × ${n} = ${sum} × ${n}. Why does this work for every column?`,
      `${sum} equal groups are ${p} equal groups and ${q} more; the groups add.`,
      [
        `Because ${p} + ${q} = ${sum} and ${n} + ${n} = ${2 * n}.`,
        `Because ${p * n} + ${q * n} = ${sum * n}; checking this one column proves every column.`,
        `Because the table has 10 rows.`,
      ],
      [
        `For any column, split ${count(sum, "group")} into ${count(p, "group")} and ${count(q, "group")}. The size of each group stays the same.`,
        `This is the distributive property: $(p+q)n=pn+qn$.`,
      ],
      `In column ${n}, count groups of ${n}, not separate factors.`,
      table(
        nearby.map(String),
        [p, q, sum].map((x) => ({
          label: `× ${x}`,
          cells: nearby.map((column) => x * column),
        })),
      ),
    );
  }
  const a = r(2, 8),
    b = r(3, 8);
  return form === 2
    ? choice(
        r,
        `In an addition table, row ${a} and column ${a} hold the same numbers. Why?`,
        `Changing the order of two addends does not change their sum.`,
        [
          `Because ${a} + ${a} = ${2 * a}; one example proves the whole row.`,
          `Because ${a} is in the middle of the table.`,
          `Adding ${a} always gives an odd number.`,
        ],
        [
          `${a} + ${b} = ${b} + ${a}. The same two amounts are combined in either order.`,
          `This is the commutative property of addition.`,
        ],
        `Compare ${a} + ${b} with ${b} + ${a}.`,
        table(
          [String(a), String(b)],
          [
            { label: `+ ${a}`, cells: [2 * a, a + b] },
            { label: `+ ${b}`, cells: [a + b, 2 * b] },
          ],
        ),
      )
    : choice(
        r,
        `The addition-table entries ${a} + ${b}, ${a + 1} + ${b - 1}, ${a + 2} + ${b - 2} have the same sum. Why does this diagonal pattern continue?`,
        "One addend increases by 1 while the other decreases by 1, so the total stays unchanged.",
        [
          "Increasing either addend never changes a sum.",
          "Every diagonal of every table has equal entries.",
          "The entries have equal sums because their positions look alike.",
        ],
        [
          `Moving 1 from one addend to the other keeps the total ${a + b}.`,
          `This works while both entries stay inside the table.`,
        ],
        `Track what changes from ${a} + ${b} to ${a + 1} + ${b - 1}.`,
        table(
          ["First", "Second", "Sum"],
          [0, 1, 2].map((i) => ({
            label: String(i + 1),
            cells: [a + i, b - i, a + b],
          })),
        ),
      );
}

function featureWhy(r: Random): ClauseSurface {
  const start = r(1, 30),
    kind = r(0, 3),
    step = pick(
      r,
      kind === 0
        ? [3, 5, 7, 9]
        : kind === 1
          ? [2, 4, 6, 8]
          : kind === 2
            ? [10, 20, 50]
            : [5],
    );
  const terms = Array.from({ length: 7 }, (_, i) => start + step * i);
  const correct = [
    "Adding an odd number changes odd to even and even to odd, so the terms take turns.",
    "Adding an even number keeps the parity: odd stays odd and even stays even.",
    `${step} has 0 ones, so adding it never changes the ones digit.`,
    "Adding 5 twice adds 10, restoring the ones digit; one addition of 5 changes it.",
  ][kind]!;
  return choice(
    r,
    `Start at ${start} and add ${step}. The first five terms are ${terms.slice(0, 5).join(", ")}. Why ${kind === 0 ? "will odd and even continue to alternate" : kind === 1 ? "will every term keep the starting term's parity (odd or even)" : kind === 2 ? "will the ones digit stay the same" : "will the ones digit alternate between two digits"}?`,
    correct,
    [
      `Adding ${step} always makes the next term ${step % 2 ? "odd" : start % 2 ? "even" : "odd"}, whatever the starting number.`,
      `Checking ${start} + ${step} = ${start + step} proves the feature for every term.`,
      kind === 2
        ? `${step} ends in 0, so the first addition changes every starting ones digit to 0.`
        : "The first five terms show the feature, so no reason about the rule is needed.",
    ],
    [
      correct,
      `The next two terms are ${terms[5]} and ${terms[6]}.`,
      "An odd number has pairs and one leftover. Two leftovers make a pair; adding an even number adds only pairs.",
    ],
    `Apply the add-${step} rule to the fifth term, ${terms[4]}.`,
  );
}

function contextPlot(r: Random): ClauseSurface {
  if (r(0, 1) === 0) {
    const x = r(1, 10);
    let y = r(1, 9);
    if (y >= x) y++;
    return plot(
      `Plot the point showing that after ${count(x, "week")}, ${count(y, "dollar")} ${y === 1 ? "has" : "have"} been saved.`,
      [[x, y]],
      grid(10, 10, "Weeks", "Dollars saved"),
      [
        `Weeks go across: ${x}. Dollars go up: ${y}. The point is $(${x},${y})$.`,
        "The first coordinate names the horizontal quantity. Count gaps from the origin, not grid lines.",
      ],
      `Find ${x} on the Weeks axis first.`,
    );
  }
  const k = r(2, 3);
  return {
    ...plot(
      `Each box holds ${k} pencils. Plot the three rows of the table as (boxes, pencils).`,
      [1, 2, 3].map((x) => [x, k * x]),
      grid(10, 10, "Boxes", "Pencils"),
      [
        `The pairs are $(1,${k}), (2,${2 * k}), (3,${3 * k})$.`,
        "Boxes go across; pencils go up.",
      ],
      `Use ${k} pencils per box to find each height; the box count goes across.`,
    ),
    figure: table(
      ["Boxes", "Pencils"],
      [1, 2, 3].map((x) => ({ label: String(x), cells: [x, x * k] })),
    ),
  };
}
function pairPlot(r: Random): ClauseSurface {
  const ratio = r(2, 3),
    a = r(1, 2),
    start = a === 2 && ratio === 3 ? 0 : r(0, 1);
  const pts: Point[] = [0, 1, 2, 3].map((i) => [
    start + i * a,
    ratio * (start + i * a),
  ]);
  return plot(
    `Pattern A starts at ${start} and adds ${a}. Pattern B starts at ${ratio * start} and adds ${ratio * a}. Form the first four pairs (A, B), including the starting values, and plot them.`,
    pts,
    grid(10, 20, "Pattern A", "Pattern B"),
    [
      `The pairs are ${pts.map((p) => m(`(${p.join(",")})`)).join(", ")}.`,
      `Every value of Pattern B is ${ratio} times its paired value of Pattern A, so the points lie on the line through the origin with that rate.`,
      "Use the term of Pattern A as the horizontal coordinate, not the term's position.",
    ],
    `The first pair uses the starting values ${start} and ${ratio * start}.`,
  );
}
function whyMultiple(r: Random): ClauseSurface {
  const a = r(2, 9),
    ratio = r(2, 5),
    b = a * ratio;
  return choice(
    r,
    `Pattern A starts at 0 and adds ${a}. Pattern B starts at 0 and adds ${b}. Why is each B term ${ratio} times the matching A term?`,
    `Both start at 0 and take the same number of steps. Each step in Pattern B is ${ratio} times each step in Pattern A.`,
    [
      `Because ${b} − ${a} = ${b - a}.`,
      `Because ${3 * b} is ${ratio} times ${3 * a}; checking one pair proves every pair.`,
      "Because B's positive terms are bigger.",
    ],
    [
      `After any number $n$ of steps, the values are $${a}n$ and $${b}n=${ratio}(${a}n)$.`,
      "The multiplier applies to every step, so it applies to their totals.",
    ],
    `Compare one step of ${b} with one step of ${a}.`,
    table(
      ["A", "B"],
      [0, 1, 2, 3].map((i) => ({ label: String(i), cells: [i * a, i * b] })),
    ),
  );
}
function listGraph(r: Random): ClauseSurface {
  const plotting = r(0, 1) === 0,
    k = plotting ? r(2, 6) : pick(r, [2, 3, 5, 10, 20, 25, 30, 40, 50, 60]);
  const context = pick(r, ["distance", "pay", "cost"] as const);
  const nouns =
    context === "distance"
      ? ["Hours", "Miles", `A vehicle travels ${k} miles each hour. $d=${k}t$.`]
      : context === "pay"
        ? ["Hours", "Dollars", `A job pays ${k} dollars each hour. $d=${k}t$.`]
        : ["Tickets", "Dollars", `Each ticket costs ${k} dollars. $d=${k}t$.`];
  const explain = [
    `Multiply each input by ${k}: the pairs are $(1,${k}), (2,${2 * k}), (3,${3 * k})$.`,
    "The independent quantity goes across; the resulting amount goes up.",
  ];
  return plotting
    ? plot(
        `${nouns[2]} Plot the pairs for $t=1,2,3$.`,
        [1, 2, 3].map((t) => [t, k * t]),
        grid(5, 20, nouns[0], nouns[1]),
        explain,
        `At $t=1$, multiply 1 by the rate ${k}.`,
      )
    : blanks(
        r,
        `${nouns[2]} Complete the ordered pairs $(t,d)$ for $t=1,2,3$.`,
        [1, 2, 3].map((t) =>
          slot(
            `(${t}, __)`,
            String(t * k),
            String(k + t),
            String(k / 2),
            String(t * k + 1),
          ),
        ),
        explain,
        `At $t=1$, multiply 1 by the rate ${k}.`,
      );
}

function polyline(points: Point[], label = ""): Scene {
  const g = graph({
    x: [0, 12],
    y: [0, 12],
    grid: 2,
    tick: 2,
    axisNames: ["Minutes", "Liters"],
  }).element();
  return {
    v: 1,
    width: 260,
    maxHeight: 260,
    elements: [
      {
        ...g,
        segments: points.slice(1).map((to, i) => ({ from: points[i]!, to })),
      },
    ],
  };
}
function story(r: Random, variant: string): ClauseSurface {
  if (variant === "sketch-from-story") {
    const up = r(2, 4),
      flat = r(1, 3),
      down = r(1, 3),
      level = r(5, 10),
      end = up + flat + down;
    const pts: Point[] = [
      [0, 0],
      [up, level],
      [up + flat, level],
      [end, 0],
    ];
    return figures(
      r,
      `A tub starts empty, fills steadily for ${count(up, "minute")} to ${level} liters, stays there for ${count(flat, "minute")}, then drains steadily to empty in ${count(down, "minute")}. Choose its graph.`,
      [
        {
          label: `Rises to (${up}, ${level}), stays level to ${up + flat}, falls to (${end}, 0).`,
          scene: polyline(pts),
        },
        {
          label: `Rises to (${up}, ${level}), then stays at ${level} through minute ${end}.`,
          scene: polyline([pts[0]!, pts[1]!, pts[2]!, [end, level]]),
        },
        {
          label: `Rises to (${up}, ${up}), stays level, then falls to (${end}, 0).`,
          scene: polyline([
            [0, 0],
            [up, up],
            [up + flat, up],
            [end, 0],
          ]),
        },
        {
          label: `Starts at ${level}, falls to zero, stays empty, then rises to ${level}.`,
          scene: polyline([
            [0, level],
            [up, 0],
            [up + flat, 0],
            [end, level],
          ]),
        },
      ],
      [
        `The change points are ${pts.map((p) => m(`(${p})`)).join(", ")}.`,
        "Time accumulates horizontally. Filling rises, staying holds the height, and draining to empty ends at height 0.",
      ],
      `After ${up} minutes, the height must be ${level} liters.`,
    );
  }
  if (r(0, 2) === 0) {
    const a = pick(r, [-1, 1]);
    return figures(
      r,
      "Which graph shows a nonlinear function?",
      [
        {
          label: "A curved graph whose slope changes across its domain.",
          scene: curveScene(f.poly(a / 4, 0, 1)),
        },
        {
          label: "A straight increasing line through the origin.",
          scene: curveScene(f.poly(1, 0)),
        },
        {
          label: "A straight decreasing line with vertical intercept 2.",
          scene: curveScene(f.poly(-1, 2)),
        },
        {
          label: "A horizontal line at height 3.",
          scene: curveScene(f.poly(3)),
        },
      ],
      [
        "A nonlinear graph changes its rate. Straight lines, including horizontal lines, have a constant rate.",
        "Increasing and decreasing describe direction, not whether the rate is constant.",
      ],
      "Compare vertical changes over equal horizontal intervals, such as 0 to 1 and 1 to 2.",
    );
  }
  const curved = r(0, 2),
    asked = r(0, 2),
    sign = pick(r, [-1, 1]);
  const curves = [0, 1, 2].map((i) => ({
    fn:
      i === curved
        ? f.poly(sign, -4 * sign * i, sign * 4 * i * i + 4 * i + 1)
        : f.poly(sign, 4 * i + 1 - 2 * i * sign),
    domain: [2 * i, 2 * i + 2] as [number, number],
  }));
  // Join pieces continuously; a curved piece changes its slope inside its band.
  let y = sign > 0 ? 1 : 10;
  for (let i = 0; i < 3; i++) {
    curves[i]!.fn =
      i === curved
        ? f.poly(sign / 2, -2 * i * sign, y + 2 * i * i * sign)
        : f.poly(sign, y - 2 * i * sign);
    y += 2 * sign;
  }
  const graphScene = graph({
    x: [0, 6],
    y: [0, 12],
    grid: false,
    tick: 2,
  }).element();
  const isCurve = asked === curved;
  return choice(
    r,
    `The graph has parts $AB$, $BC$ and $CD$. From $${"ABC"[asked]}$ to $${"BCD"[asked]}$, is the function linear or nonlinear?`,
    isCurve
      ? "Nonlinear: its rate changes along the curved part."
      : "Linear: the straight segment changes at a steady rate.",
    [
      sign > 0
        ? "Linear, because it is increasing the whole time."
        : "Linear, because it is decreasing the whole time.",
      "Nonlinear, because it is not flat.",
      "Linear, because it is one smooth piece.",
    ],
    [
      isCurve
        ? "Equal horizontal steps along this curve produce different vertical changes."
        : "Equal horizontal steps along this straight segment produce equal vertical changes.",
      "Increasing or decreasing describes direction. Linear describes a constant rate.",
    ],
    `Compare equal time steps between $${"ABC"[asked]}$ and $${"BCD"[asked]}$.`,
    picture(
      scene([
        {
          ...graphScene,
          curves,
          points: [0, 1, 2, 3].map((i) => ({
            x: 2 * i,
            y: (sign > 0 ? 1 : 10) + 2 * i * sign,
            label: "ABCD"[i],
          })),
        },
      ]),
    ),
  );
}

function intersection(r: Random): ClauseSurface {
  const a = pick(r, [-5, -3, -2, 2, 3, 5]),
    b = pick(r, [-6, -4, -1, 1, 4, 5, 7]);
  if (r(0, 1))
    return choice(
      r,
      `Given $f(${a})=g(${a})=${b}$, which point lies on both graphs?`,
      m(`(${a},${b})`),
      [m(`(${b},${a})`), m(`(${a},0)`), m(`(0,${b})`)],
      [
        `At input ${a}, both outputs are ${b}, so both graphs contain $(${a},${b})$.`,
        "An ordered pair lists input first, output second.",
      ],
      `In $f(${a})=${b}$, identify the input first.`,
    );
  const g = graph({ x: [-6, 6], y: [-8, 8], grid: 1, tick: 2 })
    .curve(f.poly(1, b - a))
    .curve(f.vertex(-0.5, a, b), { color: "warm" })
    .point(a, b, `(${a}, ${b})`)
    .scene();
  return choice(
    r,
    `The graphs of $y=f(x)$ and $y=g(x)$ meet at $(${a},${b})$. Why is $x=${a}$ a solution of $f(x)=g(x)$?`,
    `Both graphs contain $(${a},${b})$, so $f(${a})=${b}$ and $g(${a})=${b}$.`,
    [
      `The solution is $y=${b}$ because it is the height of the crossing.`,
      `Both $f(${a})$ and $g(${a})$ are 0 because the graphs meet.`,
      `The graphs must have the same slope at $x=${a}$.`,
    ],
    [
      `The two outputs equal ${b} at the same input ${a}. That is what $f(x)=g(x)$ asks for.`,
      "A crossing need not be on an axis or have matching slopes.",
    ],
    `Read the height of each graph at $x=${a}$.`,
    picture(g),
  );
}

/** Monotone pairs on a continuous domain; bracket and midpoint are checked before rounding. */
function allFamilies(r: Random, count = false): ClauseSurface {
  const base = pick(r, [2, 3, 4]),
    family = r(0, count ? 1 : 5),
    c = pick(r, [3, 4, 5, 6]) + (family >= 3 ? 0.17 : 0),
    log = family === 0;
  const fn = [
    f.log(1, base),
    f.exp(1, base),
    f.rational([-1], [1, 0]),
    f.abs(2),
    f.poly(1, 0, 0),
    f.poly(2, 1),
  ][family]!;
  const fnText = [
    `\\log_{${base}}x`,
    `${base}^x`,
    "-1/x",
    "2|x|",
    "x^2",
    "2x+1",
  ][family]!;
  const value = (x: number) =>
    [
      () => Math.log(x) / Math.log(base),
      () => base ** x,
      () => -1 / x,
      () => 2 * Math.abs(x),
      () => x * x,
      () => 2 * x + 1,
    ][family]!();
  if (count)
    return choice(
      r,
      `How many real solutions does $${fnText}=${c}-x$ have? Use the graphs.`,
      "1",
      ["0", "2", "Infinitely many"],
      [
        log
          ? `On $x>0$, $\\log_{${base}}x$ increases continuously from arbitrarily negative to arbitrarily positive values. The line decreases.`
          : `The exponential $${base}^x$ increases continuously while the line decreases. Far to the left it is below the line; far to the right it is above.`,
        "Their difference increases continuously and changes sign, so they cross exactly once.",
      ],
      `Compare how $${fnText}$ and $${c}-x$ move as $x$ increases.`,
      picture(
        graph({ x: [-1, 8], y: [-5, 8], grid: 1, tick: 2 })
          .curve(fn)
          .curve(f.poly(-1, c), { color: "warm" })
          .scene(),
      ),
    );
  let lo = 0.01,
    hi = 8;
  for (let i = 0; i < 65; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) + mid - c < 0) lo = mid;
    else hi = mid;
  }
  const root = (lo + hi) / 2,
    lower = Math.floor(root * 10) / 10,
    upper = round(lower + 0.1),
    mid = round(lower + 0.05);
  // Avoid exact endpoint roots and near-midpoint ties, which a rounded table cannot resolve.
  if (
    Math.abs(value(mid) + mid - c) < 0.005 ||
    Math.abs(root - lower) < 1e-7 ||
    Math.abs(root - upper) < 1e-7
  )
    return allFamilies(r);
  const answer = Math.round(root * 10) / 10;
  return {
    prompt: `Let $f(x)=${fnText}$ and $g(x)=${c}-x$. Use the table and its halfway input to find the positive solution of $f(x)=g(x)$ to the nearest tenth.`,
    response: { kind: "number", label: "Solution to the nearest tenth" },
    answer: String(answer),
    hint: `Compare $f(x)-g(x)$ at ${lower}, ${mid} and ${upper}.`,
    explanation: [
      `The difference changes sign between ${lower} and ${upper}.`,
      `At the halfway input ${mid}, $f(x)-g(x)=${(value(mid) + mid - c).toFixed(3)}$. The root lies ${root < mid ? "below" : "above"} this midpoint, so it rounds to ${answer}.`,
    ],
    figure: table(
      ["x", "f(x)", "g(x)"],
      [lower, mid, upper].map((x, i) => ({
        label: String(i + 1),
        cells: [String(x), value(x).toFixed(3), (c - x).toFixed(3)],
      })),
    ),
  };
}

function buildModel(r: Random): ClauseSurface {
  const kind = r(0, 3),
    R = r(15, 25),
    E = 5 * r(10, 16),
    retention = pick(r, [0.8, 0.85, 0.9, 0.95]);
  if (kind < 2) {
    const rule = `${R}+${E}(${retention})^t`;
    return choice(
      r,
      kind === 0
        ? `A room is ${R} °C. Coffee starts ${E} °C hotter than the room. Each minute its temperature difference from the room shrinks by ${round(100 * (1 - retention))}%. Which function gives its temperature?`
        : `Coffee cools in a room according to $T(t)=${rule}$. What does the constant ${R} represent?`,
      kind === 0
        ? m(`T(t)=${rule}`)
        : "The room temperature, which the coffee temperature approaches.",
      kind === 0
        ? [
            m(`T(t)=${R + E}(${retention})^t`),
            m(`T(t)=${R}+${R + E}(${retention})^t`),
            m(`T(t)=${R}-${E}(${retention})^t`),
            m(`T(t)=${R + E}-${round(E * (1 - retention))}t`),
          ]
        : [
            "The starting coffee temperature.",
            "The degrees lost each minute.",
            "The number of minutes since pouring.",
          ],
      [
        `The constant ${R} is the room temperature. The changing excess is $${E}(${retention})^t$. Add them.`,
        `At $t=0$, $T(0)=${R}+${E}=${R + E}$. As time grows, the excess approaches 0.`,
      ],
      `Separate the room's ${R} degrees from the initial excess of ${E} degrees.`,
    );
  }
  const fixed = r(10, 40),
    unit = r(3, 9),
    price = unit + r(2, 8);
  return kind === 2
    ? choice(
        r,
        `A service charges a fixed ${fixed} dollars plus ${unit} dollars per item. Which function combines those costs for $n$ items?`,
        m(`C(n)=${fixed}+${unit}n`),
        [
          m(`C(n)=(${fixed}+${unit})n`),
          m(`C(n)=${fixed}n+${unit}`),
          m(`C(n)=${fixed}(${unit})^n`),
        ],
        [
          `The fixed charge ${fixed} is paid once. Add ${unit} for each of the $n$ items.`,
          `$C(0)=${fixed}$ checks the fixed part.`,
        ],
        `The ${fixed}-dollar charge does not depend on the item count.`,
      )
    : choice(
        r,
        `Selling $n$ items brings revenue $R(n)=${price}n$. Cost is $C(n)=${fixed}+${unit}n$. Which function gives profit?`,
        m(`P(n)=${price}n-(${fixed}+${unit}n)`),
        [
          m(`P(n)=${price}n+${fixed}+${unit}n`),
          m(`P(n)=${fixed}+${unit}n-${price}n`),
          m(`P(n)=${price * unit}n+${fixed}`),
        ],
        [
          "Profit is revenue minus cost, including the entire cost expression.",
          `$P(n)=${price - unit}n-${fixed}$.`,
        ],
        `Subtract the entire cost, including ${fixed}.`,
      );
}
function composeContext(r: Random): ClauseSurface {
  const h = 100 * r(1, 5),
    climb = 10 * r(2, 8),
    temp = r(10, 25),
    lapse = pick(r, [0.005, 0.006, 0.008, 0.01]),
    time = r(2, 9);
  const interpret = r(0, 1);
  return choice(
    r,
    `A balloon's height after $t$ minutes is $h(t)=${h}+${climb}t$ meters. Temperature at height $y$ meters is $T(y)=${temp}-${lapse}y$ °C. ${interpret ? `What does $T(h(${time}))$ mean?` : "Which expression gives temperature at the balloon after $t$ minutes?"}`,
    interpret
      ? `The temperature at the balloon ${time} minutes after launch.`
      : m(`T(h(t))=${temp}-${lapse}(${h}+${climb}t)`),
    interpret
      ? [
          `The temperature at a height of ${time} meters.`,
          `The height when the temperature is ${time} °C.`,
          `${time} times the temperature.`,
        ]
      : [
          m(`${h}+${climb}(${temp}-${lapse}t)`),
          m(`${temp}-${lapse}t`),
          m(`${temp}-${lapse}y+${h}+${climb}t`),
        ],
    [
      "First time determines height. Then height determines temperature: $t\\to h(t)\\to T(h(t))$.",
      `$h(${time})=${h + climb * time}$ and $T(h(${time}))=${temp}-${lapse}(${h + climb * time})=${round(temp - lapse * (h + climb * time))}$.`,
    ],
    `Feed the output of $h(t)=${h}+${climb}t$ into the temperature rule.`,
  );
}
function recursion(r: Random): ClauseSurface {
  let a = pick(r, [-10, -7, -3, 2, 6, 9]),
    d = pick(r, [-6, -4, -2, 3, 4, 5]);
  if (a === d) d++;
  return choice(
    r,
    `A sequence has $a_1=${a}$ and $a_n=a_{n-1}+${term(d)}$ for $n\\ge2$. Which explicit rule gives $a_n$?`,
    m(`a_n=${a}+${term(d)}(n-1)`),
    [
      m(`a_n=${a}+${term(d)}n`),
      m(`a_n=${d}+${term(a)}(n-1)`),
      m(`a_n=${a}(${d})^{n-1}`),
    ],
    [
      `From the first term to term $n$, there are $n-1$ additions of ${d}.`,
      `$a_2=${a + d}$ and $a_3=${a + 2 * d}$. The rule gives the same values.`,
      `Using $n$ additions would make $a_1=${a + d}$ instead of ${a}.`,
    ],
    `At $n=1$, the rule must return ${a} without taking a step.`,
  );
}
function parityGraph(r: Random): ClauseSurface {
  if (r(0, 3) === 0) {
    const a = pick(r, [-1, 1]);
    return figures(
      r,
      "Which graph shows an odd function?",
      [
        {
          label:
            "A cubic through the origin with opposite heights at opposite inputs.",
          scene: curveScene(f.poly(a / 8, 0, a / 2, 0)),
        },
        {
          label:
            "A parabola symmetric about the vertical axis with vertex at height 1.",
          scene: curveScene(f.poly(0.5, 0, 1)),
        },
        {
          label: "A cubic shifted upward with vertical intercept 2.",
          scene: curveScene(f.poly(a / 8, 0, 0, 2)),
        },
        {
          label:
            "A parabola through the origin with vertex at horizontal coordinate 1.",
          scene: curveScene(f.poly(1, -2, 0)),
        },
      ],
      [
        "An odd function obeys $f(-x)=-f(x)$. A half turn about the origin matches each point to its partner.",
        "Passing through the origin alone is insufficient; the symmetry must hold for every point.",
      ],
      "Compare the heights at inputs 1 and −1, then test another pair.",
    );
  }
  const kind = r(0, 2),
    sub = r(0, 2),
    a = pick(r, [-1, 1]);
  const fn: Fn =
    kind === 0
      ? sub === 0
        ? f.poly(a / 16, 0, a / 4, 0, 1)
        : sub === 1
          ? f.abs(a, 0, 1)
          : f.poly(a, 0, 0)
      : kind === 1
        ? sub === 0
          ? f.poly(a / 8, 0, a / 2, 0)
          : f.poly(a, 0)
        : sub === 0
          ? f.poly(1, -2, 0)
          : sub === 1
            ? f.poly(0.125, 0, 0, 1)
            : f.abs(1, 1);
  const label = [
    "Even: reflection across the vertical axis leaves the graph unchanged.",
    "Odd: a half turn about the origin leaves the graph unchanged.",
    "Neither: neither of those symmetries holds.",
  ][kind]!;
  return choice(
    r,
    "Is the function shown even, odd or neither?",
    label,
    [
      kind === 0
        ? "Odd: a half turn about the origin leaves it unchanged."
        : "Even: reflection across the vertical axis leaves it unchanged.",
      kind === 1
        ? "Neither: neither symmetry holds."
        : "Odd, because it passes through the origin.",
      "Even, because the graph includes a curve.",
    ],
    [
      label,
      "An even function has $f(-x)=f(x)$. An odd function has $f(-x)=-f(x)$. Test reflected points, not just a crossing at the origin.",
    ],
    "Compare the points at horizontal coordinates 1 and −1.",
    picture(curveScene(fn)),
  );
}
function inverseCompose(r: Random): ClauseSurface {
  const kind = r(0, 3),
    a = pick(r, [-4, -3, -2, 2, 3, 4, 0.5, -0.5]),
    b = pick(r, [-9, -6, -2, 1, 3, 7]);
  if (kind === 0)
    return choice(
      r,
      `Which function is the inverse of $f(x)=${a}x+${term(b)}$? Check $f(g(x))=x$.`,
      m(`g(x)=\\frac{x-${term(b)}}{${a}}`),
      [
        m(`g(x)=\\frac{x+${term(b)}}{${a}}`),
        m(`g(x)=\\frac{x}{${a}}-${term(b)}`),
        m(`g(x)=\\frac{1}{${a}x+${term(b)}}`),
      ],
      [
        `Undo the addition of ${b}, then divide by ${a}.`,
        `$f((x-${term(b)})/${a})=x$. The plus-sign candidate gives $x+${term(2 * b)}$.`,
        `Subtracting ${b} after dividing gives $x+${term(round(b * (1 - a)))}$. Taking a reciprocal does not undo the original operations.`,
      ],
      `In $${a}x+${term(b)}$, undo the last operation first.`,
    );
  const cubic = kind === 2,
    self = kind === 3;
  const prompt = cubic
    ? "Let $f(x)=2x^3$ and $g(x)=\\sqrt[3]{x/2}$. Complete the inverse check."
    : self
      ? "Let $f(x)=(x+1)/(x-1)$ for $x\\ne1$. Complete the inverse check with $g=f$."
      : `Let $f(x)=${a}x+${term(b)}$ and $g(x)=(x-${term(b)})/${a}$. Complete the inverse check.`;
  return blanks(
    r,
    prompt,
    [
      slot("$f(g(x))=$", "$x$", "$x+1$", "$1/x$"),
      slot("$g(f(x))=$", "$x$", "$-x$", "$0$"),
      slot(
        "Therefore",
        self ? "$f^{-1}=f$" : "$g=f^{-1}$",
        "$g=1/f$",
        "No inverse exists",
      ),
    ],
    [
      cubic
        ? "$2(\\sqrt[3]{x/2})^3=x$ and $\\sqrt[3]{2x^3/2}=x$ for every real input."
        : self
          ? "$f(f(x))=\\frac{(x+1)+(x-1)}{(x+1)-(x-1)}=x$ for $x\\ne1$. Also $f(x)\\ne1$, so the second application is defined."
          : `$f(g(x))=${a}((x-${term(b)})/${a})+${term(b)}=x$ and $g(f(x))=(${a}x+${term(b)}-${term(b)})/${a}=x$.`,
      "Both compositions return the original input. That verifies the inverse on the stated domains.",
    ],
    cubic
      ? "Cube the cube root, then multiply by 2."
      : self
        ? "Substitute the full fraction into both occurrences of the input. The input cannot be 1 because the denominator would vanish."
        : `Substitute $g(x)$ into $${a}x+${term(b)}$.`,
  );
}
function interpretStatement(r: Random): ClauseSurface {
  const fixed = r(10, 40),
    rate = r(3, 12),
    hours = r(1, 9),
    total = fixed + rate * hours,
    kind = r(0, 2);
  const lead = `$C(h)=${fixed}+${rate}h$ gives a plumber's charge in dollars for $h$ hours. `;
  if (kind === 2)
    return choice(
      r,
      lead +
        "$C$ is defined only for whole hours from 1 through 8. Which input is outside this domain?",
      "$C(2.5)$",
      ["$C(2)$", "$C(5)$", "$C(8)$"],
      [
        "The allowed inputs are the whole numbers 1 through 8. An input of 2.5 is not a whole hour.",
        "A formula can be evaluated numerically outside a model's domain, but that value is not part of this stated function.",
      ],
      "Check both conditions: whole hours, and 1 through 8.",
    );
  return choice(
    r,
    lead +
      (kind === 0
        ? `What does $C(${hours})=${total}$ mean?`
        : `Which statement says ${count(hours, "hour")} costs ${count(total, "dollar")}?`),
    kind === 0
      ? `The charge for ${count(hours, "hour")} is ${count(total, "dollar")}.`
      : m(`C(${hours})=${total}`),
    kind === 0
      ? [
          `The charge for ${count(total, "hour")} is ${count(hours, "dollar")}.`,
          `$C$ times ${hours} equals ${total}.`,
          `The hourly rate is ${count(hours, "dollar")}.`,
        ]
      : [
          m(`C(${total})=${hours}`),
          m(`C(h)=${hours}+${total}`),
          m(`C(${hours})=${rate}`),
        ],
    [
      `The input is time: ${count(hours, "hour")}. The output is cost: ${fixed} + ${rate} × ${hours} = ${count(total, "dollar")}.`,
      "Function notation names the output at a given input; it is not multiplication.",
    ],
    `Label the ${hours} inside the parentheses with the input unit, hours.`,
  );
}
function rateInterpret(r: Random): ClauseSurface {
  const start = pick(r, [1990, 2000, 2010]),
    rate = pick(r, [-3200, -1450, 2500, 17545]),
    p = 500000 + r(0, 9) * 10000,
    delta = rate * 20,
    middle = p + rate * 10 + 2000;
  const verb = rate > 0 ? "grew" : "declined",
    n = Math.abs(rate);
  return choice(
    r,
    `The average rate from ${start} to ${start + 20} is ${rate.toLocaleString("en-US")} people per year. Which statement interprets it?`,
    `Population ${verb} by ${n.toLocaleString("en-US")} people per year on average; individual years could differ.`,
    [
      `Population ${verb} by ${n.toLocaleString("en-US")} people in total.`,
      `Population ${verb} by exactly ${n.toLocaleString("en-US")} every year.`,
      rate < 0
        ? `Population grew by ${n.toLocaleString("en-US")} people per year on average.`
        : `The population in ${start + 20} was ${n.toLocaleString("en-US")}.`,
    ],
    [
      `The total change is ${delta} over 20 years: $${delta}/20=${rate}$.`,
      "The middle row differs from a constant-rate prediction. An average describes the same total change spread evenly, not what happened each year.",
    ],
    `Compare the populations in ${start} and ${start + 20}. Divide their change by the elapsed years.`,
    table(
      ["Year", "Population"],
      [
        [start, p],
        [start + 10, middle],
        [start + 20, p + delta],
      ].map(([x, y]) => ({ label: String(x), cells: [x!, y!] })),
    ),
  );
}

function quadraticPlot(r: Random): ClauseSurface {
  const [p, q] = pick(r, [
      [1, 5],
      [-5, -1],
      [-3, 1],
      [-1, 3],
      [2, 4],
      [-4, -2],
    ] as const),
    a = pick(r, [-1, 1]),
    h = (p + q) / 2,
    k = a * (h - p) * (h - q);
  return plot(
    `Graph $y=${a === 1 ? "" : "-"}(x-${term(p)})(x-${term(q)})$ by placing its two horizontal-axis intercepts, vertex and vertical-axis intercept.`,
    [
      [p, 0],
      [q, 0],
      [h, k],
      [0, a * p * q],
    ],
    {
      xMin: -6,
      xMax: 6,
      yMin: -10,
      yMax: 10,
      step: 1,
      xLabel: "x",
      yLabel: "y",
    },
    [
      `The factors vanish at ${p} and ${q}.`,
      `The vertex input is halfway: $(${p} ${q < 0 ? "-" : "+"} ${Math.abs(q)})/2=${h}$. Substitution gives ${k}.`,
      `At $x=0$, $y=${a * p * q}$.`,
    ],
    `Set each factor equal to 0; $x-${term(p)}=0$ means $x=${p}$.`,
  );
}
function cubeRoot(r: Random): ClauseSurface {
  const h = r(-5, 5),
    k = r(-5, 5),
    a = pick(r, [-2, -1, 1, 2]);
  return plot(
    `Graph $y=${a}\\sqrt[3]{x-${term(h)}}+${term(k)}$. Place its center point and the points exactly one horizontal unit to its left and right.`,
    [
      [h, k],
      [h - 1, k - a],
      [h + 1, k + a],
    ],
    { xMin: -8, xMax: 8, yMin: -8, yMax: 8, step: 1, xLabel: "x", yLabel: "y" },
    [
      `The center is $(${h},${k})$ because the cube root of 0 is 0.`,
      `Since $\\sqrt[3]{-1}=-1$ and $\\sqrt[3]{1}=1$, the neighboring points are $(${h - 1},${k - a})$ and $(${h + 1},${k + a})$.`,
      "A cube-root curve continues in both directions; it has no starting endpoint.",
    ],
    `First set $x-${term(h)}=0$. Then apply the outside multiplier ${a} and vertical shift ${k}.`,
  );
}
function piecewiseGraph(r: Random): ClauseSurface {
  const steps = r(0, 1) === 0,
    b = r(-3, 1),
    a = pick(r, [1, 2, 3]);
  const make = (swap: boolean, sign: number, sides: boolean): Scene => {
    if (steps)
      return graph({ x: [-1, 4], y: [-10, 10], grid: 1, tick: 2 })
        .curve(f.poly(a * sign), {
          domain: [0, 1],
          ends: swap ? ["open", "closed"] : ["closed", "open"],
        })
        .curve(f.poly(2 * a * sign), {
          domain: [1, 2],
          ends: swap ? ["open", "closed"] : ["closed", "open"],
        })
        .curve(f.poly(3 * a * sign), {
          domain: [2, 3],
          ends: swap ? ["open", "closed"] : ["closed", "open"],
        })
        .scene({ width: 260, maxHeight: 260 });
    const left = f.poly(-sign, b),
      right = f.poly(2 * sign, 1 - 2 * b);
    return graph({ x: [-6, 6], y: [-8, 8], grid: 1, tick: 2 })
      .curve(sides ? right : left, {
        domain: [-6, b],
        ends: ["arrow", swap ? "open" : "closed"],
      })
      .curve(sides ? left : right, {
        domain: [b, 6],
        ends: [swap ? "closed" : "open", "arrow"],
      })
      .scene({ width: 260, maxHeight: 260 });
  };
  const correct = make(false, 1, false);
  const option = (label: string, s: Scene) => ({ label, scene: s });
  const opts = steps
    ? [
        option(
          `Steps at heights ${a}, ${2 * a}, ${3 * a}; left endpoints filled.`,
          correct,
        ),
        option(
          "Steps with left endpoints open and right endpoints filled.",
          make(true, 1, false),
        ),
        option("Steps below the horizontal axis.", make(false, -1, false)),
        option(
          "Steps in reverse height order.",
          graph({ x: [-1, 4], y: [-10, 10], grid: 1, tick: 2 })
            .curve(f.poly(3 * a), { domain: [0, 1], ends: ["closed", "open"] })
            .curve(f.poly(2 * a), { domain: [1, 2], ends: ["closed", "open"] })
            .curve(f.poly(a), { domain: [2, 3], ends: ["closed", "open"] })
            .scene({ width: 260, maxHeight: 260 }),
        ),
      ]
    : [
        option(
          `Decreasing left piece ends filled at (${b}, 0); increasing right starts open at (${b}, 1).`,
          correct,
        ),
        option(
          `Left endpoint at ${b} open; right endpoint filled.`,
          make(true, 1, false),
        ),
        option(
          "The two formulas are drawn on opposite sides of the boundary.",
          make(false, 1, true),
        ),
        option(
          "The slope signs of both pieces are reversed.",
          make(false, -1, false),
        ),
      ];
  return figures(
    r,
    steps
      ? `Which graph shows $f(x)=\\begin{cases}${a}&0\\le x<1\\\\${2 * a}&1\\le x<2\\\\${3 * a}&2\\le x<3\\end{cases}$?`
      : `Which graph shows $f(x)=\\begin{cases}-x+${term(b)}&x\\le${b}\\\\2x+${term(1 - 2 * b)}&x>${b}\\end{cases}$?`,
    opts,
    [
      "Draw each formula only on its stated interval. A filled endpoint includes the boundary; an open endpoint excludes it.",
      steps
        ? `The heights are ${a}, ${2 * a}, ${3 * a} on successive unit intervals.`
        : `At $x=${b}$, the left formula gives 0 and includes the point; the right formula gives 1 and excludes it.`,
    ],
    steps
      ? "Read the first interval: it includes 0 and excludes 1."
      : `At the boundary ${b}, compare $-x+${term(b)}$ and $2x+${term(1 - 2 * b)}$; check which inequality includes equality.`,
  );
}
const multiply = (a: number[], b: number[]) => {
  const c = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) =>
    b.forEach((y, j) => {
      c[i + j]! += x * y;
    }),
  );
  return c;
};
function polynomialGraph(r: Random): ClauseSurface {
  const p = r(-4, -1),
    q = r(1, 4),
    a = pick(r, [-1, 1]),
    e = pick(r, [2, 3]),
    other = e === 2 ? 1 : 2;
  const fn = (
    u: number,
    v: number,
    lead: number,
    ep: number,
    eq: number,
  ): Fn => {
    let c = [lead];
    for (let i = 0; i < ep; i++) c = multiply(c, [-u, 1]);
    for (let i = 0; i < eq; i++) c = multiply(c, [-v, 1]);
    return { f: "poly", c };
  };
  const configs = [
    [p, q, a, e, other],
    [p, q, -a, e, other],
    [p, q, a, other, e],
    [-p, -q, a, e, other],
  ];
  // If reflection duplicates the swapped multiplicities (symmetric roots), use shifted roots instead.
  if (p === -q) configs[3] = [p - 1, q - 1, a, e, other];
  return figures(
    r,
    `Which graph shows $P(x)=${a < 0 ? "-" : ""}(x-${term(p)})^{${e}}(x-${term(q)})^{${other}}$?`,
    configs.map(([u, v, lead, ep, eq]) => ({
      label: `Zeros ${u} (${ep! % 2 ? "cross" : "touch"}) and ${v} (${eq! % 2 ? "cross" : "touch"}); right end ${lead! > 0 ? "rises" : "falls"}.`,
      scene: curveScene(fn(u!, v!, lead!, ep!, eq!), [-6, 6], [-40, 40]),
    })),
    [
      `The zeros are ${p} and ${q}. An even exponent touches; an odd exponent crosses.`,
      `The degree is ${e + other}, and the leading sign is ${a > 0 ? "positive" : "negative"}. The right end ${a > 0 ? "rises" : "falls"}.`,
    ],
    `Set each factor, $x-${term(p)}$ and $x-${term(q)}$, to 0. Use the exponents ${e} and ${other} to decide whether the graph crosses or touches at each zero.`,
  );
}
function rationalGraph(r: Random): ClauseSurface {
  const z = r(0, 1),
    v = -2,
    w = r(3, 4),
    a = pick(r, [-2, -1, 1, 2]),
    two = r(0, 1) === 0;
  const fn = (
    zero: number,
    p: number,
    q: number,
    k: number,
    offset = 0,
  ): Fn => {
    const den = two ? multiply([-p, 1], [-q, 1]) : [-p, 1];
    const num = den.map((c) => c * offset);
    num[0]! -= k * zero;
    num[1]! += k;
    return { f: "rational", num, den };
  };
  const configs = [
    [z, v, w, a, 0],
    [z, -v, -w, a, 0],
    [v, z, w, a, 0],
    [z, v, w, a, two ? a : -2 * a],
  ];
  return figures(
    r,
    `Which graph shows $f(x)=\\frac{${a}(x-${term(z)})}{${two ? `(x-${term(v)})(x-${term(w)})` : `x-${term(v)}`}}$?`,
    configs.map(([zero, p, q, k, offset]) => ({
      label: `Poles at ${p}${two ? ` and ${q}` : ""}; horizontal asymptote ${two ? offset : k! + offset!}; numerator built from zero ${zero}${offset ? ` with vertical shift ${offset}` : ""}.`,
      scene: curveScene(fn(zero!, p!, q!, k!, offset), [-6, 6], [-8, 8]),
    })),
    [
      `The numerator vanishes at ${z}. The denominator vanishes at ${v}${two ? ` and ${w}` : ""}; none cancels.`,
      two
        ? "The denominator has higher degree, so both ends approach 0."
        : `The leading coefficients have ratio ${a}, so both ends approach ${a}.`,
    ],
    `In $${a}(x-${term(z)})$, find the numerator's zero; compare it with the denominator factors $x-${term(v)}$${two ? ` and $x-${term(w)}$` : ""}.`,
  );
}
function trigGraph(r: Random): ClauseSurface {
  const a = pick(r, [-3, -2, -1, 1, 2, 3]),
    period = pick(r, [2, 4, 8, Math.PI, 2 * Math.PI]),
    k = pick(r, [-3, -2, -1, 1, 2, 3]),
    cosine = r(0, 1) === 0,
    b = (2 * Math.PI) / period;
  return figures(
    r,
    `Which graph shows $y=${a}\\${cosine ? "cos" : "sin"}(${period === Math.PI ? "2x" : period === 2 * Math.PI ? "x" : period === 2 ? "\\pi x" : `\\pi x/${period / 2}`})+${term(k)}$?`,
    [
      [a, period, k],
      [a, period, -k],
      [a, b, k],
      [2 * a, period, k],
    ].map(([amp, T, mid]) => ({
      label: `${cosine ? "Cosine" : "Sine"} graph: signed height factor ${amp}, period ${round(T!)}, midline ${mid}.`,
      scene: curveScene(
        cosine
          ? f.cos(amp!, (2 * Math.PI) / T!, { k: mid })
          : f.sin(amp!, (2 * Math.PI) / T!, { k: mid }),
        [0, 2 * period],
        [-10, 10],
      ),
    })),
    [
      `The midline is $y=${k}$ and the amplitude, distance from midline to peak, is ${Math.abs(a)}.`,
      `The period is $2\\pi$ divided by the input multiplier, giving $${period === Math.PI ? "\\pi" : period === 2 * Math.PI ? "2\\pi" : period}$. The ${a < 0 ? "negative" : "positive"} sign determines the initial direction.`,
    ],
    `Start with the midline $y=${k}$, then measure ${Math.abs(a)} above and below it.`,
  );
}

export const patternClauseExtensions: Record<string, ClauseExtension> = {
  "times-table-pattern": ext(
    ["explain-with-property"],
    tableProperty,
    "multi-part-choice-v1",
  ),
  "rule-pattern-feature": ext(["feature-why"], featureWhy),
  "coordinate-context-points": ext(
    ["plot-situation"],
    contextPlot,
    "point-plot-v1",
  ),
  "pattern-pair-relationship": ext(["graph-pairs"], pairPlot, "point-plot-v1"),
  "related-patterns-relationship": ext(["why-multiple"], whyMultiple),
  "dependent-variable-value": ext(
    ["list-and-graph"],
    listGraph,
    "point-plot-v1",
  ),
  "story-graph-match": ext(
    ["linear-or-nonlinear", "sketch-from-story"],
    story,
    "figure-choice-v1",
  ),
  "graphical-solution-table": ext(
    ["why-intersection", "all-families"],
    (r, v) => (v === "why-intersection" ? intersection(r) : allFamilies(r)),
  ),
  "rational-abs-solution-count": ext(["log-exponential-pairs"], (r) =>
    allFamilies(r, true),
  ),
  "fl-function-arithmetic": ext(["build-model"], buildModel),
  "composition-expression": ext(["compose-in-context"], composeContext),
  "series-recursion": ext(["recursive-to-explicit"], recursion),
  "fl-even-odd-classify": ext(["from-graph"], parityGraph, "figure-choice-v1"),
  "inverse-expression": ext(
    ["verify-by-composition"],
    inverseCompose,
    "multi-part-choice-v1",
  ),
  "sat-entry-fn-linear-notation": ext(
    ["interpret-statement"],
    interpretStatement,
  ),
  "average-rate-table-rounded": ext(["interpret"], rateInterpret),
  "graph-quadratic-points": ext(
    ["intercepts-and-vertex"],
    quadraticPlot,
    "point-plot-v1",
  ),
  "graph-sqrt-points": ext(["cube-root"], cubeRoot, "point-plot-v1"),
  "piecewise-reading": ext(
    ["graph-choice"],
    piecewiseGraph,
    "figure-choice-v1",
  ),
  "polynomial-graph-match": ext(
    ["rule-to-graph"],
    polynomialGraph,
    "figure-choice-v1",
  ),
  "rational-function-features": ext(
    ["graph-choice"],
    rationalGraph,
    "figure-choice-v1",
  ),
  "sinusoid-parameters": ext(
    ["equation-to-graph"],
    trigGraph,
    "figure-choice-v1",
  ),
  "coordinate-terms-slots": ext(
    ["axes-definition"],
    (r) =>
      blanks(
        r,
        "Complete the definitions of a coordinate system.",
        [
          slot(
            "The two perpendicular number lines are the",
            "axes",
            "ordered pair",
            "coordinates",
          ),
          slot(
            "Their crossing, 0 on each axis, is the",
            "origin",
            "scale",
            "ordered pair",
          ),
          slot(
            "Two numbers in order naming a point form an",
            "ordered pair",
            "axis",
            "origin",
          ),
        ],
        [
          "Perpendicular number lines meet at a right angle. They are the axes.",
          "Their common zero is the origin, $(0,0)$. An ordered pair gives horizontal then vertical position.",
        ],
        "Locate 0 on each number line first.",
      ),
    "multi-part-choice-v1",
  ),
};
