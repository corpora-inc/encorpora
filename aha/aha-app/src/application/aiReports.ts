import type { Json } from "../storage";

/**
 * In-app reports of AI-generated activities (Google Play AI-Generated Content policy): a reason from a fixed list,
 * recorded locally against the exact activity and the Free2Z call that wrote it, then sent through `submitReport`.
 * No typed text is ever part of a report.
 */
export const REPORT_REASONS = [
  { id: "incorrect", label: "Incorrect" },
  { id: "inappropriate", label: "Inappropriate" },
  { id: "unsafe", label: "Unsafe" },
  { id: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
export const isReportReason = (value: unknown): value is ReportReason =>
  typeof value === "string" && REPORT_REASONS.some(r => r.id === value);

/** The account journal key of the report outbox (per Free2Z account, like the billing journal; never in backups). */
export const REPORTS_KEY = "aha-ai-reports";
const VERSION = 1;
/** Oldest sent reports are dropped first past this; unsent ones are never dropped to make room. */
export const MAX_REPORTS = 200;

export interface AiReport {
  id: string;
  /** The app's activity id (`${operationId}:${index}`). */
  activityId: string;
  /** The model-written Activity Spec id (not unique across batches; activityId is). */
  specId: string;
  /** The billing operation that paid for the batch, and its Free2Z call and receipt once known. */
  operationId: string;
  callId?: string;
  receiptId?: string;
  model?: string;
  reason: ReportReason;
  createdAt: string;
  /** When Free2Z accepted it; absent while it waits in the outbox. */
  sentAt?: string;
}

const text = (v: unknown, max = 256): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
function readReport(v: unknown): AiReport | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  if (!text(r.id) || !text(r.activityId) || !text(r.specId) || !text(r.operationId) || !isReportReason(r.reason) || !text(r.createdAt, 40)) return undefined;
  for (const k of ["callId", "receiptId", "model", "sentAt"] as const) if (r[k] !== undefined && !text(r[k])) return undefined;
  return {
    id: r.id, activityId: r.activityId, specId: r.specId, operationId: r.operationId, reason: r.reason, createdAt: r.createdAt,
    ...(r.callId ? { callId: r.callId as string } : {}), ...(r.receiptId ? { receiptId: r.receiptId as string } : {}),
    ...(r.model ? { model: r.model as string } : {}), ...(r.sentAt ? { sentAt: r.sentAt as string } : {}),
  };
}

/** The outbox as stored. Unreadable entries are dropped (and counted) rather than blocking new reports. */
export function readReports(data: Json): { reports: AiReport[]; dropped: number } {
  if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== VERSION || !Array.isArray(data.reports)) return { reports: [], dropped: 0 };
  const reports = data.reports.map(readReport).filter((r): r is AiReport => !!r);
  return { reports, dropped: data.reports.length - reports.length };
}

/** Appends a report (idempotent by activity: a second report of the same activity replaces nothing). */
export function appendReport(data: Json, report: AiReport): Json {
  const { reports } = readReports(data);
  if (reports.some(r => r.activityId === report.activityId)) return storeReports(reports);
  return storeReports([...reports, report]);
}

export function markSent(data: Json, id: string, at: string): Json {
  return storeReports(readReports(data).reports.map(r => (r.id === id ? { ...r, sentAt: at } : r)));
}

function storeReports(reports: AiReport[]): Json {
  let kept = reports;
  while (kept.length > MAX_REPORTS) {
    const i = kept.findIndex(r => r.sentAt);
    if (i < 0) break;
    kept = [...kept.slice(0, i), ...kept.slice(i + 1)];
  }
  return { version: VERSION, reports: kept as unknown as Json[] };
}

export const unsent = (data: Json): AiReport[] => readReports(data).reports.filter(r => !r.sentAt);

/**
 * Free2Z's report endpoint: one call per report, keyed by the AI call it is about. Undefined until the SDK this app
 * pins exposes one (the follow-up wires `reportCall(callId, reason, detail?)`); until then reports wait in the outbox.
 */
export type ReportSender = (callId: string, reason: ReportReason) => Promise<void>;

export type SubmitOutcome = "sent" | "queued";

/**
 * The one place a report leaves the device. Without a sender, or without the call id it needs, the report stays
 * queued (logged); a sender failure is logged and also leaves it queued for the next attempt. Never throws.
 */
export async function submitReport(report: AiReport, send: ReportSender | undefined, log: (level: "info" | "warn", message: string) => void): Promise<SubmitOutcome> {
  if (report.sentAt) return "sent";
  if (!send) { log("info", `report ${report.reason} on ${report.activityId} queued on this device; Free2Z report sending is not available in this SDK yet`); return "queued"; }
  if (!report.callId) { log("warn", `report ${report.reason} on ${report.activityId} queued: its Free2Z call id is not known yet`); return "queued"; }
  try {
    await send(report.callId, report.reason);
    return "sent";
  } catch (error) {
    log("warn", `report ${report.reason} on ${report.activityId} stays queued: ${error instanceof Error ? error.message : String(error)}`);
    return "queued";
  }
}
