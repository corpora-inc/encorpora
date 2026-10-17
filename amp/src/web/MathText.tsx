import katex from "katex";

/** Typesets mathematics inside prose. `$…$` is TeX as written; elsewhere,
 * runs of numbers, single-letter variables and operators that contain an
 * operation (=, +, −, ×, ÷, /, ^, …) are converted to TeX. Prose is untouched,
 * and anything KaTeX cannot parse falls back to the original text. */
export function MathText({ text }: { text: string }) {
  return (
    <>
      {segments(text).map((segment, i) =>
        segment.math ? (
          <span
            key={i}
            className="math"
            data-plain={segment.plain}
            dangerouslySetInnerHTML={{ __html: render(segment.text) }}
          />
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function render(tex: string) {
  try {
    return katex.renderToString(tex, {
      throwOnError: true,
      output: "htmlAndMathml",
    });
  } catch {
    return escape(tex);
  }
}
const escape = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`,
  );

type Segment = { text: string; math: boolean; plain?: string };
const MATHY = /^[\d.,()[\]+−×÷=<>≤≥≠/^_²³ⁿᵖ⁰¹⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉|√·a-zA-Z-]+$/;
const OPERATION = /[=+−×÷<>≤≥≠/^_²³ⁿᵖ₀-₉√]|\b[a-z]\(|\d-|-\d|\b\d+[a-z]\b/;

function mathyWord(word: string) {
  if (!MATHY.test(word)) return false;
  // A run of two or more letters is a word of prose, except log.
  const words = word.match(/[a-zA-Z]{2,}/g) ?? [];
  return words.every((w) => w === "log");
}

function segments(text: string): Segment[] {
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
      out.push({
        text: part.slice(1, -1),
        math: true,
        plain: part.slice(1, -1),
      });
      return;
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
      if (formula && OPERATION.test(formula)) {
        push(lead, false);
        // Commas outside parentheses separate prose from formulas.
        const parts = formula.includes("(")
          ? [formula]
          : formula.split(/([,:]\s+)/);
        for (const part of parts)
          if (/^[,:]\s+$/.test(part) || !OPERATION.test(part))
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
  return formula
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
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\neq ")
    .replace(/·/g, "\\cdot ")
    .replace(/√/g, "\\sqrt ");
}
