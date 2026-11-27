/** Tokenizing and lexical scoring shared by the fixture engine. */

const STOP = new Set(
  "a an and are as at be by can do does for from how i if in into is it its me my of on or so than that the then there this to was what when where which who why will with you your we our must".split(" "),
);

/** Whitespace-only normalization (the CONTRACT rule for quotes). */
export function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** A light English stem: enough to match "inspections"/"inspection", "lines"/"line". */
export function stem(w: string): string {
  if (w.length <= 3 || /^\d/.test(w)) return w;
  for (const suf of ["ations", "ation", "ings", "ing", "edly", "ed", "es", "s"]) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, -suf.length);
      return suf === "es" && !/(ss|sh|ch|x|z)$/.test(base) ? w.slice(0, -1) : base;
    }
  }
  return w;
}

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}.']+/gu, " ")
    .split(" ")
    .map((w) => w.replace(/^[.']+|[.']+$/g, ""))
    .filter((w) => w.length > 0 && !STOP.has(w))
    .map(stem);
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
