import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import {
  lessonGlossaryContext,
  problemLesson,
} from "../src/content/problem-lessons";
import { sceneCapability } from "../src/math/scene/capability";
import {
  glossary,
  glossaryEntry,
  hasGlossaryEntry,
} from "../src/glossary/index";
import { glossaryFigure, glossaryFigures } from "../src/glossary/figures";
import {
  entryContext,
  firstUses,
  linkTerms,
  termsIn,
  type LinkContext,
  type Unresolved,
} from "../src/glossary/link";
import {
  glossaryFor,
  methodTermDefinitions,
  methodTermId,
} from "../src/glossary/resolve";
import type { GlossaryEntry, TermId } from "../src/glossary/types";
import { learnerTexts } from "./fixtures/math-typography";

const BANDS = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
];
const band = (id: TermId) => BANDS.indexOf(glossaryEntry(id).band);
const BASELINE = new URL(
  "./fixtures/glossary-unresolved-baseline.json",
  import.meta.url,
);

test("every entry has a valid id, term, forms, plain definition and band", () => {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of glossary) {
    const bad = (why: string) => problems.push(`${e.id}: ${why}`);
    if (ids.has(e.id)) bad("duplicate id");
    ids.add(e.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id)) bad("id is not kebab-case");
    if (!e.term.trim() || e.term !== e.term.trim()) bad("term is blank");
    if (!BANDS.includes(e.band)) bad(`unknown band ${e.band}`);
    if (new Set(e.forms).size !== e.forms.length) bad("repeated form");
    for (const form of e.forms)
      if (form !== form.toLowerCase() || form.includes("$") || !form.trim())
        bad(`form "${form}" is not a lowercase prose word`);
    const words = e.plain.split(/\s+/).filter(Boolean).length;
    if (words > 30) bad(`plain definition has ${words} words (at most 30)`);
    if (!/(?:[.?!][”"')]*|\$)$/.test(e.plain))
      bad("plain definition is not a sentence");
    if (e.example !== undefined && !e.example.trim()) bad("empty example");
    if (e.figure && !glossaryFigures.includes(e.figure))
      bad(`unknown figure ${e.figure}`);
    if (new Set(e.uses).size !== e.uses.length) bad("repeated use");
    if (e.uses.includes(e.id)) bad("uses itself");
  }
  assert.deepEqual(problems, []);
  assert.ok(glossary.length >= 400, `${glossary.length} entries`);
});

test("uses name existing entries, form an acyclic graph, and never reach a later band", () => {
  const problems: string[] = [];
  for (const e of glossary)
    for (const id of e.uses) {
      if (!hasGlossaryEntry(id)) problems.push(`${e.id} uses unknown ${id}`);
      else if (band(id) > band(e.id))
        problems.push(
          `${e.id} (${e.band}) uses ${id} (${glossaryEntry(id).band}), met later`,
        );
    }
  assert.deepEqual(problems, []);
  const state = new Map<TermId, "open" | "done">();
  const cycles: string[] = [];
  const visit = (id: TermId, path: TermId[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "open") {
      cycles.push([...path.slice(path.indexOf(id)), id].join(" → "));
      return;
    }
    state.set(id, "open");
    for (const next of glossaryEntry(id).uses) visit(next, [...path, id]);
    state.set(id, "done");
  };
  for (const e of glossary) visit(e.id, []);
  assert.deepEqual(cycles, []);
});

test("forms are unique across auto-linked entries", () => {
  const owner = new Map<string, TermId>();
  const clashes: string[] = [];
  for (const e of glossary) {
    if (e.autoLink === false) continue;
    for (const form of e.forms) {
      const previous = owner.get(form);
      if (previous) clashes.push(`"${form}": ${previous} and ${e.id}`);
      owner.set(form, e.id);
    }
  }
  assert.deepEqual(clashes, []);
});

test("a definition lists every glossary term its own text uses", () => {
  const problems: string[] = [];
  for (const e of glossary) {
    const context = entryContext(e);
    for (const text of [e.plain, e.example ?? ""]) {
      const unresolved: Unresolved[] = [];
      for (const id of termsIn(text, context, (u) => unresolved.push(u)))
        if (!e.uses.includes(id))
          problems.push(`${e.id}: text uses ${id}; add it to uses`);
      for (const u of unresolved)
        problems.push(
          `${e.id}: "${u.form}" is ambiguous; add one of ${u.candidates.join("/")} to uses, or the word to noLink`,
        );
    }
  }
  assert.deepEqual([...new Set(problems)], []);
});

test("every figure builds for the oldest scene renderer", () => {
  for (const figure of glossaryFigures)
    assert.equal(sceneCapability(glossaryFigure(figure)), "scenes-v1", figure);
  const used = new Set(glossary.map((e) => e.figure).filter(Boolean));
  assert.deepEqual(
    glossaryFigures.filter((f) => !used.has(f)),
    [],
    "every figure is used by an entry",
  );
});

const senseIds = (context: {
  senses?: Record<string, string>;
  noLink?: readonly string[];
}) => Object.values(context.senses ?? {});

test("method terms, senses and lesson senses name existing entries", () => {
  const problems: string[] = [];
  for (const [id, method] of Object.entries(methods)) {
    for (const term of method.terms ?? []) {
      const termId = methodTermId(term);
      if (!hasGlossaryEntry(termId))
        problems.push(`${id}: unknown term ${termId}`);
      if (typeof term !== "string" && !term[1].trim())
        problems.push(`${id}: empty note on ${termId}`);
    }
    for (const sense of senseIds(method))
      if (!hasGlossaryEntry(sense))
        problems.push(`${id}: unknown sense ${sense}`);
  }
  for (const template of templates)
    for (const sense of Object.values(template.glossarySenses ?? {}))
      if (!hasGlossaryEntry(sense))
        problems.push(`${template.id}: unknown sense ${sense}`);
  for (const lesson of lessons)
    for (const sense of senseIds(lesson))
      if (!hasGlossaryEntry(sense))
        problems.push(`lesson:${lesson.id}: unknown sense ${sense}`);
  assert.deepEqual(problems, []);
});

test("linking: longest form first, math untouched, first use per block, senses and noLink", () => {
  const ids = (text: string, context?: LinkContext) => termsIn(text, context);
  assert.deepEqual(ids("Find the unit rate."), ["unit-rate"]);
  assert.deepEqual(ids("A rate compares two quantities."), ["rate"]);
  assert.deepEqual(ids("Take the square root of 49."), ["square-root"]);
  assert.deepEqual(ids("The hypotenuse is $c$ in $a^2 + b^2 = c^2$."), [
    "hypotenuse",
  ]);
  // Inside explicit TeX and inside a bare formula, nothing links.
  assert.deepEqual(ids("$\\text{slope} = 2$"), []);
  assert.deepEqual(ids("Use 3 × 4 = 12 to check."), []);
  // Case-insensitive, word-bounded, hyphens are part of a word.
  assert.deepEqual(ids("Hypotenuses are long."), ["hypotenuse"]);
  assert.deepEqual(ids("The denominators match."), ["denominator"]);
  assert.deepEqual(ids("A non-integer value."), []);
  // An ambiguous word links only through a sense, and noLink silences it.
  const unresolved: Unresolved[] = [];
  assert.deepEqual(
    termsIn("Find the range.", {}, (u) => unresolved.push(u)),
    [],
  );
  assert.equal(unresolved[0]?.form, "range");
  assert.deepEqual(
    ids("Find the range.", { senses: { range: "range-function" } }),
    ["range-function"],
  );
  assert.deepEqual(
    ids("Find the range.", { senses: { range: "range-statistics" } }),
    ["range-statistics"],
  );
  assert.deepEqual(
    ids("The hypotenuse is long.", { noLink: ["hypotenuse"] }),
    [],
  );
  // Spans rebuild the text exactly, formulas included.
  const text = "The slope of $y = 2x + 1$ is 2; the slope is steep.";
  const spans = linkTerms(text);
  assert.equal(
    spans.map((s) => (s.kind === "math" ? `$${s.plain}$` : s.text)).join(""),
    text,
  );
  const [first, second] = firstUses([
    linkTerms("The slope is the slope."),
    linkTerms("Slope again."),
  ]);
  assert.equal(first!.filter((s) => s.kind === "term").length, 1);
  assert.equal(second!.filter((s) => s.kind === "term").length, 0);
});

test("glossaryFor returns used entries and everything their definitions use", () => {
  const entries = glossaryFor(["The hypotenuse is opposite the right angle."]);
  const ids = entries.map((e) => e.id);
  assert.equal(ids[0], "hypotenuse");
  for (const e of entries)
    for (const id of e.uses) assert.ok(ids.includes(id), `${e.id} → ${id}`);
});

test("problem lessons keep the terms wire shape and carry the glossary they use", () => {
  for (const template of templates.filter((_, i) => i % 25 === 0)) {
    const lesson = problemLesson(template.id, "glossary-shape");
    for (const term of lesson.terms) {
      assert.deepEqual(Object.keys(term), ["term", "meaning"], template.id);
      assert.equal(typeof term.term, "string");
      assert.ok(term.meaning.length > 0, template.id);
    }
    const ids = new Set(lesson.glossary.map((card) => card.id));
    for (const term of methods[template.id]?.terms ?? [])
      assert.ok(ids.has(methodTermId(term)), `${template.id}: ${term}`);
    for (const card of lesson.glossary)
      for (const id of card.uses) assert.ok(ids.has(id), `${card.id} → ${id}`);
  }
  // The meaning a client renders is the glossary definition, example and note.
  const definitions = methodTermDefinitions([
    "hypotenuse",
    ["hypotenuse", "Here it is $c$."],
  ]);
  assert.equal(definitions.length, 1);
  assert.ok(
    definitions[0]!.meaning.startsWith(glossaryEntry("hypotenuse").plain),
  );
  assert.ok(definitions[0]!.meaning.endsWith("Here it is $c$."));
});

/** Learner-visible teaching text: lessons, methods, principles, and the
 * hints and explanations of 20 instances of every template. Prompts, choices
 * and titles are not linked. */
const LINKED = new Set([
  "hint",
  "explanation",
  "method goal",
  "method intuition",
  "method step",
  "method watch",
  "principle",
  "summary",
  "objective",
  "paragraph",
  "worked example",
  "worked step",
  "worked answer",
  "pitfall",
  "parent guide",
]);

type Counts = Record<string, Record<string, number>>;
function unresolvedCounts(): Counts {
  const contexts = new Map<string, LinkContext>();
  for (const lesson of lessons)
    contexts.set(`lesson:${lesson.id}`, {
      senses: lesson.senses,
      noLink: lesson.noLink,
    });
  for (const template of templates)
    contexts.set(template.id, lessonGlossaryContext(template.id, template));
  const counts: Counts = {};
  const seen = new Set<string>();
  for (const { owner, where, text } of learnerTexts()) {
    if (!LINKED.has(where)) continue;
    const key = `${owner}\n${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    termsIn(text, contexts.get(owner) ?? {}, ({ form }) => {
      const forOwner = (counts[owner] ??= {});
      forOwner[form] = (forOwner[form] ?? 0) + 1;
    });
  }
  return counts;
}
const sorted = (counts: Counts): Counts =>
  Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((owner) => [
        owner,
        Object.fromEntries(
          Object.keys(counts[owner]!)
            .sort()
            .map((form) => [form, counts[owner]![form]!]),
        ),
      ]),
  );

test("every learner-visible ambiguous word resolves, or is in the shrinking baseline", () => {
  const current = sorted(unresolvedCounts());
  const baseline: Counts = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};
  const grown: string[] = [];
  const stale: string[] = [];
  for (const [owner, forms] of Object.entries(current))
    for (const [form, n] of Object.entries(forms))
      if (n > (baseline[owner]?.[form] ?? 0))
        grown.push(
          `${owner}: "${form}" ×${n} (baseline ${baseline[owner]?.[form] ?? 0}); name its sense in senses/glossarySenses or add it to noLink`,
        );
  for (const [owner, forms] of Object.entries(baseline))
    for (const [form, n] of Object.entries(forms))
      if ((current[owner]?.[form] ?? 0) < n)
        stale.push(
          `${owner}: "${form}" ×${current[owner]?.[form] ?? 0} < ${n}`,
        );
  if (process.env.GLOSSARY_BASELINE === "write") {
    // Only ever shrinks: a new unresolved word must be fixed, not recorded.
    assert.ok(
      grown.length === 0 || !existsSync(BASELINE),
      `Refusing to grow the baseline:\n${grown.join("\n")}`,
    );
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    return;
  }
  assert.deepEqual(grown, [], "New unresolved ambiguous words");
  assert.deepEqual(
    stale,
    [],
    "Resolved words are still in the baseline: run GLOSSARY_BASELINE=write node --import tsx --test tests/glossary.test.ts to shrink it",
  );
});

/** Core vocabulary every learner meets; each needs an entry. */
const VOCABULARY = [
  "denominator",
  "numerator",
  "coefficient",
  "variable",
  "expression",
  "equation",
  "inequality",
  "slope",
  "intercept",
  "hypotenuse",
  "leg",
  "radius",
  "diameter",
  "perimeter",
  "area",
  "volume",
  "quotient",
  "product",
  "sum",
  "difference",
  "factor",
  "multiple",
  "prime",
  "exponent",
  "integer",
  "rational",
  "irrational",
  "ratio",
  "rate",
  "unit rate",
  "proportion",
  "mean",
  "median",
  "mode",
  "range",
  "function",
  "domain",
  "polynomial",
  "quadratic",
  "vertex",
  "sine",
  "cosine",
  "tangent",
  "congruent",
  "similar",
  "dilation",
  "reflection",
  "rotation",
  "translation",
  "transversal",
  "absolute value",
  "square root",
  "place value",
  "digit",
  "addend",
  "remainder",
  "divisor",
  "dividend",
  "reciprocal",
  "scale factor",
  "fraction",
  "decimal",
  "percent",
  "equivalent fractions",
  "mixed number",
  "improper fraction",
  "common denominator",
  "least common multiple",
  "greatest common factor",
  "prime number",
  "composite number",
  "even number",
  "odd number",
  "negative number",
  "opposite",
  "number line",
  "coordinate plane",
  "ordered pair",
  "origin",
  "x-axis",
  "y-axis",
  "quadrant",
  "angle",
  "right angle",
  "acute angle",
  "obtuse angle",
  "straight angle",
  "parallel",
  "perpendicular",
  "polygon",
  "triangle",
  "quadrilateral",
  "rectangle",
  "square",
  "rhombus",
  "trapezoid",
  "parallelogram",
  "circle",
  "circumference",
  "chord",
  "arc",
  "center",
  "face",
  "edge",
  "prism",
  "pyramid",
  "cylinder",
  "cone",
  "sphere",
  "cube",
  "surface area",
  "net",
  "line",
  "ray",
  "segment",
  "point",
  "symmetry",
  "line of symmetry",
  "unit",
  "length",
  "mass",
  "capacity",
  "elapsed time",
  "data",
  "frequency",
  "outlier",
  "probability",
  "outcome",
  "event",
  "sample space",
  "sample",
  "population",
  "histogram",
  "scatterplot",
  "line of best fit",
  "correlation",
  "interquartile range",
  "standard deviation",
  "mean absolute deviation",
  "box plot",
  "dot plot",
  "like terms",
  "constant",
  "term",
  "solution",
  "system of equations",
  "linear function",
  "exponential function",
  "input",
  "output",
  "range of a function",
  "zero of a function",
  "parabola",
  "axis of symmetry",
  "factored form",
  "standard form",
  "vertex form",
  "discriminant",
  "binomial",
  "monomial",
  "trinomial",
  "logarithm",
  "asymptote",
  "complex number",
  "imaginary unit",
  "radian",
  "unit circle",
  "period",
  "amplitude",
  "sequence",
  "arithmetic sequence",
  "geometric sequence",
  "common difference",
  "common ratio",
  "inverse function",
  "composition",
  "multiplication",
  "division",
  "addition",
  "subtraction",
  "array",
  "equal groups",
  "estimate",
  "round",
  "proof",
  "theorem",
  "isosceles",
  "equilateral",
  "scalene",
  "exterior angle",
  "interior angle",
  "supplementary angles",
  "complementary angles",
  "vertical angles",
  "corresponding angles",
  "alternate interior angles",
  "pythagorean theorem",
  "scientific notation",
  "square number",
  "cube root",
  "perfect square",
  "order of operations",
  "distributive property",
  "commutative property",
  "associative property",
  "inverse operation",
  "percent change",
  "discount",
  "interest",
  "tax",
  "markup",
  "unit price",
  "constant of proportionality",
  "proportional relationship",
  "independent variable",
  "dependent variable",
  "rate of change",
  "y-intercept",
  "x-intercept",
  "slope-intercept form",
  "point-slope form",
  "base",
  "height",
  "degree",
];

test("every core vocabulary word has an entry", () => {
  const known = new Set<string>();
  for (const e of glossary as GlossaryEntry[]) {
    known.add(e.term.toLowerCase());
    e.forms.forEach((form) => known.add(form));
  }
  assert.deepEqual(
    VOCABULARY.filter((word) => !known.has(word)),
    [],
  );
});
