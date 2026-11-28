/**
 * The real pack in the browser: the `harvest-show/1` JSON that
 * crane/content/build-pack.sh writes (everything harvest-core's read API
 * returned for the signed pack; see harvest/CONTRACT.md "Read-back check").
 * It is converted to the row tables the engine reads, so the fixture (tests
 * only) and the real pack run through one engine.
 */
import type { RawPack } from "./fixture.ts";
import type { ExamBlueprintRow } from "./types.ts";

type Row = Record<string, unknown>;

export interface ShowPack {
  format: "harvest-show/1";
  info: { pack_id: string; built_at?: string; version?: string; schema_version?: number | string; row_counts?: Record<string, number>; sources?: Row[] };
  sections: Row[];
  topics: Row[];
  skills: Row[];
  lessons: Row[];
  terms: Row[];
  diagrams: Row[];
  questions: Row[];
  procedures: (Row & { proc_id: string; steps: Row[] })[];
  exams: ExamBlueprintRow[] | null;
  prereqs: Record<string, string[]> | null;
}

/** "eCFR up to date as of 2026-11-24" -> "2026-11-24". */
function ecfrDate(sources: Row[]): string | null {
  for (const s of sources) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(String(s.edition ?? ""));
    if (m && String(s.source_id ?? "").startsWith("ecfr")) return m[1]!;
  }
  return null;
}

/** Rows that only group sections (a subpart). The app's rule tree starts at sections and appendices. */
const CONTAINERS = new Set(["subpart", "part"]);

/**
 * Sections rooted at the section or appendix: a container row is left out,
 * its children become roots, and depths count from the root. Reader pages,
 * search groups and the rules list all work per section.
 */
function sectionRooted(rows: Row[]): Row[] {
  const containers = new Set(rows.filter((r) => CONTAINERS.has(String(r.kind))).map((r) => String(r.section_id)));
  const byId = new Map(rows.map((r) => [String(r.section_id), r]));
  const lift = (r: Row): number => {
    let n = 0;
    for (let p = r.parent_id as string | null; p; p = (byId.get(p)?.parent_id as string | null) ?? null) if (containers.has(p)) n++;
    return n;
  };
  return rows
    .filter((r) => !containers.has(String(r.section_id)))
    .map((r) => ({
      ...r,
      parent_id: r.parent_id && containers.has(String(r.parent_id)) ? null : r.parent_id,
      depth: Number(r.depth) - lift(r),
    }));
}

export function fromShow(show: ShowPack): RawPack {
  if (show.format !== "harvest-show/1") throw new Error(`pack format ${String(show.format)}, expected harvest-show/1`);
  const sources = show.info.sources ?? [];
  const version = show.info.version ?? show.info.built_at ?? "unknown";
  return {
    pack_meta: {
      pack_id: show.info.pack_id,
      version,
      schema_version: String(show.info.schema_version ?? "1"),
      fixture: "false",
      ...(ecfrDate(sources) ? { ecfr_date: ecfrDate(sources)! } : {}),
      row_counts: JSON.stringify(show.info.row_counts ?? {}),
    },
    source: sources,
    section: sectionRooted(show.sections),
    // The read API lists no cross references, explanations or equipment yet: the screens show none.
    xref: [],
    equipment: [],
    term: show.terms,
    explanation: [],
    topic: show.topics,
    skill: show.skills,
    lesson: show.lessons,
    diagram: show.diagrams,
    question: show.questions,
    // Ask has no answer cache: answers are never read.
    answer: [],
    answer_alias: [],
    procedure: show.procedures.map(({ steps: _steps, ...p }) => p),
    proc_step: show.procedures.flatMap((p) => p.steps.map((s) => ({ ...s, proc_id: p.proc_id }))),
    app: { prereqs: show.prereqs ?? {}, exams: show.exams ?? [] },
  };
}
