/**
 * FIXTURE engine: the Engine interface over the hand-built sample pack
 * (src/engine/fixture/pack.json, built by scripts/build-fixture.mjs).
 * Lexical retrieval only, no model. Replaced by harvest-core when it lands.
 */
import { reasonProblems } from "./rationale.ts";
import { Bm25, Lexicon, resolveQuery, tokens } from "./text.ts";
import type {
  Diagram, Engine, Equipment, ExamBlueprintRow, FindResult, Lesson, PackInfo, Procedure, Question,
  Reading, Role, RuleGroup, Section, Segment, SkillRow, Source, Term, Topic,
} from "./types.ts";

type Row = Record<string, unknown>;
export interface RawPack {
  pack_meta: Record<string, string>;
  source: Row[];
  section: Row[];
  xref: { from_id: string; to_id: string; kind: string }[];
  equipment: Row[];
  term: Row[];
  explanation: { section_id: string; level: string; body: string; lang: string }[];
  topic: Row[];
  skill: Row[];
  lesson: Row[];
  diagram: Row[];
  question: Row[];
  answer: { answer_id: string; question: string; body: string; section_ids: string; level: string | null; lang: string }[];
  answer_alias: { alias: string; answer_id: string; lang: string }[];
  procedure: Row[];
  proc_step: Row[];
  app: { prereqs: Record<string, string[]>; exams: ExamBlueprintRow[] };
}

const json = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

/** "1926.1419", "1926.1419(c)(2)": a CFR citation inside a query. */
const CITATION = /(19\d\d\.\d{2,4})((?:\([0-9a-zA-Z]{1,4}\))*)/gi;

export function openFixture(raw: RawPack): Engine {
  const t0 = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const sections = new Map<string, Section>();
  const kids = new Map<string, Section[]>();
  for (const r of raw.section as unknown as Section[]) {
    sections.set(r.section_id, r);
    if (r.parent_id) (kids.get(r.parent_id) ?? kids.set(r.parent_id, []).get(r.parent_id)!).push(r);
  }
  const from = new Map<string, string[]>();
  const to = new Map<string, string[]>();
  for (const x of raw.xref) {
    (from.get(x.from_id) ?? from.set(x.from_id, []).get(x.from_id)!).push(x.to_id);
    (to.get(x.to_id) ?? to.set(x.to_id, []).get(x.to_id)!).push(x.from_id);
  }
  const ancestors = (id: string): Section[] => {
    const out: Section[] = [];
    let cur = sections.get(id);
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? sections.get(cur.parent_id) : undefined;
    }
    return out;
  };

  const lessons: Lesson[] = raw.lesson.map((l) => ({ ...(l as unknown as Lesson), body: json<Segment[]>(l.body) }));
  const diagrams = new Map<string, Diagram>(
    raw.diagram.map((d) => [d.diagram_id as string, { ...(d as unknown as Diagram), section_ids: json<string[]>(d.section_ids) }]),
  );
  // Practice shows multiple-choice items whose every choice carries a real reason (rationale.ts).
  // The full content rule (a note line too) gates the build; a pack item without a note shows without one.
  const questions: Question[] = raw.question
    .map((q) => ({
      ...(q as unknown as Question),
      choices: json<string[]>(q.choices ?? "[]"),
      rationales: json<string[]>(q.rationales ?? "[]"),
      section_ids: json<string[]>(q.section_ids),
    }))
    .filter((q) => q.kind === "mc" && reasonProblems(q).length === 0);
  const steps = raw.proc_step.map((s) => ({
    ...(s as unknown as Procedure["steps"][number]),
    detail: json<Record<Role, string>>(s.detail),
    section_ids: json<string[]>(s.section_ids),
    deficiency: s.deficiency ? json<Procedure["steps"][number]["deficiency"]>(s.deficiency) : null,
  }));
  const procedures: Procedure[] = raw.procedure.map((p) => ({
    ...(p as unknown as Procedure),
    roles: json<Role[]>(p.roles),
    steps: steps.filter((s) => s.proc_id === p.proc_id).sort((a, b) => a.ord - b.ord),
  }));
  const equipment: Equipment[] = raw.equipment.map((e) => ({ ...(e as unknown as Equipment), aliases: json<string[]>(e.aliases) }));

  const counts = json<Record<string, number>>(raw.pack_meta.row_counts ?? "{}");
  const info: PackInfo = {
    pack_id: raw.pack_meta.pack_id ?? "unknown",
    version: raw.pack_meta.version ?? "unknown",
    schema_version: raw.pack_meta.schema_version ?? "1",
    fixture: raw.pack_meta.fixture === "true",
    ecfr_date: raw.pack_meta.ecfr_date ?? null,
    sources: raw.source as unknown as Source[],
    row_counts: counts,
  };

  // Retrieval units: every section with text, keyed by section id.
  const sectionIndex = new Bm25(
    [...sections.values()]
      .filter((s) => s.text.length > 0 || s.heading)
      .map((s) => ({ id: s.section_id, tokens: tokens(`${s.heading ?? ""} ${s.text}`) })),
  );
  const lexicon = new Lexicon(sectionIndex.vocab, () => [...sections.values()].map((s) => `${s.heading ?? ""} ${s.text}`));

  /**
   * The section a typed citation names: as typed, then with its paragraph
   * letters lowercased ("(C)" -> "(c)"), then one level up at a time, so
   * "1926.1419(z)" still opens §1926.1419.
   */
  const citedSection = (num: string, levels: string): string | null => {
    const parts = levels.match(/\([0-9a-zA-Z]{1,4}\)/g) ?? [];
    for (let n = parts.length; n >= 0; n--) {
      const head = parts.slice(0, n);
      for (const tail of [head.join(""), head.join("").toLowerCase()]) {
        const id = `29cfr${num}${tail}`;
        if (sections.has(id)) return id;
      }
      // Mixed levels, e.g. "(a)(2)(iii)(A)": lowercase all but a fourth-level capital.
      const mixed = head.map((p, i) => (i === 3 ? p.toUpperCase() : p.toLowerCase())).join("");
      if (sections.has(`29cfr${num}${mixed}`)) return `29cfr${num}${mixed}`;
    }
    return null;
  };

  // A section's own heading counts once more when it is the top of its group.
  const headingIndex = new Bm25(
    [...sections.values()].filter((s) => s.parent_id === null && s.heading).map((s) => ({ id: s.section_id, tokens: tokens(s.heading!) })),
  );

  const find = (query: string, max = 8): FindResult => {
    const started = t0();
    // A citation typed as words ("1926.1419", "§1926.1419(c)") opens its paragraph first.
    // Only a citation the pack holds is taken out of the words searched.
    const cited: string[] = [];
    const rest = query.replace(CITATION, (whole, num: string, levels: string) => {
      const id = citedSection(num, levels);
      if (!id) return whole;
      cited.push(id);
      return " ";
    });
    const resolved = resolveQuery(rest, lexicon);
    const terms = [...new Set(resolved.flatMap((r) => r.terms))];
    const readings: Reading[] = resolved.flatMap((r) =>
      r.via === "exact" || r.via === "none" ? [] : [{ word: r.word, as: r.shown ?? r.terms.map((t) => lexicon.said(t)), via: r.via }],
    );
    const byRoot = new Map<string, { section_id: string; score: number }[]>();
    for (const h of terms.length ? sectionIndex.score(terms, 400) : []) {
      const root = ancestors(h.id)[0]?.section_id ?? h.id;
      const list = byRoot.get(root) ?? [];
      list.push({ section_id: h.id, score: h.score });
      byRoot.set(root, list);
    }
    const heading = new Map(headingIndex.score(terms, 100).map((h) => [h.id, h.score]));
    const groups: RuleGroup[] = [...byRoot.entries()].map(([root_id, hits]) => {
      // The best paragraph decides; a few more matching paragraphs and a matching heading add a little.
      const score = hits[0]!.score + 0.3 * (hits[1]?.score ?? 0) + 0.15 * (hits[2]?.score ?? 0) + 0.5 * (heading.get(root_id) ?? 0);
      // A paragraph that says something, not a bare "Hand signals." heading, unless it is far behind.
      const textLen = (h: { section_id: string }) => sections.get(h.section_id)?.text.length ?? 0;
      const best = hits.find((h) => textLen(h) >= 40 && h.score >= 0.6 * hits[0]!.score) ?? hits.find((h) => textLen(h) > 0) ?? hits[0]!;
      return { root_id, best_id: best.section_id, hits: hits.slice(0, 12), score };
    });
    for (const id of cited.reverse()) {
      const root_id = ancestors(id)[0]?.section_id ?? id;
      const words = groups.find((g) => g.root_id === root_id);
      const group: RuleGroup = { root_id, best_id: id, hits: [{ section_id: id, score: words?.hits[0]?.score ?? 0 }, ...(words?.hits ?? []).filter((h) => h.section_id !== id)], score: words?.score ?? 0, cited: true };
      groups.splice(0, groups.length, ...groups.filter((g) => g.root_id !== root_id), group);
    }
    groups.sort((a, b) => Number(Boolean(b.cited)) - Number(Boolean(a.cited)) || b.score - a.score || (sections.get(a.root_id)?.ord ?? 0) - (sections.get(b.root_id)?.ord ?? 0));
    return { query, terms, readings, groups: groups.slice(0, max), pack_version: info.version, elapsed_ms: Math.round(t0() - started) };
  };

  const engine: Engine = {
    info,
    sections,
    children: (id) => kids.get(id) ?? [],
    ancestors,
    rootOf: (id) => ancestors(id)[0] ?? null,
    xrefsFrom: (id) => from.get(id) ?? [],
    xrefsTo: (id) => to.get(id) ?? [],
    explanation: (id, role, lang) =>
      raw.explanation.find((e) => e.section_id === id && e.level === role && e.lang === lang)?.body ?? null,
    topics: (raw.topic as unknown as Topic[]).slice().sort((a, b) => a.ord - b.ord),
    skills: raw.skill as unknown as SkillRow[],
    lessons,
    terms: (raw.term as unknown as Term[]).slice().sort((a, b) => a.term.localeCompare(b.term)),
    diagrams,
    questions,
    procedures,
    equipment,
    exams: raw.app.exams,
    prereqs: raw.app.prereqs,
    async find(query, max) {
      return find(query, max);
    },
  };
  return engine;
}
