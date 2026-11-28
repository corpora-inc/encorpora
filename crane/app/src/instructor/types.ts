/**
 * Instructor turns, as harvest/CONTRACT.md "Instructor turns" defines them.
 * The app owns the conversation; the engine answers one turn at a time.
 */

export type NodeField = "summary" | "hard" | "mistakes" | "exam";

export type Input =
  | { kind: "open"; node_id: string; fields?: NodeField[] }
  | { kind: "rules"; node_id: string }
  | { kind: "practice"; skill_id: string }
  | { kind: "focus" };

export interface FollowUp {
  label: string;
  ask?: string;
  to?: string;
  input?: Input;
}

export interface Crumb {
  node_id: string;
  level: string;
  title: string;
}

export interface FocusItem {
  node_id: string;
  title: string;
  domain: string;
  weight: number;
  mastery: number | null;
}

export type Block =
  | { t: "text"; text: string }
  | { t: "quote"; section_id: string; text: string }
  | { t: "cite"; section_id: string }
  | { t: "node"; node_id: string; level: string; title: string; path: Crumb[]; texts: { field: string; text: string }[] }
  | { t: "exam"; exam_id: string }
  | { t: "lesson"; lesson_id: string }
  | { t: "film"; film_id: string; node_id: string }
  | { t: "diagram"; diagram_id: string }
  | { t: "question"; q_id: string; chosen?: number }
  | { t: "focus"; items: FocusItem[] }
  | { t: "tool"; tool: "clearance" | "load-chart" | "signals"; input?: { kv?: number; traveling?: boolean } }
  | { t: "search"; query: string };

export interface Turn {
  turn_id: string;
  who: "learner" | "instructor";
  status: "streaming" | "done" | "error";
  blocks: Block[];
  follow_ups: FollowUp[];
  model: string | null;
  at?: string | null;
  created_at: string;
}

export interface Conversation {
  conv_id: string;
  title: string;
  created_at: string;
  pack_version: string;
  turns: Turn[];
}

/** A course-tree node (CONTRACT course_node), for free-text lookup and focus. */
export interface CourseNode {
  node_id: string;
  parent_id: string | null;
  ord: number;
  level: string;
  title: string;
  summary: string;
  hard: string;
  mistakes: string;
  exam: string;
  section_ids?: string[];
  links?: { node_ids?: string[]; lesson_ids?: string[]; skill_ids?: string[] };
}

/** What the browser build reads: the welcome and the tree turns the real engine answered (scripts/instructor-turns.py). */
export interface InstructorPack {
  format: "crane-instructor/1";
  welcome: Omit<Turn, "turn_id" | "created_at">;
  turns: Record<string, Omit<Turn, "turn_id" | "created_at">>;
  nodes: CourseNode[];
}

/** The key a tree move is stored under: "open:<node>[:fields]" or "rules:<node>". */
export function inputKey(i: Input): string | null {
  if (i.kind === "rules") return `rules:${i.node_id}`;
  if (i.kind === "open") return `open:${i.node_id}${i.fields?.length ? `:${i.fields.join(",")}` : ""}`;
  return null;
}
