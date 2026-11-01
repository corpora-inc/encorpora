import { describeScene } from "../../src/math/scene/layout";
import { isPorted, legacyScene } from "../../src/math/scene/legacy";
import type {
  GeneratedProblem,
  SemanticFigure,
} from "../../src/math/contracts";
import type { Scene } from "../../src/math/scene/spec";

/** Every learner-visible string of a generated problem: prompt, answer
 * labels and choices, hint, explanation, choice feedback, and what figures
 * say (their labels and accessible descriptions). */
export function problemTexts(
  p: GeneratedProblem,
): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, text: unknown) => {
    if (typeof text === "string" && text.trim()) out.push({ where, text });
  };
  add("prompt", p.public.prompt);
  add("hint", p.hint);
  p.explanation.forEach((s) => add("explanation", s));
  Object.values(p.choiceFeedback ?? {}).forEach((s) => add("feedback", s));
  strings(p.public.response, [
    "id",
    "kind",
    "value",
    "answer",
    "accepted",
  ]).forEach((s) => add("response", s));
  const scene = (s: Scene | undefined, where: string) => {
    if (!s) return;
    add(`${where} description`, describeScene(s, true));
    strings(s, [
      "id",
      "type",
      "kind",
      "color",
      "tone",
      "mark",
      "shape",
      "fill",
      "anchor",
      "side",
      "align",
      "style",
      "role",
      "variant",
      "icon",
      "ref",
      "target",
      "from",
      "to",
      "of",
      "at",
    ]).forEach((t) => add(`${where} label`, t));
  };
  const figure = p.public.figure as SemanticFigure | undefined;
  if (figure?.kind === "scene") scene(figure.scene, "figure");
  else if (figure && isPorted(figure)) scene(legacyScene(figure), "figure");
  else if (figure)
    strings(figure, ["kind"]).forEach((t) => add("figure label", t));
  scene(p.walkthrough, "walkthrough");
  return out;
}

/** String values in a value, skipping keys that hold identifiers. */
function strings(value: unknown, skip: string[], out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, skip, out));
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value))
      if (!skip.includes(k)) strings(v, skip, out);
  return out;
}

/** Words that end a noun phrase: a count never reaches past them. */
const STOP = new Set(
  "a an the and or but nor of to in on at by for from with without than as is are was were be been being has have had do does did can could will would shall should may might must equals equal makes make gives give plus minus times over under per each every more less fewer that which who whose this these those it its their his her our your my not no yes so if then when where while into onto out up down off left right".split(
    " ",
  ),
);
/** Describing words that may sit between a count and its noun ("1 square
 * counters", "2 red apples"). A closed list: any other word ends the noun
 * phrase, so a verb or a second noun is never read as the counted noun. */
const DESCRIBING = new Set(
  "red blue green yellow orange purple pink brown black white gray grey gold silver round square triangular rectangular striped spotted shaded unshaded empty full whole equal unit big small large little tiny tall short long wide narrow heavy light new old extra same different identical fresh ripe wooden plastic paper glass toy blank colored".split(
    " ",
  ),
);
/** Number words: "4 thousand" and "two hundred one" are numbers. */
const NUMBER_WORDS = new Set(
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion trillion dozen".split(
    " ",
  ),
);
/** Words far more often verbs than nouns ("1 appears twice", "one
 * subtracts"): never learned as plural nouns. */
const VERBS = new Set(
  "adds subtracts decides appears moves happens works fits keeps needs goes comes becomes belongs divides differs multiplies equals means gives takes makes holds pays measures represents balances stays remains lies sits starts ends grows shrinks rises falls stands shows".split(
    " ",
  ),
);
const INVARIANT = new Set(
  "is was has its his this thus plus minus less does gas bus yes us various previous always perhaps whereas lens species series means".split(
    " ",
  ),
);
/** Spoken with a leading vowel sound, so they take "an": 8, 11, 18, 80–89,
 * 800–899, 8,000…, 11,000, 18,000. */
const takesAn = (digits: string) =>
  /^8/.test(digits) || /^1[18](\d{3})*$/.test(digits);

export type Agreement = { rule: string; text: string; match: string };

/** TeX spans become a placeholder, except a bare number ("$3$ apples"). */
function normalize(text: string) {
  return text
    .replace(/\$\s*(\d{1,3}(?:,\d{3})+|\d+)\s*\$/g, "$1")
    .replace(/\$[^$]*\$/g, " ⟨math⟩ ")
    .replace(/\s+/g, " ");
}
const singularOf = (plural: string) =>
  /ies$/.test(plural)
    ? `${plural.slice(0, -3)}y`
    : /(ches|shes|xes|sses|zes)$/.test(plural)
      ? plural.slice(0, -2)
      : plural.slice(0, -1);

/** A whole number used as a count: not part of a decimal, fraction, sign,
 * list ("5, 4, 2"), operation ("× 32", "= 12") or label ("Card 2", "the
 * score on Game 1"). A capital word that starts a sentence ("Take 1 apple")
 * is not a label. */
const COUNT =
  "(?<![\\d.,/−+×÷^_=<>≤≥-])(?<![−+×÷=<>≤≥-] )(?<!\\d, )(?<![a-z,;:] [A-Z][a-z]* )(?<!^(?:Card|Box|Bag|Game|Plan|Option|Step|Row|Column|Day|Week|Year|Month|Graph|Table|Figure|Line|Equation|Part|Question|Account|Level|Round|Page|Player|Team|Store|Group|Point|Sample|Trial|Spinner|Machine|Model|Method|Choice|Statement|Pattern|Term|Number|Unit|Grade|Class|Section|Bus|Route|Car) )(\\d{1,3}(?:,\\d{3})+|\\d+)(?![\\d]|[.,/:]\\d|%|°)";

/** Countable nouns, learned from the corpus: a word ending in s that follows
 * a count of 2 or more and ends the phrase ("3 counters.", "5 apples and")
 * is a plural noun. A word followed by more words may be a verb ("Box 2
 * holds 5"), so it teaches nothing. */
export class NounLexicon {
  plurals = new Set<string>();
  /** Singular forms of `plurals`. */
  singulars = new Set<string>();
  /** Words seen as a singular noun: after "1", "a", "one", "each", "per" or
   * "every", ending the phrase ("1 counter.", "each box,"). Verbs ("2 and 4
   * share a factor") never appear there, so they are never flagged. */
  attested = new Set<string>();
  learn(text: string) {
    for (const m of normalize(text).matchAll(
      new RegExp(`${COUNT} ([a-z]{3,})(?=[.,;:?!)]|$| (\\S+))`, "g"),
    )) {
      const n = Number(m[1]!.replace(/,/g, ""));
      const word = m[2]!;
      const next = m[3];
      if (next && !STOP.has(next)) continue;
      if (
        n < 2 ||
        !/[^s]s$/.test(word) ||
        /(ss|us|is)$/.test(word) ||
        INVARIANT.has(word) ||
        VERBS.has(word) ||
        STOP.has(word)
      )
        continue;
      this.plurals.add(word);
      this.singulars.add(singularOf(word));
    }
    for (const m of normalize(text).matchAll(
      /(?<![\d.,/−-])\b(?:1|[Aa]n?|[Oo]ne|[Ee]ach|per|[Ee]very) ([a-z]{3,})(?=[.,;:?!)]|$| (\S+))/g,
    ))
      if (!m[2] || STOP.has(m[2])) this.attested.add(m[1]!);
  }
  isSingular(word: string) {
    return (
      this.singulars.has(word) &&
      this.attested.has(word) &&
      !this.plurals.has(word) &&
      !NUMBER_WORDS.has(word)
    );
  }
}

export function agreementIssues(raw: string, lex: NounLexicon): Agreement[] {
  const text = normalize(raw);
  const out: Agreement[] = [];
  const push = (rule: string, match: string) =>
    out.push({ rule, text: raw, match });
  const phrase = new RegExp(
    `(?:${COUNT}|\\b([Oo]ne))((?: (?:${[...DESCRIBING].join("|")}))*) ([a-z]+)(?=([.,;:?!)]|$| \\S+))`,
    "g",
  );
  // Matches may overlap ("7 one cubes" holds the count "one"): after each,
  // resume just past its count.
  for (let m = phrase.exec(text); m; m = phrase.exec(text)) {
    phrase.lastIndex = m.index + (m[1] ?? m[2])!.length;
    const n = m[1] ? Number(m[1].replace(/,/g, "")) : 1;
    const noun = m[4]!;
    const next = m[5]?.trim();
    const before = text.slice(0, m.index);
    // "seven hundred one thousandths" counts 701, not one.
    const partOfNumber =
      !m[1] &&
      new RegExp(`\\b(?:${[...NUMBER_WORDS].join("|")})[\\s-]$`, "i").test(
        before,
      );
    // "the sign of 1 decides", "less than 1 moves": a number named, not a count.
    const named =
      /\b(?:of|than|input|output|value|number|constant|factor|term|sign)\s$/i.test(
        before,
      );
    // "1 leaves the amount", "1 becomes −1": a verb takes an object.
    const verb =
      !!next &&
      /^(?:the|a|an|it|them|this|that|its|their|every|each|from|on|in|into|with|once|evenly|over|up|down|after|before|to|sign|⟨math⟩|[\d−+-])/.test(
        next,
      );
    // "at least one works", "each one keeps", "the flawed one fits": "one"
    // stands for a noun.
    const pronoun =
      !m[1] &&
      /\b(?:each|the|this|that|which|any|every|no|least|only|another|same|other|(?:the|a|each|this|that) [a-z]+ed)\s$/i.test(
        before,
      );
    if (
      n === 1 &&
      lex.plurals.has(noun) &&
      !partOfNumber &&
      !named &&
      !verb &&
      !pronoun
    ) {
      push("plural noun after 1", m[0]);
      continue;
    }
    // "a 3 meter rope": after an article the count describes a noun.
    if (!m[1] || n === 1 || /\b(an?|the)\s$/i.test(before)) continue;
    // Flag only where the sentence clause ends ("3 apple trees" uses
    // "apple" to describe the next noun; "4 can not" is a verb), never for a
    // label ("year 2 balance"), a list subject ("6 and 4 differ.") or an
    // object ("groups of 12 fit", "a 5 by 3 rectangle").
    const ends = !next || /^[.,;:?!)]/.test(next);
    if (
      /\b[a-z]+ \d+ (?:and|or) $|(?:^|[^a-z])(?:year|day|week|month|step|row|column|line|equation|option|part|page|card|box|bag|group|round|level|grade|table|figure|point|choice|account|number|value|values|digit|digits|numbers|and|or|of|by|through|from|to|than|x|times) $/i.test(
        before,
      )
    )
      continue;
    if (lex.isSingular(noun) && ends)
      push("singular noun after a count other than 1", m[0]);
  }
  for (const m of text.matchAll(
    /\b(?:1|[Oo]ne) of (?:the|these|those|them|its|their)\b(?: \d+)?(?: [a-z]+){0,2} (are|were|have)\b/g,
  ))
    push("plural verb after “one of”", m[0]);
  for (const m of text.matchAll(
    /\b[Tt]here (?:is|was) (\d{1,3}(?:,\d{3})+|\d+)(?![\d]|[.,/]\d)((?: [a-z]+){1,3})/g,
  )) {
    const n = Number(m[1]!.replace(/,/g, ""));
    if (
      n !== 1 &&
      m[2]!
        .trim()
        .split(" ")
        .some((w) => lex.plurals.has(w))
    )
      push("singular verb before a plural count", m[0]);
  }
  for (const m of text.matchAll(
    /\b([Aa]n?) (\d{1,3}(?:,\d{3})+|\d+)(?![\d]|[.,/]\d)/g,
  )) {
    const an = m[1]!.toLowerCase() === "an";
    if (an !== takesAn(m[2]!.replace(/,/g, "")))
      push(
        an ? "“an” before a consonant sound" : "“a” before a vowel sound",
        m[0],
      );
  }
  // "repeat it 1 times." (not "1 times 5", a product).
  for (const m of text.matchAll(/(?<![\d.,/−-])\b1 times(?=[.,;:?!]|$)/g))
    push("plural noun after 1", m[0]);
  return out;
}
