/**
 * The board's arithmetic, checked without rendering: every line whose sides are
 * plain numbers must be true. "19·6=114" passes, "19·6=104" is a problem.
 * Lines with a letter (x=6, 5x+3=18) are left to the reviewer.
 *
 *   npx tsx film/mathcheck.ts <template-id> [...]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "./expr";
import type { Script } from "./schema";

/** TeX to a plain expression, or null when it is not pure arithmetic. */
export function plain(tex: string): string | null {
  // words make a side a quantity with units ("10 ones", "50% of 80"): not plain arithmetic
  if (/\\(?:text|mathrm)\{[^{}]*[A-Za-z][^{}]*\}/.test(tex)) return null;
  let s = tex;
  s = s.replace(/\\(?:ca|cw|cg|cb|cv|cm)\{/g, "{");
  s = s.replace(/\\cancel\{[^{}]*\}/g, "");
  s = s.replace(/\\(?:text|mathrm)\{[^{}]*\}/g, " ");
  s = s.replace(/\\[,;: !]|\\quad|\\qquad|~/g, " ");
  s = s.replace(/\\left|\\right/g, "");
  s = s.replace(/\{,\}/g, "");
  for (let k = 0; k < 6; k++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))");
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)");
  s = s.replace(/\^\{([^{}]*)\}/g, "^($1)");
  s = s.replace(/\\cdot|\\times/g, "*").replace(/\\div/g, "/").replace(/−/g, "-").replace(/\\%|%/g, "/100");
  s = s.replace(/[{}]/g, "").replace(/\s+/g, "");
  // a decimal comma never appears; a thousands comma was removed above
  if (!s || /[a-zA-Z\\]/.test(s.replace(/sqrt/g, ""))) return null;
  return s;
}

const rel = /(\\ne|\\neq|\\le|\\leq|\\ge|\\geq|=|<|>)/;
/** Problems in one board line: each relation between two numeric sides must hold. */
export function checkLine(tex: string): string | null {
  const parts = tex.split(rel);
  if (parts.length < 3) return null;
  const vals: (number | null)[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const e = plain(parts[i]!);
    let v: number | null = null;
    if (e) { try { v = compile(e)(0); } catch { v = null; } }
    vals.push(v !== null && Number.isFinite(v) ? v : null);
  }
  for (let i = 1; i < parts.length; i += 2) {
    const a = vals[(i - 1) / 2], b = vals[(i + 1) / 2], r = parts[i]!;
    if (a === null || b === null) continue;
    const eq = Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
    const near = Math.abs(a - b) <= 0.051 * Math.max(1, Math.abs(b) / 100); // rounded answers ("about", nearest tenth)
    const ok = r === "=" ? eq : r === "<" ? a < b : r === ">" ? a > b : /\\ne/.test(r) ? !eq : /\\le/.test(r) ? a <= b + 1e-9 : a >= b - 1e-9;
    if (!ok && !(r === "=" && near && /\.\d$|\.\d\d$/.test(String(b)))) return `"${tex}" is false: ${a} ${r.replace("\\", "")} ${b}`;
  }
  return null;
}

/** The letters in a line, after colors and words are gone. */
const letters = (tex: string) => new Set((tex.replace(/\\(?:text|mathrm)\{[^{}]*\}/g, " ").replace(/\\[a-zA-Z]+/g, " ").match(/[a-zA-Z]/g) ?? []));
/** The same line with one letter replaced by a number. */
const substitute = (tex: string, v: string, value: number) =>
  tex.replace(/\\[a-zA-Z]+/g, (m) => m.replace(new RegExp(v, "g"), "\u0000")).replace(new RegExp(`(\\d)\\s*${v}`, "g"), `$1*(${value})`).replace(new RegExp(v, "g"), `(${value})`).replace(/\u0000/g, v);

/**
 * Every false line in a screenplay. Arithmetic lines must be true; in a worked
 * example, every line in one letter must hold for that example's answer (for one
 * of its answers, when there are two). Struck-out work (\cancel) is a mistake on
 * purpose and is skipped.
 */
export function mathProblems(script: Script) {
  const out: string[] = [];
  let col: { tex: string; si: number }[] = [];
  const flush = () => {
    // the column's answers: lines like "x=-6" or "x=2 or x=-3"
    const answers = new Map<string, number[]>();
    for (const { tex } of col) {
      const t = tex.replace(/\\(?:ca|cw|cg|cb|cv|cm)\{([^{}]*)\}/g, "$1");
      for (const piece of t.split(/\\(?:text|mathrm)\{\s*or\s*\}|\\quad|\\qquad|,/)) {
        const m = piece.replace(/\\[,;: !]/g, "").match(/^\s*([a-zA-Z])\s*=\s*([^=]+)$/);
        if (!m) continue;
        const e = plain(m[2]!);
        if (!e) continue;
        try { const v = compile(e)(0); if (Number.isFinite(v)) answers.set(m[1]!, [...(answers.get(m[1]!) ?? []), v]); } catch { /* not a number */ }
      }
    }
    for (const { tex, si } of col) {
      const ls = [...letters(tex)];
      if (ls.length !== 1 || !answers.has(ls[0]!) || !/=/.test(tex) || /,/.test(tex)) continue;
      const v = ls[0]!, values = answers.get(v)!;
      if (!values.some((x) => checkLine(substitute(tex, v, x)) === null)) out.push(`Shot ${si + 1}: the board line "${tex}" is false for ${v} = ${values.join(" or ")}, the answer it leads to. Fix the step.`);
    }
    col = [];
  };
  script.shots.forEach((shot, si) => {
    for (const b of shot.beats) for (const a of (b.do ?? []) as any[]) {
      if (a.do === "clear") flush();
      if ((a.do === "write" || a.do === "answer") && !/\\cancel/.test(a.tex)) {
        const p = checkLine(a.tex);
        if (p) out.push(`Shot ${si + 1}: the board line ${p}. Fix the arithmetic.`);
        col.push({ tex: a.tex, si });
      }
    }
  });
  flush();
  return out;
}

if (process.argv[1]?.endsWith("mathcheck.ts")) {
  const here = new URL(".", import.meta.url).pathname;
  let bad = 0;
  for (const id of process.argv.slice(2)) {
    const s = JSON.parse(readFileSync(join(here, "lessons", `${id}.json`), "utf8")) as Script;
    const p = mathProblems(s);
    bad += p.length;
    console.log(p.length ? `${id}:\n- ${p.join("\n- ")}` : `${id}: ok`);
  }
  process.exitCode = bad ? 1 : 0;
}
