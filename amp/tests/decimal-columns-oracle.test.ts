import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

/*
 * Hand-built version 3 "multidigit-decimal-sum" payloads (aligned columns with
 * regrouping marks), checked by the independent place-value oracle. Every
 * expected digit and mark below is worked by hand; nothing here calls the
 * generator.
 */

type Entry = { field: [number, number] } | { given: string };
type Field = { kind: "number"; label: string; given?: string };
type Columns = {
  /** Prompt operation as written in TeX: "+", "-" or "−". */
  op: string;
  a: string;
  b: string;
  lines: [string[], string[]];
  /** Per column: an answer digit, "." or "" (blank). */
  answer: string[];
  /** Per column: the regrouping mark's value, or null. */
  marks: (string | null)[];
};

/** One row per column, right to left, holding [mark?, digit?]. */
function build(c: Columns) {
  const rows: { id: string; label: string; fields: Field[] }[] = [];
  const key: string[][] = [];
  const answer: Entry[] = c.answer.map((d) => ({ given: d }));
  const marks: (Entry | null)[] = c.marks.map(() => null);
  for (let col = c.answer.length - 1; col >= 0; col--) {
    const fields: Field[] = [];
    const values: string[] = [];
    const mark = c.marks[col];
    if (mark != null) {
      marks[col] = { field: [rows.length, fields.length] };
      fields.push({ kind: "number", label: `Mark ${col}` });
      values.push(mark);
    }
    const digit = c.answer[col]!;
    if (/^\d$/.test(digit)) {
      answer[col] = { field: [rows.length, fields.length] };
      fields.push({ kind: "number", label: `Digit ${col}` });
      values.push(digit);
    }
    if (fields.length) {
      rows.push({ id: `c${col}`, label: `Column ${col}`, fields });
      key.push(values);
    }
  }
  return {
    public: {
      templateId: "multidigit-decimal-sum",
      seed: "hand-built",
      prompt: `Use aligned columns to find $${c.a}${c.op}${c.b}$.`,
      response: {
        kind: "structured-work",
        label: "Aligned columns",
        layout: "steps",
        mode: "fill",
        banks: [],
        rows,
        diagram: {
          kind: "columns",
          operation: c.op === "+" ? "+" : "−",
          lines: c.lines,
          answer,
          marks,
        },
      },
    },
    answer: JSON.stringify(key),
  };
}

type Problem = ReturnType<typeof build>;
const cases: { name: string; ok: boolean; problem: unknown }[] = [];
const accept = (name: string, c: Columns) =>
  cases.push({ name, ok: true, problem: build(c) });
const reject = (
  name: string,
  c: Columns,
  alter: (p: Problem) => void = () => {},
) => {
  const problem = build(c);
  alter(problem);
  cases.push({ name, ok: false, problem });
};

const noMarks = (n: number) => Array<null>(n).fill(null);

// 2.32 − 1.31 = 1.01: every top digit covers its bottom digit.
const s0: Columns = {
  op: "-",
  a: "2.32",
  b: "1.31",
  lines: [
    ["2", ".", "3", "2"],
    ["1", ".", "3", "1"],
  ],
  answer: ["1", ".", "0", "1"],
  marks: noMarks(4),
};
accept("2.32-1.31 no marks", s0);
// 2.32 − 1.27 = 1.05: hundredths 2 → 12, tenths lends: 3 → 2.
accept("2.32-1.27 marks tenths 2, hundredths 12", {
  op: "−",
  a: "2.32",
  b: "1.27",
  lines: [
    ["2", ".", "3", "2"],
    ["1", ".", "2", "7"],
  ],
  answer: ["1", ".", "0", "5"],
  marks: [null, null, "2", "12"],
});
// 2.32 − 1.37 = 0.95: hundredths 12; tenths 3−1 = 2 < 3 → 12; ones 2 → 1.
const s1: Columns = {
  op: "-",
  a: "2.32",
  b: "1.37",
  lines: [
    ["2", ".", "3", "2"],
    ["1", ".", "3", "7"],
  ],
  answer: ["0", ".", "9", "5"],
  marks: ["1", null, "12", "12"],
};
accept("2.32-1.37 marks ones 1, tenths 12, hundredths 12", s1);
// 5.12 − 1.37 = 3.75: hundredths 12; tenths 1−1 = 0 < 3 → 10; ones 5 → 4.
const s2: Columns = {
  op: "-",
  a: "5.12",
  b: "1.37",
  lines: [
    ["5", ".", "1", "2"],
    ["1", ".", "3", "7"],
  ],
  answer: ["3", ".", "7", "5"],
  marks: ["4", null, "10", "12"],
};
accept("5.12-1.37 marks ones 4, tenths 10, hundredths 12", s2);
// 5.12 − 1.07 = 4.05: tenths lends down to 0 and needs no borrow.
accept("5.12-1.07 mark of 0 over tenths", {
  op: "-",
  a: "5.12",
  b: "1.07",
  lines: [
    ["5", ".", "1", "2"],
    ["1", ".", "0", "7"],
  ],
  answer: ["4", ".", "0", "5"],
  marks: [null, null, "0", "12"],
});
// 2.05 − 1.37 = 0.68: borrowing through a 0 tenths: 0 → 9.
accept("2.05-1.37 borrow through zero", {
  op: "-",
  a: "2.05",
  b: "1.37",
  lines: [
    ["2", ".", "0", "5"],
    ["1", ".", "3", "7"],
  ],
  answer: ["0", ".", "6", "8"],
  marks: ["1", null, "9", "15"],
});
// 1.05 − 1.01 = 0.04: the ones digit 0 is still written.
const s3: Columns = {
  op: "-",
  a: "1.05",
  b: "1.01",
  lines: [
    ["1", ".", "0", "5"],
    ["1", ".", "0", "1"],
  ],
  answer: ["0", ".", "0", "4"],
  marks: noMarks(4),
};
accept("1.05-1.01 leading zero", s3);
// 1.23 + 2.34 = 3.57: no carries.
accept("1.23+2.34 no marks", {
  op: "+",
  a: "1.23",
  b: "2.34",
  lines: [
    ["1", ".", "2", "3"],
    ["2", ".", "3", "4"],
  ],
  answer: ["3", ".", "5", "7"],
  marks: noMarks(4),
});
// 4.56 + 3.78 = 8.34: 6+8 = 14 carries into tenths; 5+7+1 = 13 into ones.
const a1: Columns = {
  op: "+",
  a: "4.56",
  b: "3.78",
  lines: [
    ["4", ".", "5", "6"],
    ["3", ".", "7", "8"],
  ],
  answer: ["8", ".", "3", "4"],
  marks: ["1", null, "1", null],
};
accept("4.56+3.78 carries into tenths and ones", a1);
// 8.99 + 1.01 = 10.00: a tens column; its 1 is the answer, not a mark.
const a2: Columns = {
  op: "+",
  a: "8.99",
  b: "1.01",
  lines: [
    ["", "8", ".", "9", "9"],
    ["", "1", ".", "0", "1"],
  ],
  answer: ["1", "0", ".", "0", "0"],
  marks: [null, "1", null, "1", null],
};
accept("8.99+1.01 new tens column", a2);

// 2.3 − 1.25 = 1.05: written 2.30 / 1.25; hundredths 0 → 10, tenths 3 → 2.
accept("2.3-1.25 annexed zero", {
  op: "-",
  a: "2.3",
  b: "1.25",
  lines: [
    ["2", ".", "3", "0"],
    ["1", ".", "2", "5"],
  ],
  answer: ["1", ".", "0", "5"],
  marks: [null, null, "2", "10"],
});
// 3 − 1.01 = 1.99: written 3.00 / 1.01; borrowing through two zeros.
const s4: Columns = {
  op: "−",
  a: "3",
  b: "1.01",
  lines: [
    ["3", ".", "0", "0"],
    ["1", ".", "0", "1"],
  ],
  answer: ["1", ".", "9", "9"],
  marks: ["2", null, "9", "10"],
};
accept("3-1.01 whole number minus hundredths", s4);
// 4.56 − 4.56 = 0.00: every answer digit is 0, nothing regroups.
accept("4.56-4.56 difference zero", {
  op: "-",
  a: "4.56",
  b: "4.56",
  lines: [
    ["4", ".", "5", "6"],
    ["4", ".", "5", "6"],
  ],
  answer: ["0", ".", "0", "0"],
  marks: noMarks(4),
});

reject("prompt keeps a trailing zero", { ...s4, a: "3.00" });
reject("annexed zeros left blank in the line", {
  ...s4,
  lines: [["3", ".", "", ""], s4.lines[1]],
});
reject("carry marks shifted one column right", {
  ...a1,
  marks: [null, null, "1", "1"],
});
reject("missing borrow mark over ones", {
  ...s2,
  marks: [null, null, "10", "12"],
});
reject("mark where no regrouping happens", {
  ...s0,
  marks: [null, null, "3", null],
});
reject("box over the new leading tens column", {
  ...a2,
  marks: ["1", "1", null, "1", null],
});
reject("bottom line misaligned (ones digit in the tens column)", {
  ...a2,
  lines: [a2.lines[0], ["1", "", ".", "0", "1"]],
});
reject("bottom line right-aligned on its last digit, point off", {
  ...a2,
  lines: [a2.lines[0], ["", "", "1", ".", "0"]],
});
reject("lines swapped for subtraction", {
  ...s2,
  lines: [s2.lines[1], s2.lines[0]],
});
reject("wrong mark value in the key", {
  ...s2,
  marks: ["4", null, "10", "11"],
});
reject("wrong answer digit in the key", {
  ...a1,
  answer: ["8", ".", "4", "4"],
});
reject("leading zero printed blank instead of entered", {
  ...s3,
  answer: ["", ".", "0", "4"],
});
reject("ASCII minus in the diagram operation", s1, (p) => {
  p.public.response.diagram.operation = "-";
});
reject("a field placed twice", a1, (p) => {
  p.public.response.diagram.marks[0] = p.public.response.diagram.answer[0]!;
});
reject("a learner field left out of the diagram", s0, (p) => {
  p.public.response.rows[0]!.fields.push({ kind: "number", label: "Extra" });
  const key = JSON.parse(p.answer) as string[][];
  key[0]!.push("0");
  p.answer = JSON.stringify(key);
});

// Version 2 (no diagram): [[hundredths digit, regroup count], [whole answer]].
const v2 = (prompt: string, answer: string) => ({
  public: {
    templateId: "multidigit-decimal-sum",
    seed: "hand-built",
    prompt,
    response: {
      kind: "structured-work",
      label: "Aligned columns",
      layout: "steps",
      mode: "fill",
      banks: [],
      rows: [
        {
          id: "hundredths",
          fields: [
            { kind: "number", label: "Hundredths digit" },
            { kind: "number", label: "Regroups" },
          ],
        },
        { id: "result", fields: [{ kind: "number", label: "Answer" }] },
      ],
    },
  },
  answer,
});
cases.push({
  name: "v2 subtraction still checked",
  ok: true,
  problem: v2(
    "Use aligned columns to find $5.12-1.37$.",
    '[["5","1"],["3.75"]]',
  ),
});
cases.push({
  name: "v2 wrong regroup count rejected",
  ok: false,
  problem: v2(
    "Use aligned columns to find $4.56+3.78$.",
    '[["4","0"],["8.34"]]',
  ),
});

test("aligned-column decimal sums: the oracle checks columns, answer digits and regrouping marks", () => {
  const result = spawnSync(
    "python3",
    [
      "-I",
      "-c",
      `
import json, sys
sys.path.insert(0, 'scripts')
import clause_place_value_math_oracle as oracle
out = []
for case in json.load(sys.stdin):
    try:
        oracle.review_problem(case['problem'])
        out.append([case['name'], True, ''])
    except ValueError as error:
        out.append([case['name'], False, str(error)])
print(json.dumps(out))
`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", timeout: 20_000 },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  const outcomes = JSON.parse(result.stdout) as [string, boolean, string][];
  assert.equal(outcomes.length, cases.length);
  const wrong = outcomes
    .map(([name, ok, error], i) => ({ name, ok, error, want: cases[i]!.ok }))
    .filter((o) => o.ok !== o.want);
  assert.deepEqual(wrong, []);
  if (process.env.ORACLE_REASONS) console.log(outcomes);
});
