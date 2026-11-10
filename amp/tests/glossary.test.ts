import { reportEditorialLimit } from "./fixtures/editorial";
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateProblem, templates } from "../src/math/engine";
import { clauseExtensions, clauseProblem } from "../src/math/clause-extensions";
import {
  clauseVariants,
  generateClauseVariant,
} from "../src/math/clause-variants";
import { clauseMethods } from "../src/content/clause-methods";
import { clauseVariantMethods } from "../src/content/clause-variant-methods";
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
import type { TermId } from "../src/glossary/types";
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
    reportEditorialLimit(
      words <= 30,
      `${e.id}: plain definition has ${words} words (budget 30)`,
    );
    if (!/(?:[.?!][”"')]*|\$)$/.test(e.plain))
      bad("plain definition is not a sentence");
    if (e.example !== undefined && !e.example.trim()) bad("empty example");
    if (e.figure && !glossaryFigures.includes(e.figure))
      bad(`unknown figure ${e.figure}`);
    if (new Set(e.uses).size !== e.uses.length) bad("repeated use");
    if (e.uses.includes(e.id)) bad("uses itself");
  }
  assert.deepEqual(problems, []);
  assert.ok(glossary.length > 0, "glossary is not empty");
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

test("a method names each term once; repeats only add notes", () => {
  const repeated: string[] = [];
  for (const [id, method] of Object.entries(methods)) {
    const bare = (method.terms ?? []).filter((t) => typeof t === "string");
    for (const termId of new Set(bare))
      if (bare.filter((x) => x === termId).length > 1)
        repeated.push(`${id}: ${termId}`);
    const notes = (method.terms ?? []).flatMap((t) =>
      typeof t === "string" ? [] : [`${t[0]}|${t[1]}`],
    );
    if (new Set(notes).size !== notes.length)
      repeated.push(`${id}: repeated note`);
  }
  assert.deepEqual(repeated, []);
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
  const check = (
    lesson: ReturnType<typeof problemLesson>,
    expected: (typeof methods)[string],
  ) => {
    assert.equal(lesson.goal, expected.goal, lesson.templateId);
    assert.deepEqual(
      lesson.terms,
      methodTermDefinitions(expected.terms ?? []).map(({ term, meaning }) => ({
        term,
        meaning,
      })),
      lesson.templateId,
    );
    for (const term of lesson.terms) {
      assert.deepEqual(
        Object.keys(term),
        ["term", "meaning"],
        lesson.templateId,
      );
      assert.equal(typeof term.term, "string");
      assert.ok(term.meaning.length > 0, lesson.templateId);
      assert.ok(
        lesson.glossary.some((card) => card.term === term.term),
        `${lesson.templateId}: ${term.term}`,
      );
    }
    const ids = new Set(lesson.glossary.map((card) => card.id));
    for (const term of expected.terms ?? [])
      assert.ok(ids.has(methodTermId(term)), `${lesson.templateId}: ${term}`);
    for (const card of lesson.glossary)
      for (const id of card.uses) assert.ok(ids.has(id), `${card.id} → ${id}`);
  };
  for (const template of templates.filter(
    (t, i) =>
      i % 25 === 0 ||
      [
        "oblique-triangle-solve",
        "related-patterns-relationship",
        "coordinate-terms-slots",
      ].includes(t.id),
  )) {
    // Check the original method and each added clause independently. A clause
    // teaches its own terms, rather than the terms of a different exercise.
    const version = clauseVariants[template.id]
      ? 1
      : clauseExtensions[template.id]
        ? template.version - 1
        : template.version;
    const cases = [
      {
        problem: generateProblem(template.id, "glossary-shape", version),
        method: methods[template.id]!,
      },
      ...(clauseExtensions[template.id]?.variants ?? []).map((clause) => ({
        problem: clauseProblem(template, "glossary-shape", clause)!,
        method: clauseMethods[clause]!,
      })),
      ...(clauseVariants[template.id] ?? []).map((clause) => ({
        problem: generateClauseVariant(template, "glossary-shape", clause)!,
        method: clauseVariantMethods[clause]!,
      })),
    ];
    for (const { problem, method } of cases)
      check(
        problemLesson(
          template.id,
          "glossary-shape",
          problem.public.prompt,
          problem.public.response,
          problem,
        ),
        method,
      );
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
