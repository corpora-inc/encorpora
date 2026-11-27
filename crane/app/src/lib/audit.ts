/** On-device audit log of answers: question, mode, citations, pack version. */
import type { AskResult } from "../engine/types.ts";
import { logError } from "./log.ts";

const KEY = "crane.audit";
const MAX = 500;

export interface AuditEntry {
  at: string;
  question: string;
  mode: AskResult["mode"];
  answer_id: string | null;
  citations: string[];
  retrieved: string[];
  pack_version: string;
  model: string | null;
}

export function audit(r: AskResult): void {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as AuditEntry[];
    list.push({
      at: new Date().toISOString(),
      question: r.question,
      mode: r.mode,
      answer_id: r.answer_id,
      citations: r.citations,
      retrieved: r.retrieved.slice(0, 8).map((x) => x.ref_id),
      pack_version: r.pack_version,
      model: r.model,
    });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch (e) {
    logError("audit", e);
  }
}

export function auditEntries(): AuditEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as AuditEntry[];
  } catch (e) {
    logError("audit.read", e);
    return [];
  }
}

/** Share of answers served from the bake. */
export function bakeHitRate(entries = auditEntries()): number | null {
  if (entries.length === 0) return null;
  return entries.filter((e) => e.mode === "baked").length / entries.length;
}
