/**
 * Per-model quality and cost figures for comparing Free2Z models by hand. Local data only, no names, prompts, answers or
 * account ids: a small batch log (one record per delivered batch), the billing journal's settled charges, and the
 * learners' ai-spec evidence and flags. Pure; the controller gathers the inputs.
 */

/** One delivered batch: which model wrote it and what validation kept. Written once per billing operation. */
export interface BatchRecord {
  op: string;
  model: string;
  /** UTC day only. */
  day: string;
  structured: boolean;
  kept: number;
  /** Rejected by shape (what a strict schema could have prevented, including JSON damage). */
  schema: number;
  /** Rejected by the semantic rules (keyCheck, figure references, TeX safety, duplicates…). */
  semantic: number;
  /** The reply held no readable activity at all. */
  unreadable?: true;
}
export const BATCH_LOG_KEY = 'aha-model-batches-v1';
/** Most recent batches kept; about 120 bytes each, far inside the native 512 KiB record limit. */
export const MAX_BATCH_LOG = 400;
const safeId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120 && /^[A-Za-z0-9._:/@+-]+$/.test(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 100;
function validRecord(value: unknown): value is BatchRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return safeId(r.op) && safeId(r.model) && typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) && typeof r.structured === 'boolean' &&
    count(r.kept) && count(r.schema) && count(r.semantic) && (r.unreadable === undefined || r.unreadable === true) &&
    Object.keys(r).every(k => ['op', 'model', 'day', 'structured', 'kept', 'schema', 'semantic', 'unreadable'].includes(k));
}
/** Unreadable records are skipped, never fatal: these are statistics, not evidence. */
export function readBatchLog(value: unknown): BatchRecord[] {
  const list = value && typeof value === 'object' && (value as {version?: unknown}).version === 1 ? (value as {batches?: unknown}).batches : undefined;
  return Array.isArray(list) ? list.filter(validRecord).slice(-MAX_BATCH_LOG) : [];
}
/** Appends a batch once per operation (a redelivered or recovered batch is not counted twice). */
export function appendBatch(value: unknown, record: BatchRecord): {version: 1; batches: BatchRecord[]} | undefined {
  if (!validRecord(record)) return undefined;
  const batches = readBatchLog(value);
  if (batches.some(b => b.op === record.op)) return undefined;
  return {version: 1, batches: [...batches, record].slice(-MAX_BATCH_LOG)};
}

/** A settled activity-batch operation from the billing journal. */
export interface BatchCharge { operationId: string; model: string; charged2z?: bigint }
/** One recorded answer to an AI-authored activity. `model` is absent on evidence written before attribution. */
export interface SpecAnswer { activityId: string; model?: string; correct: boolean }
export interface StatsInput {
  batches: readonly BatchRecord[];
  charges: readonly BatchCharge[];
  answers: readonly SpecAnswer[];
  /** Activity ids the learner set aside with "Something seems off". */
  flags: readonly string[];
}
export interface ModelStats {
  model: string;
  batches: number;
  kept: number;
  rejectedSchema: number;
  rejectedSemantic: number;
  unreadable: number;
  /** "Something seems off" on an activity this model wrote. */
  flags: number;
  /** Settled, charged batches and their total, for the average. */
  chargedBatches: number;
  charged2z: bigint;
  /** Answers recorded (each AI activity records its first answer only) and how many of those were correct. */
  answered: number;
  firstTryCorrect: number;
}
/** AI activity ids are `${operationId}:${index}`; local activity ids have no colon. */
const operationOf = (activityId: string) => { const i = activityId.lastIndexOf(':'); return i > 0 ? activityId.slice(0, i) : undefined; };

export function aggregateModelStats(input: StatsInput): ModelStats[] {
  const byModel = new Map<string, ModelStats>();
  const stats = (model: string) => {
    let s = byModel.get(model);
    if (!s) byModel.set(model, s = {model, batches: 0, kept: 0, rejectedSchema: 0, rejectedSemantic: 0, unreadable: 0, flags: 0, chargedBatches: 0, charged2z: 0n, answered: 0, firstTryCorrect: 0});
    return s;
  };
  // Older activities carry no model of their own: their billing operation names it.
  const modelOf = new Map<string, string>();
  for (const c of input.charges) if (safeId(c.model)) modelOf.set(c.operationId, c.model);
  for (const b of input.batches) modelOf.set(b.op, b.model);
  for (const b of input.batches) {
    const s = stats(b.model);
    s.batches++; s.kept += b.kept; s.rejectedSchema += b.schema; s.rejectedSemantic += b.semantic; if (b.unreadable) s.unreadable++;
  }
  for (const c of input.charges) {
    if (!safeId(c.model) || c.charged2z === undefined) continue;
    const s = stats(c.model); s.chargedBatches++; s.charged2z += c.charged2z;
  }
  const answered = new Set<string>();
  for (const a of input.answers) {
    if (answered.has(a.activityId)) continue;
    answered.add(a.activityId);
    const op = operationOf(a.activityId);
    const model = safeId(a.model) ? a.model : op ? modelOf.get(op) : undefined;
    if (!model) continue;
    const s = stats(model); s.answered++; if (a.correct) s.firstTryCorrect++;
  }
  const flagged = new Set<string>();
  for (const id of input.flags) {
    if (flagged.has(id)) continue;
    flagged.add(id);
    const op = operationOf(id), model = op ? modelOf.get(op) : undefined;
    if (model) stats(model).flags++;
  }
  return [...byModel.values()].sort((a, b) => b.batches - a.batches || a.model.localeCompare(b.model));
}

/** "3.5" from 7 over 2, one decimal, exact integer arithmetic. */
function average(total: bigint, n: number): string {
  const tenths = (total * 10n + BigInt(n) / 2n) / BigInt(n);
  return `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''}`;
}
/** One compact line per model, for Settings and the problem report. Model ids come from the Free2Z catalogue. */
export function describeModelStats(s: ModelStats): string {
  const parts = [
    `${s.batches} ${s.batches === 1 ? 'set' : 'sets'}`,
    `kept ${s.kept}, rejected ${s.rejectedSchema} schema + ${s.rejectedSemantic} semantic${s.unreadable ? `, ${s.unreadable} unreadable` : ''}`,
    `${s.flags} flagged`,
    s.chargedBatches ? `≈ ${average(s.charged2z, s.chargedBatches)} 2Z per set` : 'no settled charge',
    s.answered ? `${Math.round((s.firstTryCorrect / s.answered) * 100)}% correct first try (${s.answered})` : 'no answers yet',
  ];
  return `${s.model}: ${parts.join(' · ')}`;
}
export function modelStatsLines(stats: readonly ModelStats[]): string[] {
  return stats.length ? stats.map(describeModelStats) : ['No AI activity sets yet.'];
}
