/** How MathText splits prose from mathematics: `$…$` is TeX as written;
 * elsewhere, runs of numbers, single-letter variables and operators that
 * contain an operation are formulas. Shared by the web renderer and the
 * glossary linker, which never links a word inside a formula. */
export type Segment = { text: string; math: boolean; plain?: string };
const MATHY = /^[\d.,()[\]+−×÷=<>≤≥≠/^_²³ⁿᵖ⁰¹⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉|√·□a-zA-Z-]+$/;
const OPERATION = /[=+−×÷<>≤≥≠/^_²³ⁿᵖ₀-₉√]|\b[a-z]\(|\d-|-\d|\b\d+[a-z]\b/;
const COORDINATE_PAIR =
  /^\(\s*[+−-]?\d+(?:\.\d+)?\s*,\s*[+−-]?\d+(?:\.\d+)?\s*\)$/;

/** A comma between ordered pairs is a wrapping opportunity; the comma inside
 * a pair (or another grouped expression) is not. */
function formulaClauses(formula: string): string[] {
  const parts: string[] = [];
  let start = 0;
  const groups: string[] = [];
  for (let i = 0; i < formula.length; i++) {
    const char = formula[i]!;
    if ("([{".includes(char)) groups.push(char);
    else if (")]}".includes(char)) groups.pop();
    else if (
      !groups.length &&
      /[,;:]/.test(char) &&
      /\s/.test(formula[i + 1] ?? "")
    ) {
      parts.push(formula.slice(start, i));
      let end = i + 1;
      while (/\s/.test(formula[end] ?? "")) end++;
      parts.push(formula.slice(i, end));
      start = end;
      i = end - 1;
    }
  }
  parts.push(formula.slice(start));
  return parts;
}

function mathyWord(word: string) {
  if (!MATHY.test(word)) return false;
  // A run of two or more letters is a word of prose, except log.
  const words = word.match(/[a-zA-Z]{2,}/g) ?? [];
  return words.every((w) => w === "log");
}

export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const push = (value: string, math: boolean) => {
    if (!value) return;
    const last = out.at(-1);
    if (last && last.math === math && !math) last.text += value;
    else out.push({ text: value, math });
  };
  // Explicit TeX first.
  text.split(/(\$[^$]+\$)/).forEach((part) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
      const formula = part.slice(1, -1);
      const pairs = formulaClauses(formula);
      // A numeric coordinate list can wrap between pairs even when its author
      // supplied TeX. Keep arbitrary TeX and each complete pair intact.
      if (
        pairs.length > 1 &&
        pairs.every((pair, i) =>
          i % 2 ? /^,\s+$/.test(pair) : COORDINATE_PAIR.test(pair),
        )
      ) {
        for (const [i, pair] of pairs.entries())
          if (i % 2) push(pair, false);
          else out.push({ text: pair, math: true, plain: pair });
      } else out.push({ text: formula, math: true, plain: formula });
      return;
    }
    // A question mark right after explicit TeX ends the sentence; it is
    // not a blank ("What is $\log_2 8$?").
    if (part.startsWith("?") && out.at(-1)?.math) {
      push("?", false);
      part = part.slice(1);
    }
    // A relation written as a set keeps each complete ordered pair together.
    // Braces remain visible punctuation rather than becoming TeX grouping.
    const set = /^(\s*\{\s*)(.*?)(\s*\}\s*)$/.exec(part);
    if (set) {
      const pairs = formulaClauses(set[2]!);
      if (
        pairs.every((pair, i) =>
          i % 2 ? /^,\s+$/.test(pair) : COORDINATE_PAIR.test(pair),
        )
      ) {
        push(set[1]!, false);
        for (const pair of pairs) {
          if (COORDINATE_PAIR.test(pair))
            out.push({ text: toTex(pair), math: true, plain: pair });
          else push(pair, false);
        }
        push(set[3]!, false);
        return;
      }
    }
    const words = part.split(/(\s+)/);
    let run: string[] = [];
    const flush = () => {
      if (!run.length) return;
      // Trailing punctuation belongs to the sentence, not the formula.
      let tail = "";
      let last = run[run.length - 1]!;
      const m = /[.,;:?!]+$/.exec(last);
      if (m && !/\d$/.test(last.slice(0, -m[0].length) || "")) {
        tail = m[0];
      } else if (m) tail = m[0];
      if (tail) {
        last = last.slice(0, -tail.length);
        run[run.length - 1] = last;
      }
      const formula = run.join("").trim();
      const lead = run.join("").match(/^\s*/)![0];
      const parts = formulaClauses(formula);
      if (
        formula &&
        (OPERATION.test(formula) ||
          parts.some((part) => COORDINATE_PAIR.test(part)))
      ) {
        push(lead, false);
        // Commas, colons and semicolons outside parentheses separate
        // formulas, so each clause typesets (and wraps) on its own.
        for (const [index, part] of parts.entries())
          if (
            /^[,:;]\s+$/.test(part) ||
            (!OPERATION.test(part) &&
              !COORDINATE_PAIR.test(part) &&
              !(
                /^[a-zA-Z]$/.test(part) &&
                /^[,:;]\s+$/.test(parts[index + 1] ?? "")
              ))
          )
            push(part, false);
          else out.push({ text: toTex(part), math: true, plain: part });
      } else push(run.join(""), false);
      push(tail, false);
      run = [];
    };
    for (const piece of words) {
      if (/^\s+$/.test(piece)) {
        if (run.length) run.push(piece);
        else push(piece, false);
        continue;
      }
      // A missing number ("?" or "□" standing alone) is part of the formula,
      // typeset as a blank box with the formula's own operator spacing.
      if (piece === "?" || piece === "□") {
        run.push("□");
        continue;
      }
      const bare = piece.replace(/[.,;:?!]+$/, "");
      if (bare && mathyWord(bare)) run.push(piece);
      else {
        // Keep trailing whitespace of the run outside the formula.
        const trailing: string[] = [];
        while (run.length && /^\s+$/.test(run[run.length - 1]!))
          trailing.unshift(run.pop()!);
        flush();
        trailing.forEach((t) => push(t, false));
        push(piece, false);
      }
    }
    const trailing: string[] = [];
    while (run.length && /^\s+$/.test(run[run.length - 1]!))
      trailing.unshift(run.pop()!);
    flush();
    trailing.forEach((t) => push(t, false));
  });
  return out;
}

const SUPERSCRIPT: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  ⁿ: "n",
  ᵖ: "p",
};
const SUBSCRIPT: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
};

export function toTex(formula: string): string {
  return (
    formula
      // A thousands separator is part of its numeral, not punctuation.
      .replace(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d,])/g, (n) =>
        n.replaceAll(",", "{,}"),
      )
      .replace(/log_(\w+)/g, "\\log_{$1}")
      .replace(/\blog\b/g, "\\log")
      .replace(
        /([⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵖ]+)/g,
        (m) => `^{${[...m].map((c) => SUPERSCRIPT[c]).join("")}}`,
      )
      .replace(
        /([₀-₉]+)/g,
        (m) => `_{${[...m].map((c) => SUBSCRIPT[c]).join("")}}`,
      )
      .replace(/\^\(([^()]+)\)/g, "^{$1}")
      .replace(/\^([\w.−-]+)/g, "^{$1}")
      .replace(/\(([^()]+)\)\/\(([^()]+)\)/g, "\\frac{$1}{$2}")
      .replace(/(\d+|[a-zA-Z])\/(\d+|[a-zA-Z])/g, "\\tfrac{$1}{$2}")
      .replace(/−/g, "-")
      .replace(/□/g, "\\boxed{\\phantom{0}}")
      .replace(/×/g, "\\times ")
      .replace(/÷/g, "\\div ")
      .replace(/≤/g, "\\le ")
      .replace(/≥/g, "\\ge ")
      .replace(/≠/g, "\\neq ")
      .replace(/·/g, "\\cdot ")
      .replace(/√/g, "\\sqrt ")
  );
}

