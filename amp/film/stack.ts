/**
 * Column arithmetic, the way it is taught: the numbers stacked with their place
 * values (and decimal points) lined up, worked one column at a time from the
 * right, with carries or borrows written above. The kit computes every digit,
 * carry and borrow, so the screenplay only names the numbers and paces the
 * columns; the arithmetic cannot be wrong.
 */

export type StackOp = "+" | "-";
/** One column's step, right to left: the answer digit, and the marks written as it is worked. */
export type StackStep = {
  /** Column index (0 = leftmost place) of the answer digit written in this step. */
  col: number;
  digit: string;
  /** A carry written above the column to the left (addition). */
  carry?: { col: number; value: string };
  /** Digits of the top number crossed out and rewritten above (subtraction). */
  borrows: { col: number; value: string }[];
  /** On the last step of an addition, a final carry written as the answer's leading digit. */
  lead?: { col: number; digit: string };
};
export type StackPlan = {
  op: StackOp;
  /** Number of places left of the decimal point, and right of it. */
  int: number;
  frac: number;
  /** Each row's digit per column ("" where the row has no digit); `pad` marks a placeholder zero. */
  rows: { digit: string; pad: boolean }[][];
  answer: string[];
  steps: StackStep[];
};

const WHOLE = ["ones", "tens", "hundreds", "thousands", "ten thousands", "hundred thousands", "millions"];
const PART = ["tenths", "hundredths", "thousandths"];
/** The place each column holds, left to right ("tens", "ones", "tenths", "hundredths"): the stack's headers. */
export function placeNames(plan: Pick<StackPlan, "int" | "frac">): string[] {
  if (plan.int > WHOLE.length || plan.frac > PART.length) throw new Error(`stack: no place names for ${plan.int} whole and ${plan.frac} decimal places.`);
  return [...Array.from({ length: plan.int }, (_, c) => WHOLE[plan.int - 1 - c]!), ...PART.slice(0, plan.frac)];
}

const parse = (s: string) => {
  const [i, f = ""] = s.split(".");
  return { i: i!.replace(/^0+(?=\d)/, ""), f };
};

/** Plan the stacked algorithm, or explain why these numbers cannot be stacked. */
export function planStack(rows: string[], op: StackOp): StackPlan | string {
  if (rows.some((r) => !/^\d+(\.\d+)?$/.test(r))) return `stack rows must be plain numbers like "9.26" or "305"; got ${JSON.stringify(rows)}.`;
  if (op === "-" && rows.length !== 2) return "a subtraction stack has exactly two rows: the larger number on top.";
  if (rows.length < 2 || rows.length > 4) return "a stack has two to four rows.";
  const ps = rows.map(parse);
  const frac = Math.max(...ps.map((p) => p.f.length));
  const scaled = ps.map((p) => BigInt(p.i + p.f.padEnd(frac, "0")));
  if (op === "-" && scaled[0]! < scaled[1]!) return "in a subtraction stack the top number must be the larger one.";
  const total = op === "+" ? scaled.reduce((a, b) => a + b, 0n) : scaled[0]! - scaled[1]!;
  const operandInt = Math.max(...ps.map((p) => p.i.length));
  const totalStr = total.toString().padStart(frac + 1, "0");
  const totalInt = totalStr.length - frac;
  const int = Math.max(operandInt, totalInt);
  const width = int + frac;
  // digits per column, right-aligned on the point
  const grid = ps.map((p) => {
    const cells: { digit: string; pad: boolean }[] = Array.from({ length: width }, () => ({ digit: "", pad: false }));
    const iDigits = p.i.split("");
    iDigits.forEach((d, k) => { cells[int - iDigits.length + k] = { digit: d, pad: false }; });
    for (let k = 0; k < frac; k++) cells[int + k] = k < p.f.length ? { digit: p.f[k]!, pad: false } : { digit: "0", pad: true };
    return cells;
  });
  const answer = Array.from({ length: width }, () => "");
  const ansDigits = totalStr.split("");
  ansDigits.forEach((d, k) => { answer[width - ansDigits.length + k] = d; });
  // a whole-number answer keeps no leading zeros, except the one before a point ("0.04")
  for (let c = 0; c < int - 1 && answer[c] === "0"; c++) answer[c] = "";
  const val = (row: number, c: number) => Number(grid[row]![c]!.digit || "0");
  const firstCol = width - Math.max(...ps.map((p) => p.i.length)) - frac; // leftmost column any operand uses
  const steps: StackStep[] = [];
  if (op === "+") {
    let carry = 0;
    for (let c = width - 1; c >= firstCol; c--) {
      const sum = grid.reduce((a, _, r) => a + val(r, c), 0) + carry;
      carry = Math.floor(sum / 10);
      const step: StackStep = { col: c, digit: String(sum % 10), borrows: [] };
      if (carry && c > firstCol) step.carry = { col: c - 1, value: String(carry) };
      if (carry && c === firstCol) step.lead = { col: c - 1, digit: String(carry) };
      steps.push(step);
    }
  } else {
    const cur = grid[0]!.map((x) => Number(x.digit || "0"));
    for (let c = width - 1; c >= firstCol; c--) {
      const b = val(1, c);
      const borrows: { col: number; value: string }[] = [];
      if (cur[c]! < b) {
        let k = c - 1;
        while (k >= 0 && cur[k] === 0) k--;
        cur[k]! -= 1;
        borrows.push({ col: k, value: String(cur[k]) });
        for (let j = k + 1; j < c; j++) { cur[j] = 9; borrows.push({ col: j, value: "9" }); }
        cur[c]! += 10;
        borrows.push({ col: c, value: String(cur[c]) });
      }
      steps.push({ col: c, digit: String(cur[c]! - b), borrows });
    }
  }
  // a leading column that ends empty (the tens of 12.06 - 2.25) needs no step of its own
  while (steps.length) {
    const s = steps[steps.length - 1]!;
    if (answer[s.col] || s.carry || s.lead || s.borrows.length) break;
    steps.pop();
  }
  // the answer digits a step reveals must agree with the total (a guard on this function)
  for (const s of steps) if (answer[s.col] !== "" && answer[s.col] !== s.digit) return `internal: column ${s.col} gives ${s.digit}, the total says ${answer[s.col]}.`;
  return { op, int, frac, rows: grid, answer, steps };
}
