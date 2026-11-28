/** Tokenizing, a forgiving query vocabulary, and lexical scoring for the fixture engine. */
import { stem as porter2 } from "porter2";

const STOP = new Set(
  "a an and are as at be by can do does for from how i if in into is it its me my of on or so than that the then there this to was what when where which who why will with you your we our must".split(" "),
);

/** Whitespace-only normalization (the CONTRACT rule for quotes). */
export function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * At most `max` characters with an ellipsis, cut at a word boundary. Only a
 * single word longer than half of `max` is cut inside the word. Never splits
 * a surrogate pair.
 */
export function excerpt(text: string, max = 120): string {
  const chars = Array.from(normalizeSpace(text));
  if (chars.length <= max) return chars.join("");
  const cut = chars.slice(0, max - 1).join("");
  // The next character is a space: the cut already ends on a whole word.
  const atBoundary = chars[max - 1] === " ";
  const space = cut.lastIndexOf(" ");
  const kept = atBoundary ? cut : space > cut.length / 2 ? cut.slice(0, space) : cut;
  return `${kept.replace(/[\s,;:.\u2013\u2014-]+$/, "")}…`;
}

/**
 * Porter2 (Snowball English), the stemmer harvest-core's normalizer uses
 * (rust-stemmers `Algorithm::English`), so both sides reduce a word alike:
 * "signalling", "signaling" and "signals" all become "signal".
 */
export function stem(w: string): string {
  return /^\d/.test(w) ? w : porter2(w);
}

/** Lowercased words; "1,000" is one number and a hyphenated word also yields its joined form. */
export function words(s: string): string[] {
  const out: string[] = [];
  const text = s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/(\d),(?=\d{3}(?!\d))/g, "$1");
  for (const raw of text.split(/[^\p{L}\p{N}.'-]+/u)) {
    const w = raw.replace(/^[.'-]+|[.'-]+$/g, "");
    if (!w) continue;
    const parts = w.split("-").filter(Boolean);
    // "de-energized" also matches "deenergized", and "power-lines" matches "power lines".
    if (parts.length > 1) out.push(parts.join(""));
    out.push(...parts);
  }
  return out;
}

export function tokens(s: string): string[] {
  return words(s)
    .filter((w) => !STOP.has(w))
    .map(stem);
}

/**
 * British spellings rewritten to the American spelling the CFR uses. Each
 * rewrite is only a candidate: a query word takes it only when the word
 * itself is not in the index and the rewrite is.
 */
const SPELLING: [RegExp, string][] = [
  [/^tyre(s?)$/, "tire$1"],
  [/^kerb(s?)$/, "curb$1"],
  [/^grey/, "gray"],
  [/^aluminium/, "aluminum"],
  [/^plough/, "plow"],
  [/^draught/, "draft"],
  [/^storey(s?)$/, "story"],
  [/^manoeuv?re/, "maneuver"],
  [/^manoeuv/, "maneuv"],
  [/ae/, "e"],
  [/oe/, "e"],
  [/our(s|ed|ing)?$/, "or$1"],
  [/([^aeiou])re(s|d)?$/, "$1er$2"],
  [/is(e|es|ed|er|ers|ing|ation|ations)$/, "iz$1"],
  [/ys(e|es|ed|ing)$/, "yz$1"],
  [/ence$/, "ense"],
  [/ogue$/, "og"],
  [/ll(ing|ed|er|ers)$/, "l$1"],
  [/lment$/, "llment"],
];

export function spellingVariants(w: string): string[] {
  const out = new Set<string>();
  for (const [re, to] of SPELLING) if (re.test(w)) out.add(w.replace(re, to));
  // Two rules at once: "manoeuvres" -> "maneuvers".
  for (const v of [...out]) for (const [re, to] of SPELLING) if (re.test(v)) out.add(v.replace(re, to));
  out.delete(w);
  return [...out];
}

/** Damerau-Levenshtein (optimal string alignment) distance, stopping early past `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2]! + 1);
      cur.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/** One query word resolved against the index vocabulary. */
export interface QueryTerm {
  /** The word as typed. */
  word: string;
  /** Index terms it matched: itself, a spelling variant, a typo fix, or the halves of a run-together word. */
  terms: string[];
  /** How it matched. "none" when nothing in the index is close. */
  via: "exact" | "spelling" | "split" | "typo" | "none";
  /** The words it was read as, when they say it better than the terms (a spelling variant, the two halves). */
  shown?: string[];
}

/**
 * The index vocabulary: term -> document frequency, plus the words that
 * produced each term (built on first need), for typo matching on whole words
 * and for showing a reading in words.
 */
export class Lexicon {
  readonly df: ReadonlyMap<string, number>;
  private readonly texts: () => Iterable<string>;
  private built: { word: Map<string, string>; surface: Map<string, string>; pairs: Set<string> } | null = null;
  constructor(df: ReadonlyMap<string, number>, texts: () => Iterable<string>) {
    this.df = df;
    this.texts = texts;
  }
  private get index() {
    if (this.built) return this.built;
    const counts = new Map<string, Map<string, number>>();
    const pairs = new Set<string>();
    for (const text of this.texts()) {
      const ws = words(text);
      for (let i = 1; i < ws.length; i++) pairs.add(`${ws[i - 1]} ${ws[i]}`);
      for (const w of ws) {
        if (STOP.has(w) || /^\d/.test(w)) continue;
        const s = stem(w);
        const m = counts.get(s) ?? new Map<string, number>();
        m.set(w, (m.get(w) ?? 0) + 1);
        counts.set(s, m);
      }
    }
    const word = new Map<string, string>();
    const surface = new Map<string, string>();
    for (const [s, m] of counts) {
      for (const w of m.keys()) word.set(w, s);
      surface.set(s, [...m.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0]![0]);
    }
    this.built = { word, surface, pairs };
    return this.built;
  }
  /**
   * "powerline" -> power + line: both halves, four letters or more, are words
   * the pack holds, the most even cut first. With `adjacent`, the pack must
   * also write the two side by side ("nothing" is never "not hinged").
   */
  split(word: string, adjacent: boolean): { terms: string[]; shown: string[] } | null {
    if (word.length < 8 || word.length > MAX_WORD || !/^\p{L}+$/u.test(word)) return null;
    const { word: known, pairs } = this.index;
    const mid = word.length / 2;
    const cuts = Array.from({ length: word.length - 7 }, (_, i) => i + 4).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
    for (const i of cuts) {
      const a = word.slice(0, i);
      const b = word.slice(i);
      const sa = known.get(a);
      const sb = known.get(b);
      if (sa && sb && (!adjacent || pairs.has(`${a} ${b}`))) return { terms: [sa, sb], shown: [a, b] };
    }
    return null;
  }
  /** The commonest word in the pack for an index term. */
  said(term: string): string {
    return this.index.surface.get(term) ?? term;
  }
  /**
   * The index term of the closest pack word: one edit for words of 5 to 7
   * letters, two from 8. Whole words are compared, since a stemmer cuts a
   * correct word harder than a misspelt one ("operator" -> "oper",
   * "operater" -> "operat"). Ties go to the commoner term.
   */
  nearest(word: string): string | null {
    if (word.length < 5 || word.length > MAX_WORD || !/^\p{L}+$/u.test(word)) return null;
    const max = word.length >= 8 ? 2 : 1;
    let best: { t: string; d: number; df: number } | null = null;
    for (const [w, t] of this.index.word) {
      const d = editDistance(word, w, max);
      if (d > max) continue;
      const df = this.df.get(t) ?? 0;
      if (!best || d < best.d || (d === best.d && (df > best.df || (df === best.df && t < best.t)))) best = { t, d, df };
    }
    return best?.t ?? null;
  }
}

/** Longer words are not split or typo-matched: a pasted blob must not stall the screen. */
const MAX_WORD = 40;
/** Distinct words read from one query. */
const MAX_WORDS = 32;

/**
 * Resolve each content word of `query` against the index, forgiving British
 * spellings, typos and run-together words, in that order.
 */
export function resolveQuery(query: string, lex: Lexicon): QueryTerm[] {
  const vocab = lex.df;
  const out: QueryTerm[] = [];
  const seen = new Set<string>();
  for (const word of words(query)) {
    if (STOP.has(word) || seen.has(word)) continue;
    if (seen.size >= MAX_WORDS) break;
    seen.add(word);
    const s = stem(word);
    if (vocab.has(s) || /^\d/.test(word)) {
      // A rare run-together form ("powerline") also searches the two words the pack writes side by side.
      const split = (vocab.get(s) ?? 0) <= 2 ? lex.split(word, true) : null;
      out.push({ word, terms: split ? [s, ...split.terms] : [s], via: "exact" });
      continue;
    }
    const spelled = spellingVariants(word).find((v) => vocab.has(stem(v)));
    if (spelled) {
      out.push({ word, terms: [stem(spelled)], via: "spelling", shown: [spelled] });
      continue;
    }
    const typo = lex.nearest(word);
    if (typo) {
      out.push({ word, terms: [typo], via: "typo" });
      continue;
    }
    const split = lex.split(word, false);
    out.push(split ? { word, terms: split.terms, via: "split", shown: split.shown } : { word, terms: [], via: "none" });
  }
  return out;
}

/** `text` cut into runs, `mark` on each word whose stem is in `terms`. */
export function highlight(text: string, terms: ReadonlySet<string>): { text: string; mark: boolean }[] {
  const out: { text: string; mark: boolean }[] = [];
  const push = (t: string, mark: boolean) => {
    const last = out[out.length - 1];
    if (last && last.mark === mark) last.text += t;
    else if (t) out.push({ text: t, mark });
  };
  // A word may hold an apostrophe or hyphen, and a number its "1,000" comma or "1926.1419" point.
  for (const part of text.split(/([\p{L}\p{N}](?:[\p{L}\p{N}'-]|[.,](?=\p{N}))*)/u)) {
    if (!part) continue;
    const isWord = /^[\p{L}\p{N}]/u.test(part);
    const hit = isWord && words(part).some((w) => !STOP.has(w) && terms.has(stem(w)));
    push(part, hit);
  }
  return out;
}

export interface Doc {
  id: string;
  tokens: string[];
}

/** Okapi BM25 over a fixed document set. */
export class Bm25 {
  private readonly df = new Map<string, number>();
  private readonly tf: Map<string, number>[] = [];
  private readonly len: number[] = [];
  private readonly avg: number;
  readonly docs: readonly Doc[];
  private readonly k1: number;
  private readonly b: number;
  constructor(docs: readonly Doc[], k1 = 1.2, b = 0.75) {
    this.docs = docs;
    this.k1 = k1;
    this.b = b;
    let total = 0;
    for (const d of docs) {
      const tf = new Map<string, number>();
      for (const t of d.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.tf.push(tf);
      this.len.push(d.tokens.length);
      total += d.tokens.length;
    }
    this.avg = docs.length ? total / docs.length : 0;
  }
  /** Index term -> number of documents that contain it. */
  get vocab(): ReadonlyMap<string, number> {
    return this.df;
  }
  idf(t: string): number {
    const n = this.docs.length;
    const df = this.df.get(t) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }
  score(query: readonly string[], k = 10): { id: string; score: number }[] {
    const q = [...new Set(query)];
    const out: { id: string; score: number }[] = [];
    this.docs.forEach((d, i) => {
      let s = 0;
      const tf = this.tf[i]!;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        s += (this.idf(t) * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * this.len[i]!) / (this.avg || 1)));
      }
      if (s > 0) out.push({ id: d.id, score: s });
    });
    return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
  }
}

/** The paragraph text from its first matched word's sentence, so the match is in view. */
export function matchWindow(text: string, terms: ReadonlySet<string>, max = 260): string {
  const runs = highlight(text, terms);
  let at = 0;
  for (const r of runs) {
    if (r.mark) break;
    at += r.text.length;
  }
  if (at >= text.length || at < max / 2) return excerpt(text, max);
  // Start at the matched word's sentence, or a few words before it in a long sentence.
  const dot = text.lastIndexOf(". ", at);
  let start = dot < 0 ? 0 : dot + 2;
  if (at - start > max / 2) start = text.lastIndexOf(" ", at - 40) + 1;
  return `${start > 0 ? "…" : ""}${excerpt(text.slice(start), max)}`;
}
