import { test } from "node:test";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  clientCanDraw,
  generatedProblemSchema,
  publicProblemSchema,
  responseCapabilities,
  type GeneratedProblem,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  evaluate,
  lineTex,
  parseLine,
  rfEq,
  type ParseOptions,
} from "../src/math/expression";
import {
  checkMove,
  draftRows,
  gradeStructuredWork,
  markStructuredWork,
  normalizeStructuredWork,
  structuralProblem,
  structuredWorkAnswerText,
  structuredWorkFeedback,
  structuredWorkGuessChance,
  structuredWorkResponseSchema,
  workProgress,
  type StructuredWorkResponse,
  type WorkGrading,
} from "../src/math/structured-work";
import { problemGuessChance } from "../src/math/guess-chance";
import { answerText } from "../src/math/selection-response";
import { solveJustifyCases } from "../src/math/solve-and-justify-practice";
import { twoColumnProofCases } from "../src/math/two-column-proof-practice";
import { showWorkCases } from "../src/math/show-work-word-problem-practice";
import { capabilitySchema, packSchema } from "../src/offline/contracts";
import { planMixedPractice } from "../src/server/mixed-practice";
import { skills } from "../src/curriculum/catalog";
import { problemLesson } from "../src/content/problem-lessons";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { keypadKeys } from "../src/web/StructuredWorkInput";

const families = [
  "solve-justify-linear",
  "solve-justify-inequality",
  "solve-justify-formula",
  "solve-justify-quadratic",
  "two-column-congruence-proof",
  "two-column-angle-proof",
  "show-work-box-cost",
  "show-work-percent-count",
  "show-work-rental-plans",
] as const;
const x: ParseOptions = {
  variables: ["x"],
  relations: true,
  powers: true,
  compound: true,
};
const value = (text: string, o: ParseOptions = x) => {
  const parsed = parseLine(text, o);
  assert.ok(parsed.ok, `${text}: ${parsed.ok ? "" : parsed.error}`);
  return evaluate(parsed.line.parts[0]!.left);
};
const same = (a: string, b: string, o: ParseOptions = x) =>
  rfEq(value(a, o), value(b, o));
const error = (text: string, o: ParseOptions = x) => {
  const parsed = parseLine(text, o);
  return parsed.ok ? null : parsed.error;
};

/* ------------------------------------------------- expression engine */

test("expressions are equal exactly when they are the same polynomial or rational function", () => {
  for (const [a, b] of [
    ["2(x+3)", "2x+6"],
    ["x/2", "0.5x"],
    ["(1/2)x", "x/2"],
    ["x-(2-x)", "2x-2"],
    ["(x+1)(x-2)", "x^2-x-2"],
    ["(x^2-1)/(x-1)", "x+1"],
    ["-x^2", "-(x^2)"],
    ["(-x)^2", "x^2"],
    ["x²+2x", "x(x+2)"],
    ["2^3x", "8x"],
    ["x/2x", "x^2/2"], // left to right: (x/2)·x
    ["3−2x", "3-2x"],
    ["4×x÷2", "2x"],
    ["0.1+0.2", "0.3"],
    [".5x", "x/2"],
    ["x^-1", "1/x"],
  ])
    assert.ok(same(a, b), `${a} ≡ ${b}`);
  for (const [a, b] of [
    ["2(x+3)", "2x+3"],
    ["x/2x", "1/2"],
    ["-x^2", "x^2"],
    ["0.1+0.2", "0.3000000001"],
    ["x+1", "x-1"],
  ])
    assert.ok(!same(a, b), `${a} ≢ ${b}`);
  const f: ParseOptions = { variables: ["A", "b", "h"], relations: true };
  assert.ok(same("2A/b", "(2/b)A", f));
  assert.ok(same("A/(bh)", "A/b/h", f));
  assert.ok(!same("A/bh", "A/(bh)", f));
});

test("malformed entries are explained in plain words, never graded", () => {
  assert.match(error("x2")!, /number before the letter/);
  assert.match(error("2 3")!, /operation between/);
  assert.match(error("x--2")!, /Two signs/);
  assert.match(error("q+1")!, /Use only x/);
  assert.match(error("1/(x-x)")!, /Division by zero/);
  assert.match(error("x^13")!, /too large/);
  assert.match(error("(x+1")!, /Close each/);
  assert.match(error("x+1)")!, /no matching/);
  assert.match(error("x=1=2")!, /one relation/);
  assert.match(error("x^2", { variables: ["x"] })!, /Powers are not used/);
  assert.match(error("x<2", { variables: ["x"] })!, /not a relation/);
  assert.match(
    error("x+1", { variables: ["x"], relations: true, requireRelation: true })!,
    /both sides/,
  );
  assert.match(error("x=1 or 2", x)!, /needs a relation/);
  assert.equal(error(""), "Enter a line");
  assert.equal(error("1.2.3")!.length > 0, true);
});

test("typed variants read the same and preview as TeX", () => {
  const line = (t: string) => {
    const p = parseLine(t, x);
    assert.ok(p.ok, t);
    return lineTex(p.line);
  };
  assert.equal(line("x ≤ 3"), line("x<=3"));
  assert.equal(line("x² − 4 = 0"), "x^{2}-4=0");
  assert.equal(line("x=-2 or x=3"), "x=-2\\ \\text{or}\\ x=3");
  assert.equal(line("x=-2, x=3"), line("x=-2 or x=3"));
  assert.match(line("(x+1)/2=3"), /\\frac\{x\+1\}\{2\}=3/);
});

/* --------------------------------------------------- derivation rules */

const L = (t: string, o: ParseOptions = x) => {
  const p = parseLine(t, o);
  assert.ok(p.ok, t);
  return p.line;
};
test("a step is valid only by the move its reason names", () => {
  const ok = (
    a: string,
    b: string,
    m: Parameters<typeof checkMove>[2],
    o = x,
    pos: string[] = [],
  ) => checkMove(L(a, o), L(b, o), m, pos).ok;
  assert.ok(ok("3(x+2)+4=22", "3x+6+4=22", "distribute"));
  assert.ok(!ok("3(x+2)+4=22", "3x+6+4=22", "combine"));
  assert.ok(ok("3x+6+4=22", "3x+10=22", "combine"));
  assert.ok(ok("3x+10=22", "3x=12", "subtract"));
  assert.ok(ok("3x+10=22", "3x+10-10=22-10", "subtract"));
  assert.ok(!ok("3x+10=22", "3x=12", "add"));
  assert.ok(ok("x-4=2", "x=6", "add"));
  assert.ok(ok("3x=12", "x=4", "divide"));
  assert.ok(!ok("3x=12", "x=4", "multiply"));
  assert.ok(ok("x/3=4", "x=12", "multiply"));
  assert.ok(ok("-x=4", "x=-4", "multiply") && ok("-x=4", "x=-4", "divide"));
  assert.ok(ok("2x+3=x+7", "x+3=7", "subtract"));
  assert.ok(ok("x+3=7", "3+x=7", "commute"));
  assert.ok(ok("7=x", "x=7", "symmetric"));
  // A wrong result is not any move; a right result with the wrong reason says so.
  assert.deepEqual(checkMove(L("3x=12"), L("x=3"), "divide"), {
    ok: false,
    why: "move",
  });
  assert.deepEqual(checkMove(L("3x=12"), L("x=4"), "subtract"), {
    ok: false,
    why: "reason",
  });
  assert.deepEqual(checkMove(L("x=4"), L("x=4"), "combine"), {
    ok: false,
    why: "move",
  });
  // Multiplying by 0 is never a step.
  assert.ok(!ok("x=4", "0=0", "multiply"));
  // Inequalities: dividing by a negative reverses the sign.
  assert.ok(ok("-2x<8", "x>-4", "divide"));
  assert.ok(!ok("-2x<8", "x<-4", "divide"));
  assert.ok(ok("2x<8", "x<4", "divide"));
  assert.ok(!ok("2x<8", "x>4", "divide"));
  assert.ok(ok("x+1<3", "x<2", "subtract"));
  // Factoring and the zero-product property.
  assert.ok(ok("x^2+5x+6=0", "(x+2)(x+3)=0", "factor"));
  assert.ok(!ok("x^2+5x+6=0", "(x+2)(x+3)=0", "distribute"));
  assert.ok(ok("(x+2)(x+3)=0", "x+2=0 or x+3=0", "zero-product"));
  assert.ok(ok("(x+2)(x+3)=0", "x+3=0 or x+2=0", "zero-product"));
  assert.ok(ok("2(x+2)(x+3)=0", "x+2=0 or x+3=0", "zero-product"));
  assert.ok(!ok("(x+2)(x+3)=6", "x+2=6 or x+3=6", "zero-product"));
  assert.ok(!ok("(x+2)(x+3)=0", "x+2=0 or x-3=0", "zero-product"));
  // Each part of a compound line may move by its own amount.
  assert.ok(ok("x+2=0 or x-3=0", "x=-2 or x=3", "subtract"));
  assert.ok(ok("x+2=0 or x-3=0", "x=-2 or x=3", "add"));
  assert.ok(ok("x+2=0 or x-3=0", "x=-2 or x-3=0", "subtract"));
  // Formulas: divide by a positive measurement, never by an unknown sign.
  const f: ParseOptions = {
    variables: ["A", "b", "h"],
    relations: true,
    requireRelation: true,
  };
  assert.ok(ok("2A=bh", "2A/b=h", "divide", f, ["A", "b", "h"]));
  assert.ok(!ok("2A=bh", "2A/b=h", "multiply", f, ["A", "b", "h"]));
  assert.ok(!ok("2A=bh", "2A/b=h", "divide", f, []));
  assert.ok(ok("A=(1/2)bh", "2A=bh", "multiply", f, ["A", "b", "h"]));
});

const linearWork = (
  mode: "build" | "fill" | "order",
  rows: StructuredWorkResponse["rows"],
): StructuredWorkResponse => ({
  kind: "structured-work",
  label: "Your solution",
  layout: "steps",
  mode,
  start: "$3(x+2)+4=22$",
  banks: [
    {
      id: "reasons",
      label: "Reason",
      options: [
        { id: "ad", label: "Addition property of equality" },
        { id: "su", label: "Subtraction property of equality" },
        { id: "di", label: "Division property of equality" },
        { id: "dp", label: "Distributive property" },
        { id: "cl", label: "Combine like terms" },
      ],
    },
  ],
  rows,
  ...(mode === "build" ? { open: { max: 5 } } : {}),
});
const lineField = (given?: string) => ({
  kind: "expression" as const,
  label: "Line",
  variables: ["x"],
  relations: true,
  maxLength: 24,
  ...(given ? { given } : {}),
});
const reasonField = (given?: string) => ({
  kind: "choice" as const,
  label: "Reason",
  bank: "reasons",
  ...(given ? { given } : {}),
});
const linearGrading: WorkGrading = {
  mode: "derivation",
  variable: "x",
  start: "3(x+2)+4=22",
  moves: {
    ad: "add",
    su: "subtract",
    di: "divide",
    dp: "distribute",
    cl: "combine",
  },
  solution: ["4"],
  line: { variables: ["x"], relations: true, requireRelation: true },
};

test("any valid path solves the equation; every line is marked on its own", () => {
  const r = linearWork("build", [
    { id: "r1", fields: [lineField(), reasonField()] },
  ]);
  assert.equal(structuralProblem(r), null);
  const grade = (rows: string[][]) =>
    markStructuredWork(r, linearGrading, JSON.stringify(rows));
  assert.ok(
    grade([
      ["3x+6+4=22", "dp"],
      ["3x+10=22", "cl"],
      ["3x=12", "su"],
      ["x=4", "di"],
    ]).correct,
  );
  // Undo the addition first: a shorter, equally valid path.
  assert.ok(
    grade([
      ["3(x+2)=18", "su"],
      ["x+2=6", "di"],
      ["x=4", "su"],
    ]).correct,
  );
  // Writing the operation without simplifying is a valid line.
  assert.ok(
    grade([
      ["3(x+2)+4-4=22-4", "su"],
      ["3(x+2)=18", "cl"],
      ["x+2=6", "di"],
      ["x=4", "su"],
    ]).correct,
  );
  // A wrong reason marks only its own line, with a note saying why.
  const wrongReason = grade([
    ["3x+6+4=22", "dp"],
    ["3x+10=22", "cl"],
    ["3x=12", "ad"],
    ["x=4", "di"],
  ]);
  assert.deepEqual(wrongReason.rows, [true, true, false, true]);
  assert.match(
    wrongReason.notes[0]!,
    /Step 3 follows .* but not by the reason chosen/,
  );
  // An arithmetic slip, then work that follows from it: only the slip is wrong,
  // but the last line is not the solution.
  const slip = grade([
    ["3x+6+4=22", "dp"],
    ["3x+10=22", "cl"],
    ["3x=11", "su"],
    ["x=11/3", "di"],
  ]);
  assert.equal(slip.correct, false);
  assert.deepEqual(slip.rows, [true, true, false, false]);
  // Valid but unfinished work earns no credit.
  const unfinished = grade([
    ["3x+6+4=22", "dp"],
    ["3x+10=22", "cl"],
  ]);
  assert.equal(unfinished.correct, false);
  assert.match(unfinished.notes.at(-1)!, /not solved yet/);
  // Solved for the right value from the other side is fine.
  assert.ok(
    grade([
      ["3(x+2)=18", "su"],
      ["x+2=6", "di"],
      ["x=4", "su"],
    ]).correct,
  );
  assert.deepEqual(
    structuredWorkFeedback(
      r,
      linearGrading,
      JSON.stringify([
        ["3x+6+4=22", "dp"],
        ["3x+10=22", "dp"],
        ["3x=12", "su"],
        ["x=4", "di"],
      ]),
    ).slice(0, 2),
    [
      "3 of 4 steps are correct. Recheck step 2.",
      "Step 2 follows from the line before it, but not by the reason chosen.",
    ],
  );
});

test("a fill-in blames the learner's line, not the given line after it", () => {
  const r = linearWork("fill", [
    { id: "r1", fields: [lineField("3x+6+4=22"), reasonField("dp")] },
    { id: "r2", fields: [lineField(), reasonField()] },
    { id: "r3", fields: [lineField("3x=12"), reasonField("su")] },
    { id: "r4", fields: [lineField(), reasonField()] },
  ]);
  assert.equal(structuralProblem(r), null);
  const key = JSON.stringify([
    ["", ""],
    ["3x+10=22", "cl"],
    ["", ""],
    ["x=4", "di"],
  ]);
  assert.ok(gradeStructuredWork(r, linearGrading, key));
  // A valid move that does not lead to the given line 3.
  // Subtracting 22 is a valid move, but the given "3x = 12, by subtraction"
  // cannot follow it.
  const astray = markStructuredWork(
    r,
    linearGrading,
    JSON.stringify([
      ["", ""],
      ["3x+6+4-22=0", "su"],
      ["", ""],
      ["x=4", "di"],
    ]),
  );
  assert.deepEqual(astray.rows, [true, false, true, true]);
  assert.equal(astray.correct, false);
  assert.match(astray.notes[0]!, /Step 2 does not lead to the given step 3/);
});

test("an ordering is graded by the chain, position by position", () => {
  const rows = [
    ["3x=12", "su"],
    ["x=4", "di"],
    ["3x+10=22", "cl"],
    ["3x+6+4=22", "dp"],
  ].map(([line, reason], i) => ({
    id: `r${i + 1}`,
    fields: [lineField(line), reasonField(reason)],
  }));
  const r = linearWork("order", rows);
  assert.equal(structuralProblem(r), null);
  assert.ok(
    gradeStructuredWork(
      r,
      linearGrading,
      JSON.stringify(["r4", "r3", "r1", "r2"]),
    ),
  );
  assert.deepEqual(
    markStructuredWork(
      r,
      linearGrading,
      JSON.stringify(["r3", "r4", "r1", "r2"]),
    ).rows,
    [false, false, true, true],
  );
  assert.equal(structuredWorkGuessChance(r, linearGrading), 1 / 24);
  // Not a permutation of the shown rows: invalid, not wrong.
  for (const bad of [
    '["r1","r2","r3"]',
    '["r1","r1","r2","r3"]',
    '["r1","r2","r3","r9"]',
    "[]",
  ])
    assert.equal(normalizeStructuredWork(r, bad), null, bad);
});

/* ------------------------------------------------------------- proofs */

test("a proof line needs its reason's facts on lines above it", () => {
  const p = twoColumnProofCases["two-column-congruence-proof"]("t", {
    config: "parallel-sides",
    mode: "build",
  });
  const g = p.problem.workGrading!;
  assert.equal(g.mode, "proof");
  if (g.mode !== "proof") return;
  const r = p.problem.public.response as StructuredWorkResponse;
  const key = JSON.parse(p.problem.answer) as string[][];
  assert.ok(gradeStructuredWork(r, g, p.problem.answer));
  const byLabel = (bank: number, pattern: RegExp) =>
    r.banks[bank]!.options.find((o) => pattern.test(o.label))!.id;
  const vertical = byLabel(1, /^Vertical/);
  const aas = byLabel(1, /^AAS$/);
  const cpctc = byLabel(1, /CPCTC/);
  const verticalStatement = Object.entries(g.claims).find(
    ([, rs]) => vertical in rs,
  )![0];
  // The AAS route through the vertical angles is accepted too.
  if (key.length === 5) {
    const aasProof = [
      key[0]!,
      key[1]!,
      key[2]!,
      [verticalStatement, vertical],
      [key[4]![0]!, aas],
    ];
    assert.ok(gradeStructuredWork(r, g, JSON.stringify(aasProof)), "AAS");
  }
  // Swapping two lines so a fact is used before it is stated.
  const early = [key[2]!, key[1]!, key[0]!, ...key.slice(3)];
  const marks = markStructuredWork(r, g, JSON.stringify(early));
  assert.equal(marks.rows[0], false);
  assert.match(marks.notes[0]!, /not stated on a line above/);
  // CPCTC before the congruence.
  const cpctcStatement = Object.entries(g.claims).find(
    ([, rs]) => cpctc in rs,
  )![0];
  const premature = [key[0]!, [cpctcStatement, cpctc], ...key.slice(2)];
  assert.equal(
    markStructuredWork(r, g, JSON.stringify(premature)).rows[1],
    false,
  );
  // A repeated statement, and a proof that does not end with the goal.
  const repeat = [key[0]!, key[0]!, ...key.slice(2)];
  assert.match(
    markStructuredWork(r, g, JSON.stringify(repeat)).notes[0]!,
    /repeats/,
  );
  const reversedEnd = [...key.slice(0, -2), key.at(-1)!, key.at(-2)!];
  assert.equal(
    markStructuredWork(r, g, JSON.stringify(reversedEnd)).correct,
    false,
  );
  // A wrong vertex correspondence is never justified.
  const wrong = r.banks[0]!.options.find(
    (o) => !(o.id in g.claims) && /triangle/.test(o.label),
  )!;
  const swapped = [...key.slice(0, -1), [wrong.id, key.at(-1)![1]!]];
  assert.equal(
    markStructuredWork(r, g, JSON.stringify(swapped)).correct,
    false,
  );
});

test("bank-built proofs and orderings have a small, never understated guessing chance", () => {
  for (const id of [
    "two-column-congruence-proof",
    "two-column-angle-proof",
  ] as const)
    for (let i = 0; i < 40; i++) {
      const problem = generateProblem(id, `guess-${i}`);
      const r = problem.public.response as StructuredWorkResponse;
      const chance = structuredWorkGuessChance(r, problem.workGrading!);
      assert.ok(chance <= 0.15, `${id} ${i}: ${chance}`);
      if (r.mode !== "order") continue;
      // Count valid orders independently: try every permutation.
      const ids = r.rows.map((row) => row.id);
      const perms = (xs: string[]): string[][] =>
        xs.length < 2
          ? [xs]
          : xs.flatMap((v, k) =>
              perms([...xs.slice(0, k), ...xs.slice(k + 1)]).map((rest) => [
                v,
                ...rest,
              ]),
            );
      const all = perms(ids);
      const valid = all.filter((o) =>
        gradeAnswer(problem, JSON.stringify(o)),
      ).length;
      assert.equal(chance, valid / all.length);
    }
});

/* ------------------------------------------------------------- fields */

test("labeled values: exact numbers, fraction form, identical expressions and inequalities either way round", () => {
  const p = showWorkCases["show-work-rental-plans"]("v", {
    mode: "build",
    ask: "less",
  });
  const r = p.problem.public.response as StructuredWorkResponse;
  const g = p.problem.workGrading!;
  const key = JSON.parse(p.problem.answer) as string[][];
  assert.ok(gradeStructuredWork(r, g, p.problem.answer));
  const v = r.rows[0]!.fields[0]!.variables![0]!;
  const [a, b, ineq, equal] = key.map((row) => row[0]!);
  const [left, right] = ineq!.split("<");
  const variants = [
    [`${a}`, `${b}`, `${right}>${left}`, equal!],
    [
      `${a!.split("+").reverse().join("+")}`,
      `${b}`,
      `${left}<${right}`,
      `${equal}.0`,
    ],
  ];
  for (const rows of variants)
    assert.ok(
      gradeStructuredWork(r, g, JSON.stringify(rows.map((x) => [x]))),
      JSON.stringify(rows),
    );
  // The solved inequality is equivalent but is not the inequality asked for.
  assert.equal(
    markStructuredWork(
      r,
      g,
      JSON.stringify([[a], [b], [`${v}<${equal}`], [equal]]),
    ).rows[2],
    false,
  );
  assert.equal(
    markStructuredWork(
      r,
      g,
      JSON.stringify([[a], [b], [`${left}>${right}`], [equal]]),
    ).rows[2],
    false,
  );
  const percent = showWorkCases["show-work-percent-count"]("v", {
    mode: "build",
  }).problem;
  const pr = percent.public.response as StructuredWorkResponse;
  const pk = JSON.parse(percent.answer) as string[][];
  const [n, d] = pk[0]![0]!.split("/").map(Number);
  const scaled = [[`${n! * 2}/${d! * 2}`], ...pk.slice(1)];
  assert.ok(
    gradeStructuredWork(pr, percent.workGrading!, JSON.stringify(scaled)),
  );
  const decimal = [[String(n! / d!)], ...pk.slice(1)];
  assert.equal(
    markStructuredWork(pr, percent.workGrading!, JSON.stringify(decimal))
      .rows[0],
    false,
  );
});

test("only complete, valid work can be submitted, in one canonical spelling", () => {
  const r = linearWork("build", [
    { id: "r1", fields: [lineField(), reasonField()] },
  ]);
  for (const bad of [
    "",
    "nonsense",
    "[]",
    '[["3x=12"]]',
    '[["3x=12","zz"]]',
    '[["3x=","su"]]',
    '[["","su"]]',
    '[["q=1","su"]]',
    JSON.stringify(Array(6).fill(["x=4", "di"])),
    JSON.stringify([["x=4".padEnd(30, " "), "di"]]),
  ])
    assert.equal(normalizeStructuredWork(r, bad), null, bad);
  assert.equal(
    normalizeStructuredWork(r, '[[" 3x  ≤ 12 ","su"]]'),
    '[["3x<=12","su"]]',
  );
  assert.deepEqual(workProgress(r, '[["3x=12",""]]'), { done: 1, total: 2 });
  assert.deepEqual(draftRows(r, ""), [["", ""]]);
  assert.equal(
    structuredWorkAnswerText(r, '[["3x=12","su"],["x=4","di"]]'),
    "$x=4$ — Division property of equality",
  );
});

test("the schema keeps modes, banks and the response budget consistent", () => {
  const ok = linearWork("build", [
    { id: "r1", fields: [lineField(), reasonField()] },
  ]);
  assert.ok(structuredWorkResponseSchema.safeParse(ok).success);
  const broken: [string, StructuredWorkResponse][] = [
    [
      "given in build",
      linearWork("build", [
        { id: "r1", fields: [lineField("x=4"), reasonField()] },
      ]),
    ],
    [
      "fill without blanks",
      {
        ...linearWork("fill", [
          { id: "r1", fields: [lineField("x=4"), reasonField("di")] },
        ]),
      },
    ],
    [
      "order with an entry",
      linearWork(
        "order",
        [1, 2, 3].map((i) => ({
          id: `r${i}`,
          fields: [lineField(), reasonField("di")],
        })),
      ),
    ],
    [
      "unknown bank",
      linearWork("build", [
        { id: "r1", fields: [lineField(), { ...reasonField(), bank: "nope" }] },
      ]),
    ],
    [
      "bad given",
      linearWork("fill", [
        { id: "r1", fields: [lineField("x=="), reasonField()] },
      ]),
    ],
    [
      "over budget",
      {
        ...linearWork("build", [
          {
            id: "r1",
            fields: [{ ...lineField(), maxLength: 32 }, reasonField()],
          },
        ]),
        open: { max: 6 },
      },
    ],
    ["proof without goal", { ...ok, layout: "proof" }],
  ];
  for (const [name, r] of broken)
    assert.equal(
      structuredWorkResponseSchema.safeParse(r).success,
      false,
      name,
    );
});

/* ----------------------------------------------------------- families */

test("every family is reachable in every mode, valid, self-consistent and leaks no answer", () => {
  for (const id of families) {
    const variants = new Set<string>();
    const modes = new Set<string>();
    for (let i = 0; i < 160; i++) {
      const p = generateProblem(id, `structured-${i}`);
      assert.ok(generatedProblemSchema.safeParse(p).success, `${id} ${i}`);
      assert.ok(publicProblemSchema.safeParse(p.public).success);
      const r = p.public.response;
      assert.equal(r.kind, "structured-work");
      if (r.kind !== "structured-work") continue;
      variants.add(p.variant!.id);
      modes.add(r.mode);
      // The key is credited, valid and canonical; nothing secret is public.
      assert.ok(gradeAnswer(p, p.answer), `${id} ${i}`);
      assert.ok(isValidResponse(p.public, p.answer));
      const pub = JSON.stringify(p.public);
      for (const secret of [
        '"workGrading"',
        '"claims"',
        '"moves"',
        '"solution"',
        '"answer"',
      ])
        assert.equal(pub.includes(secret), false, `${id} ${i}: ${secret}`);
      assert.equal(pub.includes(p.answer), false, `${id} ${i}: key`);
      if (r.mode === "build" && p.workGrading!.mode === "derivation") {
        const last = (JSON.parse(p.answer) as string[][]).at(-1)![0]!;
        assert.equal(pub.includes(last), false, `${id} ${i}: final line`);
      }
      // A blank response, a half-filled one and a wrong one are not credited.
      assert.equal(gradeAnswer(p, ""), false);
      assert.ok(p.hint.length > 20 && p.explanation.length >= 2);
      assert.equal(p.public.templateId, id);
    }
    const order = id.startsWith("show-work")
      ? ["build", "fill"]
      : ["build", "fill", "order"];
    assert.deepEqual([...modes].sort(), [...order].sort(), id);
    assert.ok(variants.size >= 2, `${id}: ${[...variants]}`);
  }
});

test("clients without structured-work-v1 are never served these families, online or offline", () => {
  const work = templates.filter((t) =>
    families.includes(t.id as (typeof families)[number]),
  );
  assert.equal(work.length, families.length);
  assert.ok(responseCapabilities.includes("structured-work-v1"));
  for (const t of work)
    assert.equal(t.requiredResponseCapability, "structured-work-v1");
  const older = [
    { responseCapabilities: [], figureCapabilities: [] },
    {
      responseCapabilities: [
        "single-choice-v1",
        "multi-select-v1",
        "point-plot-v1",
        "multi-part-choice-v1",
        "figure-choice-v1",
      ],
      figureCapabilities: ["scenes-v1"],
    },
  ];
  for (const client of older) {
    for (const t of work) assert.equal(clientCanDraw(t, client), false);
    const supported = templates.filter((t) => clientCanDraw(t, client));
    for (let seed = 0; seed < 12; seed++)
      for (const choice of planMixedPractice({
        templates: supported,
        skills,
        attempts: [],
        evidence: [],
        count: 5,
        seed: `negotiation-${seed}`,
        learnerKey: "learner",
      }))
        assert.notEqual(
          choice.template.requiredResponseCapability,
          "structured-work-v1",
        );
  }
  for (const t of work)
    assert.equal(
      clientCanDraw(t, {
        responseCapabilities: ["structured-work-v1"],
        figureCapabilities: ["scenes-v1"],
      }),
      true,
    );
  // Offline packs never declare it, and grader v1 rejects a structured item.
  assert.equal(
    capabilitySchema.safeParse({ responseCapabilities: ["structured-work-v1"] })
      .success,
    false,
  );
  const problem = generateProblem("solve-justify-linear", "offline");
  const pack = {
    format: "amp-offline-v1",
    serviceId: "https://example.invalid",
    accountBinding: "a".repeat(64),
    authorization: {
      consentRevision: "b".repeat(64),
      grantBinding: "c".repeat(64),
    },
    packId: "00000000-0000-4000-8000-000000000001",
    learnerId: "00000000-0000-4000-8000-000000000002",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T01:00:00.000Z",
    selectionPolicy: "mixed-five-three-variants-v1",
    evidence: "offline-provisional",
    capabilities: {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: [],
    },
    items: [
      {
        problem: problem.public,
        graderVersion: 1,
        reason: "frontier",
        strand: "algebra",
        selfCheck: {
          answer: problem.answer,
          hint: problem.hint,
          explanation: problem.explanation,
        },
      },
    ],
  };
  assert.equal(packSchema.safeParse(pack).success, false);
  // The same pack with a typed problem is accepted, so the rejection is the kind.
  const typed = generateProblem("count-objects", "offline");
  assert.equal(
    packSchema.safeParse({
      ...pack,
      items: [
        {
          ...pack.items[0]!,
          problem: typed.public,
          selfCheck: {
            answer: typed.answer,
            hint: typed.hint,
            explanation: typed.explanation,
          },
        },
      ],
    }).success,
    true,
  );
});

test("guessing typed work is impossible; the family chance covers every instance", () => {
  for (const id of families)
    for (let i = 0; i < 30; i++) {
      const p = generateProblem(id, `chance-${i}`);
      const r = p.public.response as StructuredWorkResponse;
      const chance = problemGuessChance(p);
      if (r.mode !== "order" && r.layout !== "proof")
        assert.equal(chance, 0, id);
      assert.ok(chance <= 1 / 2);
    }
});

test("content is registered: lessons, methods, principles, facets and archetypes", () => {
  for (const id of families) {
    assert.ok(
      lessons.some((l) => l.templateIds.includes(id)),
      `${id} lesson`,
    );
    assert.ok(methods[id]?.method.length, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    assert.ok(
      actualFacetMappings.some((m) => m.templateId === id),
      `${id} facet`,
    );
    assert.ok(templateArchetypes[id]?.length, `${id} archetype`);
    const t = templates.find((x) => x.id === id)!;
    assert.ok(
      skills.some((s) => s.id === t.skillId),
      `${id} skill`,
    );
  }
});

test("a lesson never works the learner's own problem, and print keeps every step", () => {
  for (const id of families) {
    const learner = generateProblem(id, "learner");
    const lesson = problemLesson(
      id,
      "learner",
      learner.public.prompt,
      learner.public.response,
      learner,
    );
    assert.notEqual(lesson.example.prompt, learner.public.prompt);
    assert.ok(lesson.example.steps.length >= 2);
    assert.ok(!lesson.example.answer.includes("[["), lesson.example.answer);
  }
  for (const id of [
    "solve-justify-linear",
    "two-column-congruence-proof",
    "show-work-box-cost",
  ]) {
    const lesson = lessons.find((l) => l.templateIds.includes(id))!;
    const workbook = publicationHtml(lesson, "workbook");
    const solutions = publicationHtml(lesson, "solutions");
    assert.match(workbook, /print-work/);
    assert.ok(!workbook.includes('[["'), "no transport in print");
    assert.match(solutions, /print-work/);
    assert.ok(!solutions.includes('[["'));
  }
});

test("answer text and keypad keys come from the public response", () => {
  const q = solveJustifyCases["solve-justify-quadratic"]("keys", {
    mode: "build",
    form: "standard",
    fill: "reasons",
  }).problem;
  const r = q.public.response as StructuredWorkResponse;
  const keys = keypadKeys(r);
  for (const k of ["x", "²", "=", "or", "(", ")"])
    assert.ok(keys.includes(k), k);
  assert.ok(!keys.includes("<"));
  assert.ok(keys.length <= 11);
  assert.match(answerText(r, q.answer), /or/);
  const ineq = solveJustifyCases["solve-justify-inequality"]("keys", {
    mode: "build",
    form: "grouped",
    fill: "reasons",
  }).problem;
  const ik = keypadKeys(ineq.public.response as StructuredWorkResponse);
  for (const k of ["<", ">", "≤", "≥"]) assert.ok(ik.includes(k), k);
  assert.ok(!ik.includes("="));
  const formula = solveJustifyCases["solve-justify-formula"]("keys", {
    mode: "build",
    fill: "reasons",
  }).problem;
  assert.ok(
    keypadKeys(formula.public.response as StructuredWorkResponse).length <= 11,
  );
});

export type { GeneratedProblem };

test("the independent oracle (scripts/structured_work_math_oracle.py) agrees on every family", () => {
  const cases = families.flatMap((id) =>
    Array.from({ length: 24 }, (_, i) =>
      generateProblem(id, `independent-unit-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,runpy
sys.path.insert(0,'scripts')
o=runpy.run_path('scripts/independent-math-review.py')
data=json.load(sys.stdin)
oracle=o['family_oracle']('structured_work_math_oracle')
assert set(data['ids'])==set(oracle.supported), sorted(oracle.supported)
oracle.self_test()
for p in data['cases']:
 o['solve'](p['public'])
 assert oracle.review_problem(p)==p['answer'], p['public']['templateId']
print(len(data['cases']))`,
    ],
    {
      input: JSON.stringify({ ids: families, cases }),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`${cases.length}`));
});

test("review findings: oversize comparisons, arithmetic steps, simplified answers, spaced numbers", () => {
  const p = solveJustifyCases["solve-justify-linear"]("review", {
    mode: "build",
    form: "grouped",
    fill: "reasons",
  }).problem;
  // Each line parses, but comparing them exceeds the size guard: not a
  // server error, simply not a valid step.
  const huge = JSON.stringify([
    ["xxxxxxxxxxxxx=1", "ad"],
    ["1/(xxxxxxxxxxxx)=1", "ad"],
  ]);
  assert.ok(isValidResponse(p.public, huge));
  assert.equal(gradeAnswer(p, huge), false);
  // Carrying out arithmetic is combining; reordering is only a permutation.
  const ok = (a: string, b: string, m: Parameters<typeof checkMove>[2]) =>
    checkMove(L(a), L(b), m).ok;
  assert.ok(ok("3x/3=15/3", "x=5", "combine"));
  assert.ok(!ok("3x/3=15/3", "x=5", "commute"));
  assert.ok(ok("x=10/2", "x=5", "combine"));
  assert.ok(ok("2+x=7", "x+2=7", "commute"));
  assert.ok(!ok("x+5=7", "x+2+3=7", "commute"));
  // A numeric answer is written as one number.
  const r = linearWork("build", [
    { id: "r1", fields: [lineField(), reasonField()] },
  ]);
  const unsimplified = markStructuredWork(
    r,
    linearGrading,
    JSON.stringify([
      ["3(x+2)=18", "su"],
      ["x+2=6", "di"],
      ["x=6-2", "su"],
    ]),
  );
  assert.equal(unsimplified.correct, false);
  assert.match(unsimplified.notes.at(-1)!, /single number/);
  // A space inside a number is an entry error, never a different number.
  const box = showWorkCases["show-work-box-cost"]("spaces", {
    mode: "build",
  }).problem;
  const rows = JSON.parse(box.answer) as string[][];
  rows[0] = ["22 1/2"];
  assert.equal(isValidResponse(box.public, JSON.stringify(rows)), false);
});

test("an ordering is never shown already solved, and a lesson never works the same givens in another mode", () => {
  for (const id of families)
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(id, `order-shown-${i}`);
      const r = p.public.response as StructuredWorkResponse;
      if (r.mode === "order")
        assert.equal(
          gradeAnswer(p, JSON.stringify(r.rows.map((row) => row.id))),
          false,
          `${id} ${i}`,
        );
    }
  for (const id of families)
    for (let i = 0; i < 30; i++) {
      const learner = generateProblem(id, `lesson-mode-${i}`);
      const lesson = problemLesson(
        id,
        `lesson-mode-${i}`,
        learner.public.prompt,
        learner.public.response,
        learner,
      );
      const r = learner.public.response as StructuredWorkResponse;
      if (r.start)
        assert.ok(!lesson.example.prompt.includes(r.start), `${id} ${i}`);
      // A proof is the same problem when its goal and figure match.
      if (r.goal)
        assert.ok(
          !(
            lesson.example.prompt.includes(r.goal) &&
            JSON.stringify(lesson.example.figure ?? null) ===
              JSON.stringify(learner.public.figure ?? null)
          ),
          `${id} ${i}`,
        );
    }
});

test("scientific notation reads as one typeset number, never caret text", () => {
  for (const seed of ["sci-0", "sci-1", "sci-2", "sci-3"]) {
    const problem = generateProblem("scientific-notation-work", seed);
    const response = problem.public.response;
    assert.equal(response.kind, "structured-work");
    if (response.kind !== "structured-work") continue;
    const text = structuredWorkAnswerText(response, problem.answer);
    // Every power base pairs with its exponent inside math.
    assert.match(text, /\$[\d.]+\\times10\^\{-?\d+\}\$/, text);
    // No caret or TeX command is left in prose, where MathText would
    // show it raw.
    const prose = text.replace(/\$[^$]*\$/g, "");
    assert.doesNotMatch(prose, /\^|\\times/, text);
  }
});
