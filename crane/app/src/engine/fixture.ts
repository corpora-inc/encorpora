/**
 * FIXTURE engine: the Engine interface over the hand-built sample pack
 * (src/engine/fixture/pack.json, built by scripts/build-fixture.mjs).
 * Lexical retrieval only, no model. Replaced by harvest-core when it lands.
 */
import { checkBody } from "./check.ts";
import { Bm25, tokens } from "./text.ts";
import type {
  AskOptions, AskResult, Diagram, Engine, Equipment, ExamBlueprintRow, Lesson, PackInfo, Procedure, Question,
  Role, SearchHit, Section, Segment, SkillRow, Source, Term, Topic,
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
  app: { prereqs: Record<string, string[]>; starters: Record<Role, string[]>; exams: ExamBlueprintRow[] };
}

const json = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

/** Thresholds for serving a baked answer from the alias index. */
export const MATCH = Object.freeze({ queryCoverage: 0.6, aliasCoverage: 0.5 });

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
  const questions: Question[] = raw.question.map((q) => ({
    ...(q as unknown as Question),
    choices: json<string[]>(q.choices ?? "[]"),
    rationales: json<string[]>(q.rationales ?? "[]"),
    section_ids: json<string[]>(q.section_ids),
  }));
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

  const answers = new Map(raw.answer.map((a) => [a.answer_id, a]));
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
  const aliasDocs = raw.answer_alias.map((a, i) => ({ id: String(i), tokens: tokens(a.alias) }));
  const aliasIndex = new Bm25(aliasDocs);

  /** Pick the variant for this role: an exact level match wins over the general answer. */
  const variantFor = (answerId: string, role: Role) => {
    const base = answers.get(answerId);
    if (!base) return null;
    const specific = answers.get(`${answerId.replace(/\.(trainee|operator|inspector)$/, "")}.${role}`);
    return specific ?? answers.get(answerId.replace(/\.(trainee|operator|inspector)$/, "")) ?? base;
  };

  const build = (a: RawPack["answer"][number], question: string, started: number): AskResult => {
    const checked = checkBody(json<Segment[]>(a.body), sections);
    return {
      mode: "baked",
      answer_id: a.answer_id.replace(/\.(trainee|operator|inspector)$/, ""),
      question,
      body: checked.body,
      citations: checked.citations,
      retrieved: [],
      check: { quotes_ok: checked.quotes_ok, cites_ok: checked.cites_ok, dropped: checked.dropped },
      nearest: [],
      pack_version: info.version,
      model: null,
      elapsed_ms: Math.round(t0() - started),
    };
  };

  const search = (query: string, k = 10): SearchHit[] =>
    sectionIndex.score(tokens(query), k).map((h) => ({ section_id: h.id, score: h.score }));

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
    starters: (role) =>
      (raw.app.starters[role] ?? []).flatMap((id) => {
        const a = variantFor(id, role);
        return a ? [{ answer_id: id, question: a.question }] : [];
      }),
    answer(answerId, role) {
      const a = variantFor(answerId, role);
      return a ? build(a, a.question, t0()) : null;
    },
    async ask(question: string, opts: AskOptions) {
      const started = t0();
      const q = tokens(question);
      const qset = new Set(q);
      // 1. The answer cache: an alias that covers the question.
      let best: { answerId: string; cover: number } | null = null;
      if (qset.size > 0) {
        for (const hit of aliasIndex.score(q, 8)) {
          const alias = aliasDocs[Number(hit.id)]!;
          const aset = new Set(alias.tokens);
          const both = [...qset].filter((t) => aset.has(t)).length;
          const qc = both / qset.size;
          const ac = aset.size ? both / aset.size : 0;
          if (qc >= MATCH.queryCoverage && ac >= MATCH.aliasCoverage) {
            const cover = qc + ac;
            const answerId = raw.answer_alias[Number(hit.id)]!.answer_id;
            if (!best || cover > best.cover) best = { answerId, cover };
          }
        }
      }
      const retrieved = search(question, 8).map((h) => ({ chunk_id: h.section_id, ref_id: h.section_id, lexical: h.score, dense: 0, score: h.score }));
      if (best) {
        const a = variantFor(best.answerId, opts.role);
        if (a) return { ...build(a, a.question, started), retrieved };
      }
      // 2. No model in the fixture: decline and point to the nearest sections.
      return {
        mode: "declined",
        answer_id: null,
        question,
        body: [],
        citations: [],
        retrieved,
        check: { quotes_ok: true, cites_ok: true, dropped: 0 },
        nearest: retrieved.slice(0, 4).map((r) => r.ref_id),
        pack_version: info.version,
        model: null,
        elapsed_ms: Math.round(t0() - started),
      };
    },
    async search(query, k) {
      return search(query, k);
    },
  };
  return engine;
}
