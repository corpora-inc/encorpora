/**
 * The engine seam. The app talks only to `Engine`. Today it is backed by the
 * fixture pack in TypeScript (fixture.ts); harvest-core replaces it with
 * in-process Tauri commands that read the signed SQLite pack. Row shapes
 * follow harvest/CONTRACT.md.
 */

export type Role = "trainee" | "operator" | "inspector";
export const ROLES: readonly Role[] = ["trainee", "operator", "inspector"];

export type Segment =
  | { t: "text"; text: string }
  | { t: "quote"; section_id: string; text: string }
  | { t: "cite"; section_id: string }
  | { t: "diagram"; diagram_id: string };

export interface Source {
  source_id: string;
  title: string;
  publisher: string;
  url: string;
  edition: string;
  retrieved_at: string;
  sha256: string;
  media_type: string;
  license: string;
}

export interface Section {
  section_id: string;
  source_id: string;
  parent_id: string | null;
  ord: number;
  depth: number;
  kind: string;
  citation: string;
  heading: string | null;
  text: string;
  lang: string;
}

export interface Term {
  term_id: string;
  term: string;
  definition: string;
  section_id: string;
  quote: string | null;
  lang: string;
}

export interface Topic {
  topic_id: string;
  parent_id: string | null;
  ord: number;
  title: string;
  summary: string;
  lang: string;
}

export interface SkillRow {
  skill_id: string;
  topic_id: string;
  title: string;
  lang: string;
}

export interface Lesson {
  lesson_id: string;
  topic_id: string;
  ord: number;
  title: string;
  body: Segment[];
  lang: string;
}

export interface Diagram {
  diagram_id: string;
  svg: string;
  caption: string;
  alt: string;
  section_ids: string[];
  lang: string;
}

export interface Question {
  q_id: string;
  skill_id: string;
  variant_of: string | null;
  kind: "mc" | "numeric" | "free_text";
  stem: string;
  choices: string[];
  answer: string;
  rationales: string[];
  section_ids: string[];
  difficulty: number;
  lang: string;
}

export interface Deficiency {
  guidance: string;
  action: string;
  section_id: string;
  quote: string;
}

export type CheckKind = "pass_fail" | "value" | "note" | "photo";

export interface ProcStep {
  proc_id: string;
  ord: number;
  text: string;
  detail: Record<Role, string>;
  check_kind: CheckKind;
  section_ids: string[];
  deficiency: Deficiency | null;
  lang: string;
}

export interface Procedure {
  proc_id: string;
  title: string;
  kind: string;
  summary: string;
  roles: Role[];
  steps: ProcStep[];
  lang: string;
}

export interface Equipment {
  equip_id: string;
  parent_id: string | null;
  name: string;
  aliases: string[];
}

export interface ExamBlueprintRow {
  id: string;
  title: string;
  minutes: number;
  passPercent: number;
  domains: { id: string; title: string; skillIds: string[]; count: number }[];
}

export interface Retrieved {
  chunk_id: string;
  ref_id: string;
  lexical: number;
  dense: number;
  score: number;
}

export interface AskResult {
  mode: "baked" | "composed" | "declined";
  answer_id: string | null;
  question: string;
  body: Segment[];
  citations: string[];
  retrieved: Retrieved[];
  check: { quotes_ok: boolean; cites_ok: boolean; dropped: number };
  nearest: string[];
  pack_version: string;
  model: string | null;
  elapsed_ms: number;
}

export interface SearchHit {
  section_id: string;
  score: number;
}

export interface PackInfo {
  pack_id: string;
  version: string;
  schema_version: string;
  fixture: boolean;
  ecfr_date: string | null;
  sources: Source[];
  row_counts: Record<string, number>;
}

export interface AskOptions {
  role: Role;
  equip?: string | null;
  lang: string;
}

/** Everything static is available synchronously once the pack is open. */
export interface Engine {
  info: PackInfo;
  sections: ReadonlyMap<string, Section>;
  children(sectionId: string): Section[];
  /** Root-to-leaf path, inclusive. */
  ancestors(sectionId: string): Section[];
  /** The top-level section (or appendix) that contains this id. */
  rootOf(sectionId: string): Section | null;
  xrefsFrom(sectionId: string): string[];
  xrefsTo(sectionId: string): string[];
  explanation(sectionId: string, role: Role, lang: string): string | null;
  topics: Topic[];
  skills: SkillRow[];
  lessons: Lesson[];
  terms: Term[];
  diagrams: ReadonlyMap<string, Diagram>;
  questions: Question[];
  procedures: Procedure[];
  equipment: Equipment[];
  exams: ExamBlueprintRow[];
  prereqs: Record<string, string[]>;
  starters(role: Role): { answer_id: string; question: string }[];
  /** Baked answer by id, picking the variant for the role. */
  answer(answerId: string, role: Role): AskResult | null;
  ask(question: string, opts: AskOptions): Promise<AskResult>;
  search(query: string, k?: number): Promise<SearchHit[]>;
}
