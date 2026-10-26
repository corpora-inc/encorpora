import katex from "katex";
import { segments } from "../../src/web/MathText";
import { segmentPrintText } from "../../src/content/math-typesetting";
import { generateProblem, templates } from "../../src/math/engine";
import { methods } from "../../src/content/problem-methods";
import { principles } from "../../src/content/problem-principles";
import { lessons } from "../../src/content/lessons";

/** Mathematical typography: every symbol, variable, expression or equation a
 * learner reads is typeset as math (src/content/AGENTS.md). A text is read by
 * two typesetters, MathText in the app and PrintMathText in lessons and print,
 * so prose is whatever either one leaves as prose. */

export type Issue = { rule: string; excerpt: string; index?: number };

/** The one place the word may name the number: "the ratio $\pi$ (pi)". */
const NAMING = /\$\\pi\$ \(pi\)/g;

/** Explicit allowlist. Each entry is prose that looks like a lone letter. */
export const ALLOWED: readonly [RegExp, string][] = [
  [/\b(?:e\.g\.|i\.e\.|a\.m\.|p\.m\.)/g, "Latin abbreviations are prose"],
  [
    /\b(?:[LTUV]-shaped?|[LTU] shapes?|T-shirts?|U-turns?|X-rays?)\b|\b[LT]-(?= or\b)|\b(?:an|the) L\b(?! =)/g,
    "a letter that names a shape (an L-shaped face), not a quantity",
  ],
  [
    /\bletters [A-Z] through [A-Z]\b/g,
    "letters of the alphabet named as letters (the letters A through E)",
  ],
  [
    /(?<=°\s?)[CF]\b|(?<=\d\s?)(?:m|g|L|s|h)\b(?![-=])|(?<=\b(?:in|[Ee]ach|per) )(?:m|g|L)\b(?![-=])/g,
    "a unit symbol (8 m, 2 L, 4°C, length in m) is text, like any unit",
  ],
];

const relation = "=<>≤≥≠";
const letter = "[A-Za-z]";
const lone = (l: string) =>
  `(?<![\\p{L}\\p{N}'’_\\\\])${l}(?![\\p{L}\\p{N}'’_])`;

const EQUATION: [string, RegExp][] = [
  [
    "letter beside a relation",
    new RegExp(`${lone(letter)}\\s*[${relation}]`, "u"),
  ],
  [
    "relation beside a letter",
    new RegExp(`[${relation}]\\s*${lone(letter)}`, "u"),
  ],
  [
    "number times a letter",
    new RegExp(
      `\\d\\s*[×·*]\\s*${lone(letter)}|${lone(letter)}\\s*[×·*]\\s*\\d`,
      "u",
    ),
  ],
  ["caret", /\^/],
  ["square root", /\bsqrt\b|√/],
  ["π outside math", /π/],
  ["∠ outside math", /∠/],
  // A named point, segment, line, ray, angle or polygon (segment AB,
  // triangle ABC) is math, like a single point ($P$).
  [
    "bare point name",
    /\b(?:[Ss]egments?|[Ss]ides?|[Ll]ines?|[Rr]ays?|[Cc]hords?|[Aa]rcs?|[Tt]riangles?|[Aa]ngles?|[Qq]uadrilaterals?|[Pp]olygons?|[Pp]entagons?|[Hh]exagons?|[Pp]arallelograms?|[Tt]rapezoids?|[Ss]quares?|[Rr]ectangles?|[Vv]ertices|[Dd]iagonals?|[Pp]oints?|[Dd]iameters?|[Rr]adius|[Rr]adii|[Tt]angents?|[Ss]ecants?|[Cc]ircles?)\s+[A-Z]{2,4}′?(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])[A-Z]{2,3}′?(?:\s*[=<>≤≥≠²]|\s+:)/u,
  ],
];

/** A capitalized noun before a letter makes the letter a name ("Store A",
 * "Shape B", "Choice C"): a label for an object in the story or a figure, set
 * as prose like any name. Points, vertices, events and quantities are not
 * names; they are math ($A$, $P(B)$). */
export const NAMING_NOUNS =
  "store|plan|offer|shirt|set|region|option|choice|class|team|group|school|company|brand|shape|figure|picture|piece|pattern|rectangle|strip|rod|tile|panel|bar|tower|stack|line|graph|table|function|model|rule|machine|recipe|garden|clock|card|spinner|box|prism|ball|bag|glass|mug|cup|jar|bottle|bucket|pitcher|bowl|vase|pot|tub|tank|pool|container|basket|tray|block|toy|book|pencil|stick|ribbon|rope|string|crayon|car|train|bus|runner|bike|phone|account|job|trip|path|route|survey";
const NAMED = new RegExp(
  `\\b(?:${NAMING_NOUNS})s?\\s+(?:\\(\\s*)?([A-Z](?:(?:,\\s*|\\s+(?:and|or)\\s+)[A-Z])*)(?![\\p{L}\\p{N}])`,
  "giu",
);
/** Letters a text introduces as names. */
export function namedLetters(text: string): Set<string> {
  const found = new Set<string>();
  for (const m of text.matchAll(NAMED))
    for (const l of m[1]!.match(/\b[A-Z]\b/g) ?? []) found.add(l);
  return found;
}

export type Context = { variables?: Set<string>; names?: Set<string> };

/** English words that follow a variable but never the article "a". */
const VARIABLE_FOLLOWERS =
  "is|are|was|and|or|to|lies|has|equals|stays|appears|varies|changes|increases|decreases";

/** A text as one typesetter reads it, each formula replaced by the
 * placeholder 0, so prose keeps its neighbours ("$r = 4$ m" reads "0 m"). */
const FORMULA = "0";
function appProse(text: string) {
  return segments(text)
    .map((s) => (s.math ? FORMULA : s.text))
    .join("");
}
function printProse(text: string) {
  return segmentPrintText(text)
    .map((s) => (s.kind === "text" ? s.source : FORMULA))
    .join("");
}

/** Single-letter identifiers named inside a text's math. */
export function mathVariables(text: string): Set<string> {
  const found = new Set<string>();
  const tex = [
    ...segments(text)
      .filter((s) => s.math)
      .map((s) => s.text),
    ...segmentPrintText(text)
      .filter((s) => s.kind === "math")
      .map((s) => (s.kind === "math" ? s.tex : "")),
  ];
  for (const t of tex) {
    const stripped = t
      .replace(/\\(?:text|mathrm|operatorname)\{[^}]*\}/g, " ")
      .replace(/\\[A-Za-z]+/g, " ");
    for (const m of stripped.matchAll(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g))
      found.add(m[0]);
  }
  return found;
}

/** Issues in one prose piece. `variables` are letters the surrounding
 * material names as variables, which makes a bare "a" or "A" ambiguous. */
function proseIssues(
  piece: string,
  variables: Set<string>,
  names: Set<string>,
): Issue[] {
  const issues: Issue[] = [];
  let text = piece;
  for (const [pattern] of ALLOWED) text = text.replace(pattern, " ");
  const at = (index: number, length = 1) =>
    text.slice(Math.max(0, index - 24), index + length + 24).trim();
  if (/\b[Pp]i\b/.test(text))
    issues.push({
      rule: "the word pi",
      excerpt: at(text.search(/\b[Pp]i\b/), 2),
    });
  for (const [rule, pattern] of EQUATION) {
    const m = pattern.exec(text);
    if (m) issues.push({ rule, excerpt: at(m.index, m[0].length) });
  }
  const single = new RegExp(lone(`(${letter})`), "gu");
  for (const m of text.matchAll(single)) {
    const l = m[1]!,
      before = text.slice(0, m.index),
      after = text.slice(m.index + 1);
    if (l === "I" || names.has(l)) continue;
    // The article is followed by the word it modifies ("a circle"), never
    // by a verb or operation word ("a is", "a and b").
    const followedByWord = new RegExp(
      `^\\s+(?!(?:${VARIABLE_FOLLOWERS})\\b)[\\p{L}\\p{N}]`,
      "u",
    ).test(after);
    // "a" is the article unless the material names $a$ as a variable.
    if (l === "a" && (!variables.has("a") || followedByWord)) continue;
    // "A" is the article only where it starts a phrase.
    if (
      l === "A" &&
      followedByWord &&
      /(?:^\s*|[.?!:;]\s+|["“(—–]\s*)$/.test(before)
    )
      continue;
    issues.push({
      rule: /\p{Lu}/u.test(l)
        ? "bare uppercase letter"
        : "bare lowercase letter",
      excerpt: at(m.index),
      index: m.index,
    });
  }
  return issues;
}

/** Every typography issue in a text, read by both typesetters. A plain text
 * (a title) is never typeset, so all of it is prose and it holds no TeX. */
export function typographyIssues(
  text: string,
  context: Context = {},
  plain = false,
): Issue[] {
  const source = text.replace(NAMING, "$\\pi$");
  const variables = new Set([
      ...(context.variables ?? []),
      ...mathVariables(source),
    ]),
    names = new Set([...(context.names ?? []), ...namedLetters(source)]);
  const seen = new Set<string>();
  const out: Issue[] = [];
  // Every explicit formula must typeset; KaTeX would otherwise show its source.
  for (const m of source.matchAll(/\$([^$]+)\$/g))
    try {
      katex.renderToString(m[1]!, { throwOnError: true });
    } catch {
      if (/[\\A-Za-z]/.test(m[1]!))
        out.push({ rule: "TeX that does not typeset", excerpt: m[0] });
    }
  if (plain && text.includes("$"))
    out.push({ rule: "TeX in a plain-text title", excerpt: text });
  const readings = plain ? [text] : [appProse(source), printProse(source)];
  for (const piece of readings)
    for (const issue of proseIssues(piece, variables, names)) {
      const key = `${issue.rule}|${issue.excerpt}|${issue.index ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(issue);
      }
    }
  return out;
}

export type LearnerText = {
  owner: string;
  where: string;
  text: string;
  /** Rendered as plain text, never typeset (titles). */
  plain?: boolean;
};
export const SEEDS = 20;

/** Every learner-facing text: each template's generated prompt, hint,
 * answer label, choices, choice feedback and explanation over SEEDS seeds;
 * its method, watch line and principle; and every reference lesson. */
export function learnerTexts(): LearnerText[] {
  const out: LearnerText[] = [];
  const add = (owner: string, where: string, text: string | undefined) => {
    if (text) out.push({ owner, where, text });
  };
  const title = (owner: string, where: string, text: string) =>
    out.push({ owner, where, text, plain: true });
  for (const t of templates) {
    title(t.id, "title", t.title);
    add(t.id, "description", t.description);
    for (let i = 0; i < SEEDS; i++) {
      const p = generateProblem(t.id, `typography-${i}`),
        r = p.public.response;
      add(t.id, "prompt", p.public.prompt);
      add(t.id, "hint", p.hint);
      add(t.id, "answer label", r.label);
      p.explanation.forEach((s) => add(t.id, "explanation", s));
      if (r.kind === "choice")
        r.options.forEach((o) => add(t.id, "choice", o.label));
      Object.values(p.choiceFeedback ?? {}).forEach((s) =>
        add(t.id, "feedback", s),
      );
    }
    const m = methods[t.id];
    if (m) {
      add(t.id, "method goal", m.goal);
      add(t.id, "method intuition", m.intuition);
      (m.terms ?? []).forEach(([term, meaning]) => {
        add(t.id, "method term", term);
        add(t.id, "method term", meaning);
      });
      m.method.forEach((s) => add(t.id, "method step", s));
      add(t.id, "method watch", m.watch);
    }
    add(t.id, "principle", principles[t.id]);
  }
  for (const l of lessons) {
    const owner = `lesson:${l.id}`;
    title(owner, "title", l.title);
    add(owner, "summary", l.summary);
    l.objectives.forEach((s) => add(owner, "objective", s));
    [...l.sections, ...(l.closingSections ?? [])].forEach((section) => {
      title(owner, "section title", section.title);
      section.paragraphs.forEach((s) => add(owner, "paragraph", s));
    });
    add(owner, "worked example", l.workedExample.prompt);
    l.workedExample.steps.forEach((s) => add(owner, "worked step", s));
    add(owner, "worked answer", l.workedExample.answer);
    l.pitfalls.forEach((s) => add(owner, "pitfall", s));
    add(owner, "parent guide", l.parentGuide);
  }
  return out;
}

/** Letters each owner's material names as variables or as names. A lesson
 * shares the context of the templates it teaches. */
export function ownerContexts(texts: LearnerText[]) {
  const byOwner = new Map<string, Required<Context>>();
  const of = (owner: string) => {
    let c = byOwner.get(owner);
    if (!c)
      byOwner.set(owner, (c = { variables: new Set(), names: new Set() }));
    return c;
  };
  for (const { owner, text } of texts) {
    const c = of(owner);
    for (const v of mathVariables(text)) c.variables.add(v);
    for (const n of namedLetters(text)) c.names.add(n);
  }
  for (const l of lessons) {
    const c = of(`lesson:${l.id}`);
    for (const id of l.templateIds) {
      const t = byOwner.get(id);
      t?.variables.forEach((v) => c.variables.add(v));
      t?.names.forEach((n) => c.names.add(n));
    }
  }
  return byOwner;
}

/** Every issue, grouped by owner, one entry per distinct text. */
export function corpusIssues() {
  const texts = learnerTexts(),
    contexts = ownerContexts(texts),
    seen = new Set<string>(),
    out = new Map<string, string[]>();
  for (const { owner, where, text, plain } of texts) {
    const key = `${owner}\n${where}\n${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const issues = typographyIssues(text, contexts.get(owner), plain);
    if (!issues.length) continue;
    const list = out.get(owner) ?? [];
    list.push(
      `${where}: ${text}\n    ${issues.map((i) => `${i.rule} «${i.excerpt}»`).join("; ")}`,
    );
    out.set(owner, list);
  }
  return out;
}

/** True when every "$" in a text opens or closes a formula, so no money is
 * written with a dollar sign: the count is even, and no span is prose
 * (a space at its edge, or a lowercase word outside \text). */
export function dollarsAreMath(text: string): boolean {
  if ((text.match(/\$/g)?.length ?? 0) % 2) return false;
  return [...text.matchAll(/\$([^$]+)\$/g)].every(
    ([, tex]) =>
      !/^\s|\s$/.test(tex!) &&
      // A product of variables (lwh) has no vowel; a word of prose does.
      !/(?:^|[^\\a-zA-Z{])(?=[a-z]*[aeiou])[a-z]{3,}/.test(
        tex!.replace(/\\(?:text|mathrm|overline)\{[^}]*\}/g, ""),
      ),
  );
}
