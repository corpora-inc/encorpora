import { SdkError } from "@free2z/sdk";
import type { Json } from "../storage";

/**
 * In-app reports of AI-generated activities (Google Play AI-Generated Content policy): a reason from a fixed list,
 * recorded locally against the exact activity and the Free2Z call that wrote it, then sent through `submitReport`
 * (Free2Z SDK `reportCall(callId, reason)`). No typed text is ever part of a report, and no `detail` is ever sent:
 * children use AHA, and a child-directed Free2Z app refuses one.
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
/**
 * The outbox holds at most this many reports, so it always fits the native record limit: past it the oldest sent
 * report goes first, then the oldest unsent one (which only happens when nothing can be sent for a long time).
 */
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
  /**
   * Free2Z refused it for good (its stable error code, e.g. `not_found` for a call this account did not make), so it is
   * never sent again. Kept, like a sent report, until the outbox needs the room.
   */
  refused?: string;
}

const text = (v: unknown, max = 256): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
function readReport(v: unknown): AiReport | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const r = v as Record<string, unknown>;
  if (!text(r.id) || !text(r.activityId) || !text(r.specId) || !text(r.operationId) || !isReportReason(r.reason) || !text(r.createdAt, 40)) return undefined;
  for (const k of ["callId", "receiptId", "model", "sentAt", "refused"] as const) if (r[k] !== undefined && !text(r[k])) return undefined;
  return {
    id: r.id, activityId: r.activityId, specId: r.specId, operationId: r.operationId, reason: r.reason, createdAt: r.createdAt,
    ...(r.callId ? { callId: r.callId as string } : {}), ...(r.receiptId ? { receiptId: r.receiptId as string } : {}),
    ...(r.model ? { model: r.model as string } : {}), ...(r.sentAt ? { sentAt: r.sentAt as string } : {}),
    ...(r.refused ? { refused: r.refused as string } : {}),
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

/** The stored report of an activity: what is sent and marked sent, so a repeat report never sends twice. */
export const reportFor = (data: Json, activityId: string): AiReport | undefined =>
  readReports(data).reports.find(r => r.activityId === activityId);

export function markSent(data: Json, id: string, at: string): Json {
  return storeReports(readReports(data).reports.map(r => (r.id === id ? { ...r, sentAt: at } : r)));
}

/** Records Free2Z's final refusal of a report, so it is never sent again. */
export function markRefused(data: Json, id: string, code: string): Json {
  return storeReports(readReports(data).reports.map(r => (r.id === id ? { ...r, refused: code.slice(0, 64) } : r)));
}

/** Fills in the Free2Z call id of a report recorded before the journal knew it. */
export function withCallId(data: Json, id: string, callId: string): Json {
  return storeReports(readReports(data).reports.map(r => (r.id === id && !r.callId ? { ...r, callId } : r)));
}

function storeReports(reports: AiReport[]): Json {
  let kept = reports;
  while (kept.length > MAX_REPORTS) {
    const sent = kept.findIndex(r => r.sentAt || r.refused);
    const i = sent >= 0 ? sent : 0;
    kept = [...kept.slice(0, i), ...kept.slice(i + 1)];
  }
  return { version: VERSION, reports: kept as unknown as Json[] };
}

export const unsent = (data: Json): AiReport[] => readReports(data).reports.filter(r => !r.sentAt && !r.refused);

/**
 * Free2Z's report endpoint (SDK `reportCall(callId, reason)`): one call per report, keyed by the AI call it is about.
 * A reason from the fixed list, never a `detail`.
 */
export type ReportSender = (callId: string, reason: ReportReason) => Promise<unknown>;

/**
 * - `sent`: Free2Z has it.
 * - `queued`: it waits in the outbox (no call id yet, offline, signed out, an older plugin); the next connect sends it.
 * - `busy`: Free2Z asked AHA to slow down (429 `rate_limited`/`concurrency_limit`); `retryAt` says when, if it said.
 * - `refused`: Free2Z will never take it (e.g. `not_found`: not a call of this account and app); it is not retried.
 */
export type SubmitOutcome =
  | { state: "sent" }
  | { state: "queued" }
  | { state: "busy"; retryAt?: number }
  | { state: "refused"; code: string };

/** Codes that mean Free2Z will never accept this report as it is. Anything else may work on a later try. */
const FINAL_REFUSALS = new Set(["not_found", "call_not_found", "invalid_request"]);
const BUSY = new Set(["rate_limited", "concurrency_limit"]);
const codeOf = (error: unknown): string | undefined =>
  error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;

/**
 * The one place a report leaves the device. Without a sender, or without the call id it needs, the report stays
 * queued (logged). Every failure is logged with its stable code and mapped to an outcome; the learner sees none of it,
 * since the activity is set aside either way. Never throws.
 */
export async function submitReport(report: AiReport, send: ReportSender | undefined, log: (level: "info" | "warn", message: string) => void, now = Date.now): Promise<SubmitOutcome> {
  if (report.sentAt) return { state: "sent" };
  if (report.refused) return { state: "refused", code: report.refused };
  if (!send) { log("info", `report ${report.reason} on ${report.activityId} queued on this device until Free2Z is connected`); return { state: "queued" }; }
  if (!report.callId) { log("warn", `report ${report.reason} on ${report.activityId} queued: its Free2Z call id is not known yet`); return { state: "queued" }; }
  try {
    await send(report.callId, report.reason);
    log("info", `report ${report.reason} on ${report.activityId} sent to Free2Z`);
    return { state: "sent" };
  } catch (error) {
    const code = codeOf(error);
    const detail = `${code ? `[${code}] ` : ""}${error instanceof Error ? error.message : String(error)}`;
    if (code && FINAL_REFUSALS.has(code)) {
      log("warn", `report ${report.reason} on ${report.activityId} refused by Free2Z; it will not be sent again: ${detail}`);
      return { state: "refused", code };
    }
    if (code && BUSY.has(code)) {
      const seconds = error instanceof SdkError ? error.retryAfterSeconds : undefined;
      const retryAt = typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? now() + Math.ceil(seconds * 1000) : undefined;
      log("warn", `report ${report.reason} on ${report.activityId} stays queued: Free2Z asked to slow down${retryAt ? ` for ${Math.ceil(seconds!)} s` : ""} ${detail}`);
      return retryAt === undefined ? { state: "busy" } : { state: "busy", retryAt };
    }
    log("warn", `report ${report.reason} on ${report.activityId} stays queued: ${detail}`);
    return { state: "queued" };
  }
}

/** The first wait after a failed send, doubled per further failure up to the cap. Free2Z's own Retry-After, when it sends one, is the wait. */
export const REPORT_RETRY_BASE_MS = 30_000;
export const REPORT_RETRY_MAX_MS = 30 * 60_000;

/** When the outbox may be tried again (in memory; a relaunch starts fresh, which is one more try at most). */
export class ReportBackoff {
  private failures = 0;
  private until = 0;
  ready(now: number): boolean { return now >= this.until; }
  get nextAt(): number { return this.until; }
  failed(now: number, retryAt?: number): void {
    const wait = Math.min(REPORT_RETRY_MAX_MS, REPORT_RETRY_BASE_MS * 2 ** Math.min(this.failures, 16));
    this.failures++;
    this.until = retryAt !== undefined && retryAt > now ? retryAt : now + wait;
  }
  succeeded(): void { this.failures = 0; this.until = 0; }
}

/**
 * One account's outbox. `update` is one read-modify-write, run one at a time with every other writer, so a send never
 * overwrites a report recorded meanwhile. Sends happen outside it: a slow Free2Z never holds the outbox.
 */
export interface OutboxStore { read(): Promise<Json>; update(change: (data: Json) => Json): Promise<void> }

export interface FlushResult { sent: number; refused: number; waiting: number; stopped?: "busy" | "failed" | "backoff" | "stale" }

/**
 * Sends what waits in one account's outbox, oldest first, one at a time. It stops at the first report that cannot go
 * now (Free2Z busy, offline), so a slow Free2Z is never hammered, and waits out the backoff (and any Retry-After)
 * before the next flush. A report recorded before its call id was known looks it up first. `current()` false (the
 * account changed) stops it before the next send, so one account's report never goes out under another.
 */
export async function flushReports(o: {
  store: OutboxStore; send: ReportSender; backoff: ReportBackoff;
  callFor?: (operationId: string) => Promise<string | undefined>;
  current: () => boolean | Promise<boolean>; now?: () => number; log: (level: "info" | "warn", message: string) => void;
}): Promise<FlushResult> {
  const now = o.now ?? Date.now;
  const result: FlushResult = { sent: 0, refused: 0, waiting: 0 };
  const waiting = unsent(await o.store.read());
  if (!waiting.length) return result;
  if (!o.backoff.ready(now())) {
    result.waiting = waiting.length; result.stopped = "backoff";
    o.log("info", `${waiting.length} report(s) wait until ${new Date(o.backoff.nextAt).toISOString()}`);
    return result;
  }
  for (let i = 0; i < waiting.length; i++) {
    let report = waiting[i];
    if (!(await o.current())) { result.waiting = waiting.length - i; result.stopped = "stale"; return result; }
    if (!report.callId && o.callFor) {
      const callId = await o.callFor(report.operationId);
      if (callId) {
        await o.store.update(data => withCallId(data, report.id, callId));
        report = { ...report, callId };
      }
    }
    if (!report.callId) { result.waiting++; continue; }
    if (!(await o.current())) { result.waiting = waiting.length - i; result.stopped = "stale"; return result; }
    const outcome = await submitReport(report, o.send, o.log, now);
    if (outcome.state === "sent") {
      const at = new Date(now()).toISOString();
      await o.store.update(data => markSent(data, report.id, at));
      result.sent++;
    } else if (outcome.state === "refused") {
      // A refusal under a session that changed meanwhile says nothing about this account's call: keep it queued.
      if (!(await o.current())) { result.waiting = waiting.length - i; result.stopped = "stale"; return result; }
      await o.store.update(data => markRefused(data, report.id, outcome.code));
      result.refused++;
    } else {
      o.backoff.failed(now(), outcome.state === "busy" ? outcome.retryAt : undefined);
      result.waiting += waiting.length - i;
      result.stopped = outcome.state === "busy" ? "busy" : "failed";
      return result;
    }
  }
  if (result.sent || result.refused) o.backoff.succeeded();
  return result;
}
