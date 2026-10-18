/** Conservative print notation. Unrecognized input is never repaired or evaluated. */
export type PrintSegment =
  | { kind: "text"; source: string }
  | { kind: "math"; source: string; tex: string };

const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵖ⁻⁺";
const superscriptValues = "0123456789np-+";
const subscripts = "₀₁₂₃₄₅₆₇₈₉ₙ";
const subscriptValues = "0123456789n";
const nonVariables = new Set([
  "an",
  "as",
  "at",
  "be",
  "by",
  "do",
  "he",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "no",
  "of",
  "on",
  "or",
  "so",
  "to",
  "up",
  "us",
  "we",
  "mm",
  "cm",
  "dm",
  "km",
  "mg",
  "kg",
  "ml",
  "hz",
  "ft",
  "yd",
  "mi",
  "oz",
  "lb",
]);
const isIdentifier = (word: string) =>
  word === "log" ||
  (!nonVariables.has(word.toLowerCase()) &&
    (/^[A-Za-z]{1,2}$/.test(word) || /^[A-Z]{3}$/.test(word)));
const numberPattern = /^(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?/;
type Token = { value: string; start: number; end: number };
type Expression = {
  tex: string;
  kind: string;
  end: number;
  inner?: Expression;
};

function tokens(source: string): Token[] | null {
  const result: Token[] = [];
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i]!)) {
      i++;
      continue;
    }
    const rest = source.slice(i);
    const value =
      numberPattern.exec(rest)?.[0] ??
      /^[A-Za-z]+/.exec(rest)?.[0] ??
      /^[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵖ⁻⁺]+/.exec(rest)?.[0] ??
      /^[₀₁₂₃₄₅₆₇₈₉ₙ]+/.exec(rest)?.[0] ??
      /^[()+−\-±×*·÷/^_=<>≤≥≠√%]/.exec(rest)?.[0];
    if (!value || (/^[A-Za-z]/.test(value) && !isIdentifier(value)))
      return null;
    // Adjacent letters are separate variables, never a word or a function name.
    if (/^[A-Za-z]{2,}$/.test(value) && value !== "log") {
      for (let j = 0; j < value.length; j++)
        result.push({ value: value[j]!, start: i + j, end: i + j + 1 });
    } else result.push({ value, start: i, end: i + value.length });
    i += value.length;
  }
  return result;
}

/** Convert a complete, explicitly mathematical expression, or return null.
 * Supports decimal numbers, single-letter variables, adjacent products, grouping,
 * powers/subscripts, arithmetic, comparisons, square roots, and based logarithms.
 * Mixed numbers, units, and 1/2x are deliberately unsupported. Slashes associate
 * from left to right, preserving the standard order of repeated division.
 */
export function expressionToTex(source: string): string | null {
  if (!source.trim() || source.length > 1024) return null;
  const input = tokens(source) ?? [];
  if (!input.length || input.length > 256) return null;
  let index = 0,
    depth = 0;
  const peek = () => input[index]?.value;
  const take = () => {
    const token = input[index++];
    if (!token) throw new Error("Missing operand");
    return token;
  };
  const node = (
    tex: string,
    kind: string,
    end: number,
    inner?: Expression,
  ): Expression => ({ tex, kind, end, inner });
  const inside = (value: Expression) =>
    value.kind === "group" ? value.inner!.tex : value.tex;
  const startsAtom = (value: string | undefined) =>
    value !== undefined &&
    (/^[0-9A-Za-z]/.test(value) || value === "(" || value === "√");
  const relationOperators: Record<string, string> = {
    "=": "=",
    "<": "<",
    ">": ">",
    "≤": "\\le",
    "≥": "\\ge",
    "≠": "\\ne",
  };

  function atom(): Expression {
    const token = take();
    if (++depth > 32) throw new Error("Expression nesting limit");
    let value: Expression;
    if (token.value === "(") {
      const inner = relation();
      const close = take();
      if (close.value !== ")") throw new Error("Unclosed group");
      value = node(`(${inner.tex})`, "group", close.end, inner);
    } else if (/^[0-9]/.test(token.value)) {
      value = node(token.value.replaceAll(",", "{,}"), "number", token.end);
    } else if (/^[A-Za-z]$/.test(token.value)) {
      value = node(token.value, "variable", token.end);
    } else if (token.value === "√") {
      // Written parentheses close the radicand before any following outer power.
      const radicand = peek() === "(" ? atom() : power();
      // Without a written group, a following product has ambiguous radical scope.
      if (radicand.kind !== "group" && startsAtom(peek()))
        throw new Error("Ambiguous radical scope");
      value = node(`\\sqrt{${inside(radicand)}}`, "root", radicand.end);
    } else if (token.value === "log") {
      if (take().value !== "_")
        throw new Error("Logarithm needs an explicit base");
      const base = atom();
      const argument = atom();
      if (
        peek() === "^" ||
        peek() === "_" ||
        (peek() && superscripts.includes(peek()![0]!))
      )
        throw new Error(
          "Logarithm powers need explicit argument or result grouping",
        );
      value = node(
        `\\log_{${inside(base)}}{${argument.tex}}`,
        "log",
        argument.end,
      );
    } else throw new Error("Unsupported operand");
    depth--;
    return value;
  }

  function power(): Expression {
    let base = atom();
    if (peek() === "_" || (peek() && subscripts.includes(peek()![0]!))) {
      const sub = take();
      let indexTex: string;
      if (sub.value === "_") {
        const lower = atom();
        indexTex = inside(lower);
        base = node(base.tex, base.kind, lower.end, base.inner);
      } else
        indexTex = [...sub.value]
          .map((c) => subscriptValues[subscripts.indexOf(c)])
          .join("");
      base = node(
        `${base.tex}_{${indexTex}}`,
        "subscript",
        Math.max(base.end, sub.end),
      );
    }
    if (peek() === "^" || (peek() && superscripts.includes(peek()![0]!))) {
      const exponent = take();
      let upper: Expression;
      if (exponent.value === "^") {
        const sign =
          peek() === "−" || peek() === "-" || peek() === "+"
            ? take().value.replace("−", "-")
            : "";
        upper = atom();
        // An external sign applies to the whole written exponent group.
        upper = node(
          sign + (sign ? upper.tex : inside(upper)),
          "exponent",
          upper.end,
        );
      } else {
        const text = [...exponent.value]
          .map((c) => superscriptValues[superscripts.indexOf(c)])
          .join("");
        if (!/^[+-]?(?:[0-9]+|[np])$/.test(text))
          throw new Error("Unsupported exponent");
        upper = node(text, "exponent", exponent.end);
      }
      const groupedBase = base.kind === "group" ? `{${base.tex}}` : base.tex;
      base = node(`${groupedBase}^{${upper.tex}}`, "power", upper.end);
    }
    if (peek() === "%") base = node(`${base.tex}\\%`, "percent", take().end);
    return base;
  }

  function signed(): Expression {
    if (peek() === "+" || peek() === "−" || peek() === "-") {
      const sign = take().value.replace("−", "-");
      const value = power();
      return node(sign + value.tex, "signed", value.end);
    }
    return power();
  }

  function product(): Expression {
    let left = signed();
    let factorPrefix = "";
    let factor = left;
    while (
      ["×", "*", "·", "÷", "/"].includes(peek() ?? "") ||
      startsAtom(peek())
    ) {
      const explicit = ["×", "*", "·", "÷", "/"].includes(peek() ?? "");
      const operator = explicit ? take().value : "implicit";
      if (
        !explicit &&
        (input[index]!.start !== left.end ||
          left.kind === "fraction" ||
          left.kind === "percent")
      ) {
        throw new Error("Ambiguous implicit product or mixed number");
      }
      const right = signed();
      if (!explicit && right.kind === "number")
        throw new Error("Adjacent numbers need an operator");
      if (operator === "/") {
        // Keep each explicitly multiplied fraction as a visible factor. A
        // division chain still associates left to right, including after ÷.
        factor = node(
          `\\frac{${inside(factor)}}{${inside(right)}}`,
          "fraction",
          right.end,
        );
        left = node(
          factorPrefix + factor.tex,
          "fraction",
          right.end,
        );
      } else {
        const symbol =
          operator === "implicit"
            ? ""
            : operator === "÷"
              ? " \\div "
              : operator === "·"
                ? " \\cdot "
                : " \\times ";
        factorPrefix = ["×", "*", "·"].includes(operator)
          ? left.tex + symbol
          : "";
        left = node(left.tex + symbol + right.tex, "product", right.end);
        factor = factorPrefix ? right : left;
      }
    }
    return left;
  }

  function sum(): Expression {
    let left = product();
    while (["+", "−", "-", "±"].includes(peek() ?? "")) {
      const operator = take().value;
      const right = product();
      left = node(
        `${left.tex} ${operator === "±" ? "\\pm" : operator.replace("−", "-")} ${right.tex}`,
        "sum",
        right.end,
      );
    }
    return left;
  }

  function relation(): Expression {
    let left = sum();
    while (peek() && Object.hasOwn(relationOperators, peek()!)) {
      const operator = relationOperators[take().value]!;
      const right = sum();
      left = node(
        `${left.tex} ${operator} ${right.tex}`,
        "relation",
        right.end,
      );
    }
    return left;
  }

  try {
    const result = relation();
    return index === input.length ? result.tex : null;
  } catch {
    return null;
  }
}

/** Segment prose without discarding a character. Concatenating `source` exactly
 * reconstructs the input. Explicit TeX uses \(...\); legacy $...$ is recognized
 * only for clear mathematical content, never a pair of currency amounts.
 */
export function segmentPrintText(text: string): PrintSegment[] {
  const segments: PrintSegment[] = [];
  const plain = (source: string) => {
    if (!source) return;
    const last = segments.at(-1);
    if (last?.kind === "text") last.source += source;
    else segments.push({ kind: "text", source });
  };
  function prose(source: string) {
    // These prose operands and labels are outside the expression grammar. Keep
    // their complete context rather than turning a trailing binary sign into
    // a unary sign, or a range/ordinal/label into arithmetic.
    if (
      /□|\b(?:mm|cm|dm|km|mg|kg|ml|hz|ft|yd|mi|oz|lb)\s*[+−-]/i.test(source) ||
      (/[A-Za-z][+−-]\d/.test(source) && expressionToTex(source) === null) ||
      /\b(?:of|Row|Day)\s+\d+\s*(?:[+−-]|=)/i.test(source) ||
      /\b(?:\d+|[A-Z])-\d+|\b\d+(?:st|nd|rd|th|s)\b|\bTerm\s+\d+\s*=/i.test(source)
    ) {
      plain(source);
      return;
    }
    let run = "";
    const flush = () => {
      if (!run) return;
      const candidate = run.trim();
      const tex = /^[+−-]\s/.test(candidate)
        ? null
        : expressionToTex(candidate);
      // Single prose letters (notably the articles A/a) are not formula delimiters.
      const mathematical =
        /[=+−\-±×*·÷/^_<>≤≥≠√%⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵖ₀-₉ₙ]/.test(candidate) ||
        /^[xyz]$/.test(candidate) ||
        /[0-9][A-Za-z]|\)\(/.test(candidate);
      if (tex !== null && mathematical) {
        const leading = run.match(/^\s*/)![0];
        const trailing = run.match(/\s*$/)![0];
        plain(leading);
        segments.push({ kind: "math", source: candidate, tex });
        plain(trailing);
      } else plain(run);
      run = "";
    };
    const pieces =
      source.match(
        /\$[+-]?(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?(?:\/[A-Za-z]+)?|(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]+)?|[A-Za-z]+|[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵖ⁻⁺]+|[₀₁₂₃₄₅₆₇₈₉ₙ]+|\s+|./gu,
      ) ?? [];
    for (const piece of pieces) {
      const eligible =
        /^\s+$/.test(piece) ||
        /^[0-9]/.test(piece) ||
        (/^[A-Za-z]+$/.test(piece) && isIdentifier(piece)) ||
        /^[()+−\-±×*·÷/^_=<>≤≥≠√%⁰¹²³⁴⁵⁶⁷⁸⁹ⁿᵖ⁻⁺₀₁₂₃₄₅₆₇₈₉ₙ]+$/.test(piece);
      if (eligible) run += piece;
      else {
        flush();
        plain(piece);
      }
    }
    flush();
  }
  let previous = 0;
  const explicitPattern = /\\\(([\s\S]*?)\\\)|\$([^$\n]+)\$/g;
  let match: RegExpExecArray | null;
  while ((match = explicitPattern.exec(text))) {
    const source = match[0],
      tex = match[1] ?? match[2]!;
    const converted = expressionToTex(tex);
    const isTex = match[1] !== undefined || /\\[A-Za-z]+/.test(tex);
    const explicit =
      isTex ||
      (converted !== null && /[A-Za-z=+−\-×÷/^_<>≤≥≠√]/.test(tex));
    if (!explicit) {
      // A currency marker must not consume the opening delimiter of later TeX.
      explicitPattern.lastIndex = match.index + 1;
      continue;
    }
    prose(text.slice(previous, match.index));
    segments.push({ kind: "math", source, tex: isTex ? tex : converted! });
    previous = match.index + source.length;
  }
  prose(text.slice(previous));
  return segments;
}
