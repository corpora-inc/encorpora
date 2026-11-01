import { createHash } from "node:crypto";
import { templates } from "../math/engine";
import {
  historicalTemplates,
  templateReplacements,
} from "../math/historical-templates";
import { linkTerms, type LinkContext } from "../glossary/link";
import { methodTermDefinitions } from "../glossary/resolve";
import type { TermId } from "../glossary/types";
import type { GradeBand } from "../curriculum/types";
import { lessons, type Lesson } from "./lessons";
import { methods } from "./problem-methods";
import { principles } from "./problem-principles";
import { hasProblemLesson, lessonGlossaryContext } from "./problem-lessons";
import {
  gradeBandOrder,
  referenceLessonBlocks,
  type LessonTextBlock,
} from "./lesson-text";
import { glossary, glossaryEntry } from "../glossary/index";
import { lessonUnits } from "./lesson-units";

/** The plain-language rules a machine can check (`src/content/AGENTS.md`,
 * "Plain-language standard"):
 *
 * - the first use of every glossary term on a screen sits in a sentence that
 *   defines it;
 * - no sentence in a summary, intuition, practice opening or goal has more
 *   than `MAX_WORDS` words.
 *
 * A screen is a reference lesson or one practice lesson. Each is walked in
 * render order: summary and intuition, worked example, method, watch for,
 * then principle and definitions. The parent note is for adults and is not
 * walked. A practice lesson's generated example is not walked either: it
 * changes with its generator, and `npm run review:plain` judges it. */
export const MAX_WORDS = 35;

/** One screen's violations: glossary terms whose first use there is not in a
 * defining sentence, and the over-long sentences of its summary, intuition,
 * opening or goal (each named by its first eight words). */
export type ScreenViolations = { terms: TermId[]; long: string[] };

/** A screen is `lesson:<lesson id>` or `practice:<template id>`. */
export type ScreenId = string;

/** Sentences of a text, split after . ! ? or ; outside `$…$`. A decimal
 * point or an abbreviation does not end a sentence. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let math = false;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === "$") math = !math;
    if (math || !".!?;".includes(c)) continue;
    const next = text.slice(i + 1);
    if (!/^\s+\S/.test(next)) continue;
    if (c === "." && /\b(e\.g|i\.e|vs|approx)$/i.test(text.slice(0, i)))
      continue;
    // After . ! ? a new sentence starts with a capital, digit, formula,
    // bracket or quote; a semicolon always ends a clause.
    if (c !== ";" && !/^\s+[A-Z0-9$(“"‘'[]/.test(next)) continue;
    out.push(text.slice(start, i + 1).trim());
    start = i + 1;
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** Words in a sentence; a formula counts as one word. */
export function wordCount(sentence: string) {
  return sentence
    .replace(/\$[^$]*\$/g, " x ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** A long sentence's name in the baseline: its first eight words. */
export const sentenceKey = (sentence: string) =>
  sentence.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");

const before = [
  // "… is called a hypotenuse", "we write $x^2$", "let … be"
  String.raw`(?:called|named|known as|we write|written|stands? for|denoted|let)\s+(?:an?\s+|the\s+)?["“‘']?$`,
  // "we write $|x|$ for the absolute value"
  String.raw`\bwe write\b.*\bfor\s+(?:an?\s+|the\s+)?$`,
  // The term as the named thing: "the longest side is the hypotenuse",
  // "the two sides are the legs", "the result is their sum"
  String.raw`\b(?:is|are)\s+(?:also\s+)?(?:called\s+)?(?:the|a|an|its|their)\s+(?:[\p{L}’'-]+\s+){0,2}$`,
].map((p) => new RegExp(p, "iu"));
const after = [
  // "x is a …", "factors are …", "x means …", "x stands for …", "x is called"
  String.raw`^["”’']?\s*(?:\)|s)?\s*(?:is|are)\s+(?:called\s+|also\s+)?(?:a|an|the|one|two|how|what|when|where|any|each|every|all)\b`,
  String.raw`^["”’']?\s*(?:are|means?|stands? for|refers? to|tells|names?|is short for|is written|is read|has|have)\b`,
  // An appositive: "x, the …," "x (the …)", "x, meaning …", "x —". A list
  // ("the slope, the intercept and the vertex") is not one.
  String.raw`^["”’']?\s*(?:,|\(|—|–)\s*(?:the|a|an|which|that is|meaning|or|also|one|its|their|how|what|where|when|any|each|every|all)\b(?![^,;:.)]*\b(?:and|or)\b[^,;:.)]*[.;]?$)`,
  // A colon definition: "x: …"
  String.raw`^["”’']?\s*:`,
].map((p) => new RegExp(p, "iu"));

/** Whether the term spanning [start, end) in a sentence is defined there. */
export function definesAt(sentence: string, start: number, end: number) {
  const head = sentence.slice(0, start);
  const tail = sentence.slice(end);
  return before.some((p) => p.test(head)) || after.some((p) => p.test(tail));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Glossary terms in a sentence with their positions in it. The linker
 * returns spans, not offsets (a formula span need not keep its source text),
 * so each term is found again in the sentence: as a whole word, outside
 * `$…$`, after the previous term. */
function termsInSentence(sentence: string, context: LinkContext) {
  const found: { id: TermId; start: number; end: number }[] = [];
  const prose = sentence
    .replace(/’/g, "'")
    // A hyphen after a formula starts a word, as in the linker: "$y$-intercept".
    .replace(/\$[^$]*\$-?/g, (m) => " ".repeat(m.length));
  let at = 0;
  for (const span of linkTerms(sentence, context)) {
    if (span.kind !== "term") continue;
    const word = new RegExp(
      `(?<![\\p{L}\\p{N}'-])${escape(span.text.replace(/’/g, "'"))}(?![\\p{L}\\p{N}'-])`,
      "giu",
    );
    word.lastIndex = at;
    const match = word.exec(prose);
    if (!match) throw new Error(`"${span.text}" not found in "${sentence}"`);
    found.push({ id: span.id, start: match.index, end: word.lastIndex });
    at = word.lastIndex;
  }
  return found;
}

const lengthStages = new Set(["summary", "intuition", "goal"]);

/** Words first met in kindergarten to grade 2 (counting, equal, half, sum,
 * fraction, angle, …) count as known from grade 3 on. Every later word is
 * defined on each screen that uses it, at any level. */
const KNOWN_FROM = gradeBandOrder.indexOf("3");
export function mustDefine(term: TermId, band: GradeBand) {
  return (
    gradeBandOrder.indexOf(band) < KNOWN_FROM ||
    gradeBandOrder.indexOf(glossaryEntry(term).band) >= KNOWN_FROM
  );
}

/** A block of a screen. `lengthOnly`: held to the sentence limit but not on
 * screen. `measuredElsewhere`: its sentences are measured on another screen. */
export type ScreenBlock = LessonTextBlock & {
  lengthOnly?: boolean;
  measuredElsewhere?: boolean;
};

/** Violations on one screen, walked in render order. */
export function screenViolations(
  blocks: ScreenBlock[],
  context: LinkContext,
  band: GradeBand,
): ScreenViolations {
  const seen = new Set<TermId>();
  const terms: TermId[] = [];
  const long: string[] = [];
  for (const block of blocks) {
    if (block.stage === "partner") continue;
    for (const line of block.lines) {
      if (/^(Figure|Illustration): /.test(line)) continue;
      const prose = line.replace(/^(Problem|Step \d+|Choice \d+|Answer): /, "");
      for (const sentence of sentences(prose)) {
        if (
          lengthStages.has(block.stage) &&
          !block.measuredElsewhere &&
          wordCount(sentence) > MAX_WORDS
        )
          long.push(sentenceKey(sentence));
        if (block.lengthOnly) continue;
        for (const { id, start, end } of termsInSentence(sentence, context)) {
          if (seen.has(id) || !mustDefine(id, band)) continue;
          seen.add(id);
          if (!definesAt(sentence, start, end)) terms.push(id);
        }
      }
    }
  }
  return { terms, long };
}

const templateById = new Map(
  [...templates, ...historicalTemplates].map((t) => [t.id, t]),
);

/** A practice lesson's authored text in render order, as `problemLesson()`
 * builds it, without the generated example. The goal is not on screen; it is
 * held to the sentence limit only. Sentences the reference summary already
 * shows are measured there, not again. */
export function practiceBlocks(templateId: string): ScreenBlock[] {
  const id = templateReplacements[templateId] ?? templateId;
  const template = templateById.get(templateId);
  const authored = methods[id];
  const reference = lessons.find((l) => l.templateIds.includes(id));
  const goal = authored?.goal ?? template?.description ?? "";
  const opening =
    authored?.intuition ?? reference?.summary ?? authored?.goal ?? goal;
  const watch = authored?.watch ?? reference?.pitfalls[0];
  const principle = principles[id];
  const terms = methodTermDefinitions(authored?.terms ?? []);
  return [
    {
      stage: "intuition",
      label: "opening",
      lines: [opening],
      ...(opening === reference?.summary ? { measuredElsewhere: true } : {}),
    },
    { stage: "method", label: "method", lines: authored?.method ?? [goal] },
    ...(watch
      ? [{ stage: "watch" as const, label: "watch for", lines: [watch] }]
      : []),
    {
      stage: "formal",
      label: "principle and definitions",
      lines: [
        ...(principle ? [principle] : []),
        ...terms.map((t) => `${t.term}: ${t.meaning}`),
      ],
    },
    ...(goal && goal !== opening
      ? [
          {
            stage: "goal" as const,
            label: "goal",
            lines: [goal],
            lengthOnly: true,
          },
        ]
      : []),
  ];
}

const lessonContext = (lesson: Lesson): LinkContext => ({
  senses: lesson.senses,
  noLink: lesson.noLink,
});

/** Every screen's violations and band: each reference lesson, then the
 * practice lesson of every template. */
export function plainLanguageViolations(): Map<
  ScreenId,
  ScreenViolations & { band: GradeBand; hash: string }
> {
  const out = new Map<
    ScreenId,
    ScreenViolations & { band: GradeBand; hash: string }
  >();
  for (const unit of lessonUnits()) {
    if (unit.lesson) {
      const blocks = referenceLessonBlocks(unit.lesson);
      out.set(`lesson:${unit.lesson.id}`, {
        band: unit.band,
        hash: screenTextHash(blocks),
        ...screenViolations(blocks, lessonContext(unit.lesson), unit.band),
      });
    }
    for (const templateId of unit.templateIds) {
      if (!hasProblemLesson(templateId)) continue;
      const context = lessonGlossaryContext(
        templateReplacements[templateId] ?? templateId,
        templateById.get(templateId),
      );
      const blocks = practiceBlocks(templateId);
      out.set(`practice:${templateId}`, {
        band: unit.band,
        hash: screenTextHash(blocks),
        ...screenViolations(blocks, context, unit.band),
      });
    }
  }
  return out;
}

/** A short fingerprint of a screen's walked text (not its link metadata).
 * The baseline records it, so a violation that appears while the text stays
 * the same can only come from linking: a newly named sense or glossary form. */
export function screenTextHash(blocks: LessonTextBlock[]) {
  return createHash("sha256")
    .update(JSON.stringify(blocks.map((b) => [b.stage, b.lines])))
    .digest("hex")
    .slice(0, 12);
}

/** The recorded violations. `glossary` lists the glossary ids when it was
 * written, so a term added later can be told apart; `screens` holds every
 * screen: its violations (often none) and the hash of the text they were
 * recorded on. */
export type PlainLanguageBaseline = {
  glossary: TermId[];
  screens: Record<ScreenId, ScreenViolations & { hash?: string }>;
};

/** The current violations in baseline form, sorted for stable diffs. */
export function currentBaseline(): PlainLanguageBaseline {
  const screens: PlainLanguageBaseline["screens"] = {};
  const all = plainLanguageViolations();
  for (const id of [...all.keys()].sort()) {
    const v = all.get(id)!;
    screens[id] = {
      terms: [...v.terms].sort(),
      long: [...v.long].sort(),
      hash: v.hash,
    };
  }
  return { glossary: glossary.map((e) => e.id).sort(), screens };
}

/** A violation, as the test and the baseline script name it. */
export type Violation = { screen: ScreenId; term?: TermId; long?: string };
export const violationText = (v: Violation) =>
  v.term
    ? `${v.screen}: "${v.term}" is not defined where it is first used`
    : `${v.screen}: sentence over ${MAX_WORDS} words: "${v.long}…"`;

/** Violations the baseline does not record (grown) and recorded ones that
 * are gone (stale). A long sentence counts once per occurrence. */
export function diffBaseline(
  current: PlainLanguageBaseline["screens"],
  baseline: PlainLanguageBaseline["screens"],
) {
  const grown: Violation[] = [];
  const stale: Violation[] = [];
  const minus = (a: string[], b: string[]) => {
    const rest = [...b];
    return a.filter((x) => {
      const i = rest.indexOf(x);
      if (i < 0) return true;
      rest.splice(i, 1);
      return false;
    });
  };
  for (const screen of new Set([
    ...Object.keys(current),
    ...Object.keys(baseline),
  ])) {
    const now = current[screen] ?? { terms: [], long: [] };
    const was = baseline[screen] ?? { terms: [], long: [] };
    for (const term of minus(now.terms, was.terms))
      grown.push({ screen, term });
    for (const term of minus(was.terms, now.terms))
      stale.push({ screen, term });
    for (const long of minus(now.long, was.long)) grown.push({ screen, long });
    for (const long of minus(was.long, now.long)) stale.push({ screen, long });
  }
  return { grown, stale };
}

/** Which new violations the baseline script may record. A term that is a
 * glossary entry added since the baseline was written (`newTerms`), or, with
 * `fromSenses`, any term on a screen whose text hash is unchanged: there the
 * text is the same, so only linking changed (a newly named sense or form).
 * New prose and long sentences are never accepted. */
export function acceptedGrowth(
  grown: Violation[],
  baseline: PlainLanguageBaseline["screens"],
  current: PlainLanguageBaseline["screens"],
  options: { newTerms?: TermId[]; fromSenses?: boolean } = {},
) {
  const sameText = (screen: ScreenId) => {
    const was = baseline[screen]?.hash;
    return !!was && was === current[screen]?.hash;
  };
  const accepted: Violation[] = [];
  const refused: (Violation & { textChanged?: boolean })[] = [];
  for (const v of grown) {
    if (v.term && options.newTerms?.includes(v.term)) accepted.push(v);
    else if (v.term && options.fromSenses && sameText(v.screen))
      accepted.push(v);
    else
      refused.push(
        v.term && options.fromSenses ? { ...v, textChanged: true } : v,
      );
  }
  return { accepted, refused };
}
