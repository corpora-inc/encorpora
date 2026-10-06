import { Client, NativeTransport, SdkError, type ChatRequest, type ChatStream, type Charge, type Estimate, type Grant, type Models, type ObjectData, type Preflight, type Session, type SignInOptions } from '@free2z/sdk';
import { nativeBridge } from '@free2z/tauri-plugin-f2z-api';
import { diagnostics } from '../diagnostics/log';

export interface Journal { getJournal(key: string): Promise<unknown>; putJournal(key: string, value: any): Promise<void> }
export type SdkClient = Pick<Client, 'session' | 'signIn' | 'signOut' | 'balance' | 'grant' | 'models' | 'estimate' | 'preflight' | 'chat' | 'call'>;
export interface GrantPolicy { subject: string; clientId: string }
export type CapPeriod = Grant['cap_period'];
const CAP_PERIODS: readonly CapPeriod[] = ['day', 'week', 'month', 'total'];
/** The user's own optional app budget, read back from Free2Z. `null`: no app budget (bounded by the 2Z balance). */
export type AppBudget = Readonly<{ period: CapPeriod; limit2z: bigint }> | null;
export interface VerifiedGrant {
  subject: string; clientId: string; budget: AppBudget;
  sessionGeneration: string; asOf: string; checkedAt: number;
}
/** Live proof that this account and app may make paid calls now. Never persisted; never a spending ceiling. */
export interface PaidAuthorization extends GrantPolicy { verifiedGrant: VerifiedGrant }
const GRANT_MAX_AGE_MS = 60_000;
/**
 * A modest app budget AHA suggests at sign-in (100 2Z per month). Only a consent-screen pre-selection:
 * Free2Z may lower or ignore it (registration default, an existing grant's period), and the user may
 * change or remove it there or later at free2z.cash/account/apps. Admission never compares a grant with it.
 */
export const SUGGESTED_SPEND_CAP_2Z = 100n;
export const SIGN_IN_OPTIONS: Readonly<SignInOptions> = Object.freeze({
  spendCap: Object.freeze({cap2z: SUGGESTED_SPEND_CAP_2Z, period: 'month' as const}),
});
/**
 * Production policy, "budget optional" (#879). Admits paid AI for this account and app when the grant is
 * fresh, carries `ai:invoke`, and Free2Z enforces it. Any budget (amount, period) or none is the user's choice.
 * `enforced: false` (e.g. `platform_disabled`) is Free2Z's pre-activation state: AI is not ready, no paid calls.
 * Read-only live snapshot: never persist it as spending authority or treat revocation stamps as policy versions.
 */
export async function verifyPaidGrant(
  client: Pick<SdkClient, 'session' | 'grant'>, policy: GrantPolicy, now: () => number = Date.now,
): Promise<VerifiedGrant> {
  if (!policy || !opaque(policy.subject) || !opaque(policy.clientId))
    throw new TutorServiceError('authorization_required', 'Identify the signed-in account and registered app before using paid AI.');
  const before = await client.session();
  const selected = (session: Session) => session.signedIn && session.subject === policy.subject && session.grantedScopes.includes('ai:invoke') && opaque(session.generation);
  if (!selected(before)) throw new TutorServiceError('account_changed', 'The Free2Z account must remain signed in with AI access.');
  const grant = await client.grant();
  const after = await client.session();
  if (!selected(after) || after.generation !== before.generation)
    throw new TutorServiceError('account_changed', 'The Free2Z account changed while verifying consent.');
  const checkedAt = now(); const asOf = Date.parse(grant?.as_of);
  const reason = grant?.enforcement_reason;
  if (!grant || grant.sub !== policy.subject || grant.client_id !== policy.clientId || typeof grant.enforced !== 'boolean' ||
      // A reason that contradicts `enforced` is a protocol error (zuu spec/grant.md); the SDK also refuses it.
      (reason !== undefined && (reason === 'ok') !== grant.enforced) ||
      !CAP_PERIODS.includes(grant.cap_period) || (grant.spend_cap_2z !== null && (typeof grant.spend_cap_2z !== 'bigint' || grant.spend_cap_2z < 0n)) ||
      typeof grant.account_epoch !== 'bigint' || grant.account_epoch < 0n || typeof grant.grant_generation !== 'bigint' || grant.grant_generation <= 0n ||
      !Array.isArray(grant.scopes) || !grant.scopes.includes('ai:invoke') || typeof grant.as_of !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:[Zz]|\+00:00)$/.test(grant.as_of) ||
      !Number.isFinite(asOf) || new Date(asOf).toISOString().slice(0,19) !== grant.as_of.slice(0,19).toUpperCase() || !Number.isFinite(checkedAt) || checkedAt - asOf > GRANT_MAX_AGE_MS || asOf - checkedAt > 5_000)
    throw new TutorServiceError('grant_verification_required', 'Free2Z must freshly confirm AI access for this account and app.');
  if (grant.enforced !== true) {
    // Gate on `enforced` alone; the reason only picks the explanation (INTEGRATION.md, "User-owned budgets").
    if (reason === 'ledger_cap_pending')
      throw new TutorServiceError('budget_pending', 'Free2Z is still setting up spending for this app. No paid request was sent.');
    throw new TutorServiceError('ai_not_ready', 'Free2Z has not switched on paid AI for apps yet. No paid request was sent.');
  }
  const budget: AppBudget = grant.spend_cap_2z === null ? null : Object.freeze({period: grant.cap_period, limit2z: grant.spend_cap_2z});
  return Object.freeze({subject: policy.subject, clientId: policy.clientId, budget, sessionGeneration: after.generation, asOf: grant.as_of, checkedAt});
}
/** What one affordable estimate showed. Amounts in whole 2Z (`hold2z`) and milli-2Z. */
export interface AdmittedEstimate { hold2z: bigint; availableMilli2z: bigint; capRemainingMilli2z: bigint | null }
/**
 * The one affordability rule before any paid send: the estimate's hold (the most `/v1/chat` would reserve
 * now) must fit the available balance and, whenever Free2Z reports one, the app budget's remainder.
 * A budgeted grant must come with a remainder; a remainder appearing for an unbudgeted grant still binds.
 */
export function admitEstimate(estimate: Estimate, budget: AppBudget, availableFallback?: bigint): AdmittedEstimate {
  const hold = estimate.hold_2z, reported = estimate.available_milli_2z, cap = estimate.cap_remaining_milli_2z;
  const available = reported === undefined ? availableFallback : reported;
  if (typeof hold !== 'bigint' || hold <= 0n || typeof available !== 'bigint' || available < 0n ||
      (cap !== undefined && cap !== null && (typeof cap !== 'bigint' || cap < 0n)))
    throw new TutorServiceError('estimate_invalid', 'Free2Z returned an incomplete estimate. No paid request was sent.');
  if (budget !== null && typeof cap !== 'bigint')
    throw new TutorServiceError('grant_verification_required', 'Free2Z did not report what is left of this app\u2019s budget. No paid request was sent.');
  // The hold is what the next request needs: the amount the low-balance message names.
  if (hold * 1000n > available) throw refusal('insufficient_balance', hold);
  if (typeof cap === 'bigint' && hold * 1000n > cap) throw refusal('cap_exceeded', hold);
  return {hold2z: hold, availableMilli2z: available, capRemainingMilli2z: typeof cap === 'bigint' ? cap : null};
}
/**
 * Every paid request sets `max_output_tokens_strict`: the output budget is required, not a ceiling. Free2Z refuses
 * an unaffordable request (HTTP 402/403, `details.reason`) at zero cost instead of silently shrinking the budget and
 * charging for a truncated batch. Relies on gateway image 70b74edd9 (da1862531) or later.
 */
const REFUSAL_CODES = ['insufficient_balance', 'cap_exceeded'];
/** Codes of the refusals that provably cost nothing: Free2Z (or AHA's own check) refused before any hold. */
const ZERO_CHARGE_CODES = [...REFUSAL_CODES, 'not_enough_2z', 'too_large'];
const NOT_ENOUGH_2Z = 'Not enough 2Z for the next set of activities. Nothing was charged.';
const REFUSAL_MESSAGES: Record<string, string> = {
  insufficient_balance: 'There isn’t enough 2Z in your Free2Z account for AI activities right now. The refusal cost nothing.',
  cap_exceeded: 'App budget reached: raise it in Free2Z. The refusal cost nothing.',
  not_enough_2z: NOT_ENOUGH_2Z,
};
/** A positive whole-2Z amount, or `undefined`: anything else from the wire is never shown. */
const positive2z = (value: unknown): bigint | undefined => typeof value === 'bigint' && value > 0n ? value : undefined;
function refusal(code: string, required2z?: unknown): TutorServiceError {
  return new TutorServiceError(code, REFUSAL_MESSAGES[code] ?? NOT_ENOUGH_2Z, undefined, positive2z(required2z));
}
/**
 * A strict refusal from Free2Z, mapped to a calm zero-charge error; `undefined` for anything else (which stays uncertain).
 * Since zuu d4d58ea3 (#1136) the native transport keeps the refusal's documented `details` (`reason`, `required_2z`,
 * `cap_remaining_milli_2z`; amounts as bigint). An older plugin dropped them, so the gateway's refusal code
 * (`insufficient_balance`, `cap_exceeded`) on a 402/403 still counts the same as one carrying `details.reason`.
 * zuu#1145: `cap_exceeded` does not carry `resets_at`/`cap_2z`/`cap_period` yet; nothing here reads them.
 */
export function strictRefusal(error: unknown): TutorServiceError | undefined {
  if (!(error instanceof SdkError) || (error.status !== 402 && error.status !== 403) || error.callId || error.record) return undefined;
  const details: unknown = error.details, reason = object(details) ? details.reason : undefined;
  const known = REFUSAL_CODES.includes(error.code);
  if (!known && (typeof reason !== 'string' || !reason)) return undefined;
  const code = typeof reason === 'string' && REFUSAL_CODES.includes(reason) ? reason : known ? error.code : 'not_enough_2z';
  return refusal(code, object(details) ? details.required_2z : undefined);
}
const TOO_LARGE = 'This request is too large for the chosen Free2Z model. Nothing was charged.';
/**
 * The SDK's preflight outcome (zuu d4d58ea3) as AHA's admission errors: `needs_top_up` and `needs_budget` are the
 * zero-cost refusals above, with the required 2Z when Free2Z reports it; `too_large` (context window, or the strict
 * output ceiling) is zero-cost too. `ready` returns the estimate for the local balance and budget check.
 */
function preflightEstimate(checked: Preflight): Estimate {
  switch (checked.kind) {
    case 'ready': return checked.estimate;
    case 'needs_top_up': throw refusal('insufficient_balance', checked.required2z);
    case 'needs_budget': throw refusal('cap_exceeded', checked.required2z);
    case 'too_large': throw new TutorServiceError('too_large', TOO_LARGE);
  }
}
/**
 * Structured output (zuu 42acc57f): a JSON Schema `response_format` plus the system prompt to send with it
 * (the prompt-only variant's inline grammar is dropped, since the schema carries the shape).
 */
export interface StructuredOutput { name: string; schema: Record<string, unknown>; system: string }
/** The exact `response_format` sent, and journaled (v3) so same-key recovery resends an identical body. */
export interface SavedResponseFormat { type: 'json_schema'; json_schema: { name: string; schema: Record<string, unknown>; strict: true } }
/** Gateway limits on `response_format` (chat-api.md): the SDKs and the gateway refuse anything outside them. */
const MAX_SCHEMA_BYTES = 32 * 1024;
export const RESPONSE_FORMAT_UNSUPPORTED = 'response_format_unsupported';
/** The gateway's zero-cost refusals of the field (zuu 42acc57f): model unsupported, unknown `type`, or an explicit `null`. */
const FORMAT_REFUSAL_REASONS = [RESPONSE_FORMAT_UNSUPPORTED, 'unsupported', 'null'];
/** Only `capabilities.structured_output === true` counts (typed by the SDK since zuu #1137); absent or false is unsupported. */
export function supportsStructuredOutput(catalog: Models, model: string): boolean {
  return structuredCapability(catalog, model) === 'advertised';
}
/**
 * Why the catalogue does or does not offer structured output for `model`, for the per-batch log. The SDK types the
 * catalogue (zuu #1137): `capabilities` is always an object, a declared member is a boolean, and a non-boolean fails
 * the whole `models()` read (`invalid_response`) before AHA sees it.
 */
export function structuredCapability(catalog: Models, model: string): 'advertised' | 'model_not_in_catalog' | 'structured_output_absent' | 'structured_output_false' {
  const entry = catalog.models.find(m => m.id === model);
  if (!entry) return 'model_not_in_catalog';
  const flag = entry.capabilities.structured_output;
  return flag === true ? 'advertised' : flag === false ? 'structured_output_false' : 'structured_output_absent';
}
/**
 * The catalogue capability (zuu#1151) under which the gateway accepts `reasoning_effort`. Until a model advertises it the
 * field is never sent: today's gateway refuses unknown fields (400, no charge), and the native plugin pinned at d63959f9
 * deserialises `ChatRequest` with `deny_unknown_fields`, so it also needs the SDK/plugin bump that ships with the flag.
 */
export const REASONING_EFFORT_CAPABILITY = 'reasoning_effort';
/** Activity batches ask for the least thinking: the set is short, structured, and the hidden tokens bill as output. */
export type ReasoningEffort = 'low';
/** The request type plus the field zuu#1151 adds. Absent is never sent. */
type EffortRequest = ChatRequest & { reasoning_effort?: ReasoningEffort };
export function supportsReasoningEffort(catalog: Models, model: string): boolean {
  return catalog.models.find(m => m.id === model)?.capabilities[REASONING_EFFORT_CAPABILITY] === true;
}
/**
 * One content-free line per activity batch: whether the request that goes out carries `response_format`, and if
 * not, why. Never the schema, prompt or reply.
 */
export function describeBatchRequest(request: ChatRequest, why: string, phase: 'send' | 'recovery'): string {
  const format = request.response_format;
  const transport = 'stream'; // The native plugin offers only the streamed chat (start_chat/next_chat).
  const effort = (request as EffortRequest).reasoning_effort ? ` reasoning_effort=${(request as EffortRequest).reasoning_effort}` : '';
  if (format?.type === 'json_schema')
    return `batch ${phase}: structured=yes model=${request.model} response_format.type=json_schema strict=${format.json_schema.strict === true} json_schema.name=${format.json_schema.name} transport=${transport}${effort}`;
  return `batch ${phase}: structured=no reason=${format ? `response_format.type_${format.type}` : why} model=${request.model} transport=${transport}${effort}`;
}
/**
 * A refusal of `response_format` itself, which Free2Z makes before any hold, charge or provider request:
 * `400 invalid_request` with `details.reason` `response_format_unsupported`, `unsupported` (field `response_format.type`)
 * or `null` (field `response_format`).
 * The native transport drops `details`, so a bare 400 `invalid_request` on a request that carried
 * `response_format` counts too; so does the SDK's own pre-send limit check (`invalid_request`, no status).
 * Every `invalid_request` is refused before a hold (spec/errors.md), so none of these cost anything.
 */
export function formatRefusal(error: unknown): boolean {
  if (!(error instanceof SdkError) || error.code !== 'invalid_request' || error.callId || error.record) return false;
  if (error.status !== undefined && error.status !== 400) return false;
  const details: unknown = error.details;
  if (details === undefined) return true;
  return object(details) && typeof details.reason === 'string' && FORMAT_REFUSAL_REASONS.includes(details.reason) &&
    // When the gateway names the field, it must be response_format itself (`null`/`unsupported` are generic words).
    (details.field === undefined || (typeof details.field === 'string' && details.field.startsWith('response_format')));
}
/**
 * Marks the errors this module throws where it recognised a format refusal. The fallback tests for the private
 * marker, never for the code string, which a service error event could also carry after a charge.
 */
const FORMAT_REFUSAL = Symbol('format refusal');
const formatUnsupported = () => Object.assign(new TutorServiceError(RESPONSE_FORMAT_UNSUPPORTED, 'Free2Z did not accept structured output for this model.'), {[FORMAT_REFUSAL]: true});
const isFormatRefusal = (error: unknown) => error instanceof TutorServiceError && (error as unknown as Record<symbol, unknown>)[FORMAT_REFUSAL] === true;
function validResponseFormat(value: unknown): value is SavedResponseFormat {
  if (!object(value) || !keys(value, ['type','json_schema']) || value.type !== 'json_schema') return false;
  const spec: unknown = value.json_schema;
  if (!object(spec) || !keys(spec, ['name','schema','strict']) || typeof spec.name !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(spec.name) ||
      spec.strict !== true || !object(spec.schema)) return false;
  try { return new TextEncoder().encode(JSON.stringify(spec.schema)).length <= MAX_SCHEMA_BYTES; } catch { return false; }
}
/** Safe, display-only spending figures from the last estimate and settlement. No prompts, keys or ids. */
export interface SpendingSnapshot {
  availableMilli2z?: bigint; capRemainingMilli2z?: bigint | null;
  /** Hold of the last activity-batch estimate (an upper bound) and charge of the last settled batch. */
  batchEstimate2z?: bigint; batchCharge2z?: bigint;
}
export type ResumeContext =
  | {kind: 'activity'; profileId: string; candidateSkillIds: string[]}
  /** A batch of AI-authored Activity Specs; the reply is validated against the standards window it was shown. */
  | {kind: 'activities'; profileId: string; allowedSkillIds: string[]}
  | {kind: 'curiosity'; profileId: string; activityId: string; question: string};
/**
 * Output-token budgets a journaled request may carry. 1800 is the original single-activity and
 * curiosity budget (journal v1 pinned it). 2600 is the Activity Spec batch prompt's budget (v2).
 * v4 adds a reasoning model's per-model batch budget (`validOutputBudget`), and the 10-activity batch's 5600 (#929)
 * is one of those whole budgets.
 */
export const OUTPUT_BUDGETS = ['1800', '2600'] as const;
/**
 * The smallest whole batch budget journal v4 accepts. A literal, never the current `BATCH_OUTPUT_TOKENS`: raising the
 * batch budget must never make an existing journal (a reasoning budget capped by a model's ceiling, say 4096) unreadable.
 */
const MIN_V4_BATCH_BUDGET = 2600n;
/** The largest whole batch budget journal v4 accepts: a full 35-activity batch is 15,000 (models.ts, #929). */
const MAX_V4_BATCH_BUDGET = 16_384n;
/** A canonical decimal: one of `OUTPUT_BUDGETS`, or (journal v4) a batch budget from 2600 to 16384. */
export type OutputBudget = string;
/**
 * v1: only 1800. v2/v3: `OUTPUT_BUDGETS`. v4: also any canonical whole number from 2600 to 12000, the reasoning-model
 * batch budget (12k capped by the model's own `max_output_tokens`, models.ts). Anything else fails closed.
 */
export function validOutputBudget(value: unknown, version: number = JOURNAL_VERSION): value is OutputBudget {
  if (version === 1) return value === '1800';
  if ((OUTPUT_BUDGETS as readonly unknown[]).includes(value)) return true;
  return version >= 4 && typeof value === 'string' && /^[1-9]\d{3,4}$/.test(value) &&
    BigInt(value) >= MIN_V4_BATCH_BUDGET && BigInt(value) <= MAX_V4_BATCH_BUDGET;
}
/** Finish reasons that mean the output budget ran out (the gateway normalises to `length`; providers' own names too). */
const LENGTH_REASONS = ['length', 'max_tokens', 'max_output_tokens'];
export interface TutorReply {
  text: string; operationId: string; context?: ResumeContext;
  /** The model the journaled request was sent to (fresh or same-key recovery): attribution for what it wrote. */
  model: string;
  /** The request carried `response_format` (strict JSON Schema). Absent: the prompt-only request. */
  structured?: true;
  /**
   * The batch ran out of room: cut off by its output budget (`finish_reason: length`), or empty after hidden reasoning.
   * Still charged. For the per-model stats ("ran out of room").
   */
  outOfRoom?: true;
}
interface SavedRequest { model: string; messages: ChatRequest['messages']; maxOutputTokens: string; responseFormat?: SavedResponseFormat; reasoningEffort?: ReasoningEffort }
interface Operation {
  id: string; key: string; subject: string; generation: string; createdAt: string;
  request: SavedRequest; state: 'opening' | 'streaming' | 'interrupted' | 'settling' | 'finalized';
  context?: ResumeContext; answerComplete?: true; consumed?: true;
  /** v4: a completed activity batch that ran out of room (see `TutorReply.outOfRoom`). */
  outOfRoom?: true;
  callId?: string; text: string; charge?: { state: 'pending' | 'released' | 'charged'; charged2z?: string; receiptId?: string };
}
/**
 * v1 (original): every request pins maxOutputTokens '1800'; contexts are activity/curiosity only.
 * v2: maxOutputTokens is one of OUTPUT_BUDGETS and the 'activities' batch context is allowed.
 * v3: a request may carry the exact `responseFormat` it was sent with; absent means prompt-only.
 * v4: a batch may carry a reasoning model's per-model budget (`validOutputBudget`), and a completed batch may be
 * marked `outOfRoom`, and a request may carry `reasoningEffort` (sent as `reasoning_effort`). Same-key recovery replays the
 * journaled model, budget and effort exactly.
 * v1–v3 journals stay readable and recoverable; the first write stores them as v4. Unknown versions fail closed.
 */
interface Ledger { version: 1 | 2 | 3 | 4; operations: Operation[] }
export const JOURNAL_VERSION = 4;
const SLOT = 'aha-billing-v1';
/**
 * Reply characters per operation. A full 15,000-token batch (#929) is ~54k characters at the measured 3.6 characters per
 * token; the bound leaves room for denser text, so a long batch is never cut off by the app after being charged.
 */
const MAX_TEXT = 64_000;
/**
 * The reply's size inside the journal (its JSON-encoded UTF-8 bytes), bounded while it streams. The journal keeps this
 * much room free before a paid send, so a completed reply always fits the 480 kB journal record.
 */
const MAX_TEXT_BYTES = 96_000;
const encoder = new TextEncoder();
/** Bytes a string adds inside the journal's JSON (escapes and UTF-8 included). */
const journalBytes = (text: string) => encoder.encode(JSON.stringify(text)).length - 2;
const MAX_JOURNAL_BYTES = 480_000;
/** System + user prompt characters per request (the prompt-only batch prompt is ~18k with the #929 digest and mix). */
const MAX_CONTEXT_CHARS = 24_000;
/**
 * Sees the journaled reply text after each streamed delta (one paid call either way): lets the caller bank complete
 * activities early. It cannot change what is journaled, billed or settled; its errors are logged and ignored.
 */
export type StreamObserver = (progress: {operationId: string; model: string; text: string}) => void;
export class TutorServiceError extends Error {
  /** `required2z`: whole 2Z the refused request needed, when Free2Z (or the estimate's hold) reported it. Display only. */
  constructor(public readonly code: string, message: string, public readonly retryAfterSeconds?: number, public readonly required2z?: bigint) { super(message); this.name = 'TutorServiceError'; }
}
export function format2z(milli: bigint): string {
  const negative = milli < 0n; const n = negative ? -milli : milli;
  const fraction = (n % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${n / 1000n}${fraction ? '.' + fraction : ''} 2Z`;
}
function savedCharge(charge: Charge): Operation['charge'] {
  if (charge.state === 'pending') return { state: 'pending' };
  if (charge.state === 'released') return { state: 'released', charged2z: '0' };
  return { state: 'charged', charged2z: charge.charged2z.toString(), receiptId: charge.receiptId };
}
const opaque = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(value);
const natural = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9]\d{0,38})$/.test(value);
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, any>, allowed: string[]) => Object.keys(value).every(k => allowed.includes(k));
function validResumeContext(value: unknown, version: Ledger['version'] = 2): value is ResumeContext {
  if (!object(value) || !opaque(value.profileId) || value.profileId.length > 100) return false;
  if (value.kind === 'activities') return version >= 2 && keys(value, ['kind','profileId','allowedSkillIds']) &&
    Array.isArray(value.allowedSkillIds) && value.allowedSkillIds.length > 0 && value.allowedSkillIds.length <= 80 &&
    value.allowedSkillIds.every((id: unknown) => opaque(id) && id.length <= 40) &&
    new Set(value.allowedSkillIds).size === value.allowedSkillIds.length;
  if (value.kind === 'activity') return keys(value, ['kind','profileId','candidateSkillIds']) &&
    Array.isArray(value.candidateSkillIds) && value.candidateSkillIds.length > 0 && value.candidateSkillIds.length <= 12 &&
    value.candidateSkillIds.every((id: unknown) => opaque(id) && id.length <= 100) &&
    new Set(value.candidateSkillIds).size === value.candidateSkillIds.length;
  return value.kind === 'curiosity' && keys(value, ['kind','profileId','activityId','question']) &&
    opaque(value.activityId) && value.activityId.length <= 100 && typeof value.question === 'string' &&
    value.question.trim().length > 0 && value.question.length <= 600 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.question);
}
function invalidJournal(): never {
  throw new TutorServiceError('journal_invalid', 'The usage journal is incomplete; paid requests are paused for recovery.');
}
function readLedger(input: unknown): Ledger {
  if (input == null) return { version: JOURNAL_VERSION, operations: [] };
  if (!object(input) || ![1, 2, 3, 4].includes(input.version) || !Array.isArray(input.operations) || !keys(input, ['version', 'operations'])) invalidJournal();
  const version: Ledger['version'] = input.version;
  try { if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_JOURNAL_BYTES) invalidJournal(); }
  catch { invalidJournal(); }
  const ids = new Set<string>(), operationKeys = new Set<string>();
  for (const op of input.operations) {
    if (!object(op) || !keys(op, ['id','key','subject','generation','createdAt','request','state','callId','text','charge','context','answerComplete','consumed','outOfRoom']) ||
      !opaque(op.id) || !opaque(op.key) || !opaque(op.subject) || !opaque(op.generation) ||
      ids.has(op.id) || operationKeys.has(op.key) ||
      typeof op.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(op.createdAt) ||
      !Number.isFinite(Date.parse(op.createdAt)) || new Date(op.createdAt).toISOString() !== op.createdAt ||
      Date.parse(op.createdAt) > Date.now() ||
      !['opening','streaming','interrupted','settling','finalized'].includes(op.state) ||
      (op.callId !== undefined && !opaque(op.callId)) || typeof op.text !== 'string' || op.text.length > MAX_TEXT) invalidJournal();
    if (op.context !== undefined && !validResumeContext(op.context, version)) invalidJournal();
    if (op.answerComplete !== undefined && (op.answerComplete !== true || !['settling','finalized'].includes(op.state))) invalidJournal();
    if (op.consumed !== undefined && (op.consumed !== true || op.answerComplete !== true || !op.context)) invalidJournal();
    if (op.outOfRoom !== undefined && (version < 4 || op.outOfRoom !== true || op.answerComplete !== true || op.context?.kind !== 'activities')) invalidJournal();
    ids.add(op.id); operationKeys.add(op.key);
    const request = op.request;
    if (!object(request) || !keys(request, version >= 4 ? ['model','messages','maxOutputTokens','responseFormat','reasoningEffort'] : version >= 3 ? ['model','messages','maxOutputTokens','responseFormat'] : ['model','messages','maxOutputTokens']) || !opaque(request.model) ||
      (request.reasoningEffort !== undefined && request.reasoningEffort !== 'low') ||
      (request.responseFormat !== undefined && !validResponseFormat(request.responseFormat)) ||
      !validOutputBudget(request.maxOutputTokens, version) ||
      !Array.isArray(request.messages)) invalidJournal();
    const archived = op.state === 'finalized' && request.messages.length === 0 && op.text === '';
    if (archived && op.answerComplete && op.context && !op.consumed) invalidJournal();
    if (!archived) {
      if (request.messages.length !== 2) invalidJournal();
      let length = 0;
      for (const [index, message] of request.messages.entries()) {
        if (!object(message) || !keys(message, ['role','content']) || message.role !== (index === 0 ? 'system' : 'user') ||
          !Array.isArray(message.content) || message.content.length !== 1) invalidJournal();
        const part = message.content[0];
        if (!object(part) || !keys(part, ['type','text']) || part.type !== 'text' || typeof part.text !== 'string') invalidJournal();
        length += part.text.length;
      }
      if (length > MAX_CONTEXT_CHARS) invalidJournal();
    }
    const charge = op.charge;
    if (charge !== undefined) {
      if (!object(charge) || !keys(charge, ['state','charged2z','receiptId'])) invalidJournal();
      if (charge.state === 'charged') {
        if (!natural(charge.charged2z) || !opaque(charge.receiptId)) invalidJournal();
      } else if (charge.state === 'released') {
        if (charge.charged2z !== '0' || charge.receiptId !== undefined) invalidJournal();
      } else if (charge.state !== 'pending' || charge.charged2z !== undefined || charge.receiptId !== undefined) invalidJournal();
    }
    if (op.state === 'finalized' ? !charge || !['charged','released'].includes(charge.state)
      : op.state === 'settling' ? charge?.state !== 'pending' : charge !== undefined && charge.state !== 'pending') invalidJournal();
  }
  return structuredClone(input) as Ledger;
}
/** Safe UI metadata only: never expose saved prompts, idempotency keys, or account identifiers. */
export interface PendingOperation {
  profileId?: string; activityId?: string;
  operationId: string; createdAt: string; state: Exclude<Operation['state'], 'finalized'>;
  canReconcile: boolean; canRecover: boolean;
}
/** One instance per authenticated account. All paid operations serialize through this object. */
export class Free2zTutor {
  private busy = false;
  private cancelled = false;
  private active?: ChatStream;
  private snapshot: SpendingSnapshot = {};
  /** Models whose gateway refused `response_format` despite advertising it; later batches skip straight to prompt-only. */
  private readonly formatRefused = new Set<string>();
  constructor(readonly client: SdkClient, private readonly journal: Journal, private readonly subject: string,
    private readonly notice: (message: string) => void = message => diagnostics.add('warn', 'ai-structured', message),
    /** The per-batch `structured=yes|no` line. A prompt-only batch is a warning: on a capable model it means lost validity. */
    private readonly trace: (message: string, structured: boolean) => void = (message, structured) => {
      diagnostics.add(structured ? 'info' : 'warn', 'ai-structured', message);
      if (structured) console.info(`[aha:ai-structured] ${message}`);
    },
    /** "Ran out of room" (truncated, or empty after reasoning): always a warning, so model testing sees it. */
    private readonly budgetLog: (message: string) => void = message => diagnostics.add('warn', 'ai-budget', message)) {}
  private async ledger(): Promise<Ledger> { return readLedger(await this.journal.getJournal(SLOT)); }
  private async persist(ledger: Ledger): Promise<void> {
    ledger.version = JOURNAL_VERSION;
    if (new TextEncoder().encode(JSON.stringify(ledger)).length > MAX_JOURNAL_BYTES)
      throw new TutorServiceError('journal_capacity', 'The usage journal needs archival before more AI requests.');
    readLedger(ledger);
    await this.journal.putJournal(SLOT, ledger);
  }
  private async archiveFinalized(ledger: Ledger): Promise<void> {
    for (const op of ledger.operations) {
      if (op.state !== 'finalized' || this.deliverable(op) || (!op.text && !op.request.messages.length)) continue;
      // The schema is the app's own constant (about 28 KB); the archive keeps the prompt, reply and receipt.
      await this.journal.putJournal(`aha-call-${op.id}`, {...op, request: {model: op.request.model, messages: op.request.messages, maxOutputTokens: op.request.maxOutputTokens}});
      op.text = ''; op.request = {model: op.request.model, messages: [], maxOutputTokens: op.request.maxOutputTokens};
    }
    await this.persist(ledger);
  }
  private async current(): Promise<Session> {
    const session = await this.client.session();
    if (!session.signedIn || session.subject !== this.subject) throw new TutorServiceError('account_changed', 'Sign in to the account that started this session.');
    if (!session.grantedScopes.includes('ai:invoke')) throw new TutorServiceError('scope_denied', 'Free2Z has not granted AI access to this app.');
    return session;
  }
  private verifyAuthorization(session: Session, authorization: PaidAuthorization): void {
      if (!authorization || authorization.subject !== session.subject || !opaque(authorization.clientId))
        throw new TutorServiceError('authorization_required', 'Identify the signed-in account and registered app before using paid AI.');
      const grant = authorization.verifiedGrant, budget = grant?.budget;
      if (!grant || grant.subject !== session.subject || grant.clientId !== authorization.clientId || grant.sessionGeneration !== session.generation || !Number.isFinite(grant.checkedAt) || !Number.isFinite(Date.parse(grant.asOf)) || Date.now() - Date.parse(grant.asOf) > GRANT_MAX_AGE_MS || Date.parse(grant.asOf) - Date.now() > 5_000 || Date.now() - grant.checkedAt > GRANT_MAX_AGE_MS || grant.checkedAt > Date.now() ||
          (budget !== null && (!budget || typeof budget !== 'object' || !CAP_PERIODS.includes(budget.period) || typeof budget.limit2z !== 'bigint' || budget.limit2z < 0n)))
        throw new TutorServiceError('grant_verification_required', 'Free2Z must freshly confirm AI access for this account and app. An estimate alone does not.');
  }
  /** Preflight (a strict estimate), then admit it against the balance and the budget remainder. Records display-only figures. */
  private async admit(request: ChatRequest, budget: AppBudget, op?: Pick<Operation, 'context'>): Promise<AdmittedEstimate> {
    let checked: Preflight;
    try { checked = await this.client.preflight(request); }
    catch (error) { throw strictRefusal(error) ?? error; }
    const estimate = preflightEstimate(checked);
    // Strict means the full budget or a refusal. A smaller returned budget would be a truncated, charged batch.
    if (typeof estimate.max_output_tokens !== 'bigint' || (request.max_output_tokens !== undefined && estimate.max_output_tokens < request.max_output_tokens))
      throw new TutorServiceError('not_enough_2z', NOT_ENOUGH_2Z);
    // An estimate may omit the balance figure; then the authoritative balance read decides.
    const fallback = estimate.available_milli_2z === undefined ? (await this.client.balance()).available_milli_2z : undefined;
    const admitted = admitEstimate(estimate, budget, fallback);
    this.snapshot = {...this.snapshot, availableMilli2z: admitted.availableMilli2z, capRemainingMilli2z: admitted.capRemainingMilli2z,
      ...(op?.context?.kind === 'activities' ? {batchEstimate2z: admitted.hold2z} : {})};
    return admitted;
  }
  /** Last known balance, budget remainder and activity-batch cost, for Settings. No service call. */
  spending(): SpendingSnapshot { return {...this.snapshot}; }
  /** Display-only: the settled remainder and, for activity batches, the settled charge. */
  private noteSettlement(op: Operation, done: ObjectData & {charge: Charge}): void {
    const cap = done.cap_remaining_milli_2z;
    if (typeof cap === 'bigint' || cap === null) this.snapshot = {...this.snapshot, capRemainingMilli2z: cap};
    if (op.context?.kind === 'activities' && done.charge.state === 'charged') this.snapshot = {...this.snapshot, batchCharge2z: done.charge.charged2z};
  }
  private deliverable(op: Operation): boolean { return op.answerComplete === true && !!op.context && !op.consumed; }
  private replyValue(op: Operation): TutorReply {
    return {text:op.text,operationId:op.id,model:op.request.model,...(op.context ? {context:structuredClone(op.context)} : {}),...(op.request.responseFormat ? {structured:true as const} : {}),
      ...(op.outOfRoom ? {outOfRoom:true as const} : {})};
  }
  /** Completed content is retained until its lesson/session has durably accepted it. No service call. */
  async pendingReplies(): Promise<TutorReply[]> {
    const before = await this.current(); const ledger = await this.ledger(); const after = await this.current();
    if (before.generation !== after.generation) throw new TutorServiceError('account_changed', 'Account session changed during reply recovery.');
    if (ledger.operations.some(op => op.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
    return ledger.operations.filter(op => this.deliverable(op)).map(op => this.replyValue(op));
  }
  /** Call only after durable presentation storage (or durable evidence that the item was already handled). */
  async acknowledgeReply(operationId: string): Promise<void> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    this.busy = true;
    try {
      const before = await this.current(); const ledger = await this.ledger();
      if (ledger.operations.some(op => op.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
      const op = ledger.operations.find(op => op.id === operationId);
      if (!op || !op.answerComplete || !op.context) throw new TutorServiceError('reply_missing', 'No completed learning reply is stored for this request.');
      const after = await this.current();
      if (before.generation !== after.generation) throw new TutorServiceError('account_changed', 'Account session changed during reply acknowledgement.');
      if (op.consumed) return;
      op.consumed = true; await this.persist(ledger);
    } finally { this.busy = false; }
  }
  async cancel(): Promise<void> { this.cancelled = true; await this.active?.cancel(); }
  /**
   * Activity-batch operations with the model each was sent to and its settled charge (absent until settled), for the
   * local per-model stats. No service call; no prompts, keys or account ids.
   */
  async batchUsage(): Promise<{operationId: string; model: string; charged2z?: bigint}[]> {
    const ledger = await this.ledger();
    return ledger.operations.filter(op => op.subject === this.subject && op.context?.kind === 'activities').map(op => ({
      operationId: op.id, model: op.request.model,
      ...(op.state === 'finalized' && op.charge?.state === 'charged' && op.charge.charged2z !== undefined ? {charged2z: BigInt(op.charge.charged2z)} : {}),
    }));
  }
  async inspectPending(): Promise<PendingOperation[]> {
    const before = await this.current();
    const ledger = await this.ledger();
    const after = await this.current();
    if (before.generation !== after.generation) throw new TutorServiceError('account_changed', 'Account session changed during recovery.');
    if (ledger.operations.some(op => op.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
    return ledger.operations.filter(op => op.state !== 'finalized').map(op => ({
      operationId: op.id, createdAt: op.createdAt, state: op.state as PendingOperation['state'],
      ...(op.context ? {profileId:op.context.profileId,...(op.context.kind === 'curiosity' ? {activityId:op.context.activityId} : {})} : {}),
      canReconcile: !!op.callId, canRecover: Date.now() - Date.parse(op.createdAt) < 24 * 60 * 60 * 1000,
    }));
  }

  async reconcile(): Promise<{ pending: number; spent2z: bigint }> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    this.busy = true;
    try {
      const session = await this.current(); const ledger = await this.ledger();
      for (const op of ledger.operations) {
        if (op.subject !== this.subject) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
        if (op.state === 'finalized' || !op.callId) continue;
        const record = await this.client.call(op.callId);
        const after = await this.current();
        if (after.generation !== session.generation) throw new TutorServiceError('account_changed', 'Account session changed during recovery.');
        op.charge = savedCharge(record.charge); op.state = record.charge.state === 'pending' ? 'settling' : 'finalized';
        await this.persist(ledger);
      }
      return { pending: ledger.operations.filter(o => o.state !== 'finalized').length, spent2z: ledger.operations.reduce((n, o) => n + BigInt(o.charge?.charged2z ?? '0'), 0n) };
    } finally { this.busy = false; }
  }
  /**
   * With `structured`, and a model whose catalogue entry advertises `capabilities.structured_output`, the request
   * carries `response_format` and `structured.system`; otherwise, or after Free2Z refuses the format at no cost, it is
   * the prompt-only request with `system`. The reply text is untrusted either way: callers still validate it.
   */
  async reply(model: string, system: string, context: string, authorization: PaidAuthorization, resumeContext?: ResumeContext, maxOutputTokens: OutputBudget = '1800', structured?: StructuredOutput, onText?: StreamObserver): Promise<TutorReply> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    if (!validOutputBudget(maxOutputTokens)) throw new TutorServiceError('output_budget_invalid', 'Unsupported output budget. No paid request was sent.');
    if (resumeContext !== undefined && !validResumeContext(resumeContext))
      throw new TutorServiceError('resume_context_invalid', 'The learning context cannot be safely restored. No paid request was sent.');
    const savedContext = resumeContext === undefined ? undefined : structuredClone(resumeContext);
    this.busy = true; this.cancelled = false;
    try {
      const session = await this.current();
      this.verifyAuthorization(session, authorization);
      if (system.length + context.length > MAX_CONTEXT_CHARS) throw new TutorServiceError('context_limit', 'The learning context is too large.');
      const ledger = await this.ledger();
      if (ledger.operations.some(o => o.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
      if (ledger.operations.some(op => this.deliverable(op))) throw new TutorServiceError('answer_pending', 'A completed AI reply is waiting to be restored. No new paid request was sent.');
      if (ledger.operations.some(o => o.state !== 'finalized')) throw new TutorServiceError('settlement_pending', 'An earlier AI request still needs receipt recovery. No new paid request was sent.');
      await this.archiveFinalized(ledger);
      const catalog = await this.client.models();
      if (!catalog.models.some(m => m.id === model)) throw new TutorServiceError('model_unavailable', 'Choose a currently available Free2Z model.');
      const {format, why} = this.structuredFormat(catalog, model, context, structured);
      // Only activity batches, and only where the catalogue says the gateway takes it (zuu#1151); otherwise omitted.
      const effort: ReasoningEffort | undefined = savedContext?.kind === 'activities' && supportsReasoningEffort(catalog, model) ? 'low' : undefined;
      if (format && structured) {
        try { return await this.send(ledger, session, model, structured.system, context, format, authorization, savedContext, maxOutputTokens, why, effort, onText); }
        catch (error) {
          // Fall back only after a refusal of the format itself, which cost nothing, and only with nothing left unsettled.
          if (!isFormatRefusal(error) || ledger.operations.some(op => op.state !== 'finalized')) throw error;
          this.formatRefused.add(model);
          this.notice(`Free2Z refused response_format for ${model}; sent the prompt-only JSON request instead. The refusal cost nothing.`);
          return await this.send(ledger, session, model, system, context, undefined, authorization, savedContext, maxOutputTokens, 'format_refused', effort, onText);
        }
      }
      return await this.send(ledger, session, model, system, context, undefined, authorization, savedContext, maxOutputTokens, why, effort, onText);
    } finally { this.active = undefined; this.busy = false; }
  }
  /** The `response_format` to try first, or `undefined` for the prompt-only request, with the reason for the log. Never throws. */
  private structuredFormat(catalog: Models, model: string, context: string, structured?: StructuredOutput): {format?: SavedResponseFormat; why: string} {
    if (!structured) return {why: 'not_requested'};
    const capability = structuredCapability(catalog, model);
    if (capability !== 'advertised') return {why: capability};
    if (this.formatRefused.has(model)) return {why: 'refused_earlier_this_session'};
    const format = {type: 'json_schema' as const, json_schema: {name: structured.name, schema: structured.schema, strict: true as const}};
    if (typeof structured.system !== 'string' || structured.system.length + context.length > MAX_CONTEXT_CHARS || !validResponseFormat(format)) {
      this.notice('The structured-output request is outside Free2Z limits; sent the prompt-only JSON request instead.');
      return {why: 'outside_limits'};
    }
    return {format: structuredClone(format), why: 'advertised'};
  }
  /** One fresh operation: estimate and admit, journal (with the exact format, if any), then send. */
  private async send(ledger: Ledger, session: Session, model: string, system: string, context: string, format: SavedResponseFormat | undefined,
    authorization: PaidAuthorization, savedContext: ResumeContext | undefined, maxOutputTokens: OutputBudget, why: string, effort?: ReasoningEffort, onText?: StreamObserver): Promise<TutorReply> {
    const messages: ChatRequest['messages'] = [{role:'system',content:[{type:'text',text:system}]},{role:'user',content:[{type:'text',text:context}]}];
    const request = chatRequest({model, messages, maxOutputTokens, ...(format ? {responseFormat: format} : {}), ...(effort ? {reasoningEffort: effort} : {})});
    if (savedContext?.kind === 'activities') this.trace(describeBatchRequest(request, why, 'send'), !!request.response_format);
    // No app-side ceiling: the user's own budget (if any) and balance bound the call, as Free2Z reports them.
    try { await this.admit(request, authorization.verifiedGrant.budget, {context: savedContext}); }
    catch (error) { throw format && formatRefusal(error) ? formatUnsupported() : error; }
    const after = await this.current();
    if (after.generation !== session.generation || this.cancelled) throw new TutorServiceError('cancelled', 'The request was cancelled before starting.');
    const op: Operation = { id:crypto.randomUUID(),key:crypto.randomUUID(),subject:this.subject,generation:session.generation,createdAt:new Date().toISOString(),request:{model,messages,maxOutputTokens,...(format ? {responseFormat:structuredClone(format)} : {}),...(effort ? {reasoningEffort:effort} : {})},state:'opening',text:'',...(savedContext ? {context:structuredClone(savedContext)} : {}) };
    ledger.operations.push(op);
    if (new TextEncoder().encode(JSON.stringify(ledger)).length + MAX_TEXT_BYTES > MAX_JOURNAL_BYTES)
      throw new TutorServiceError('journal_capacity', 'Archive usage history before another paid request.');
    await this.persist(ledger);
    return await this.run(ledger, op, request, authorization, true, onText);
  }
  /** Explicit same-key recovery only; the gateway may replay just a receipt, not content. */
  async recover(operationId: string, authorization: PaidAuthorization): Promise<TutorReply> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    this.busy = true; this.cancelled = false;
    try {
      await this.current(); const ledger = await this.ledger(); const op = ledger.operations.find(o => o.id === operationId);
      if (ledger.operations.some(item => item.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
      if (!op || op.subject !== this.subject) throw new TutorServiceError('operation_missing', 'That request does not belong to this account.');
      if (op.answerComplete && !op.consumed) return this.replyValue(op);
      if (op.consumed) throw new TutorServiceError('already_consumed', 'This learning reply was already saved. Use receipt reconciliation for its remaining charge.');
      if (op.state === 'finalized') throw new TutorServiceError('already_finalized', 'This request is already settled; use its saved content.');
      const age = Date.now() - Date.parse(op.createdAt);
      if (!Number.isFinite(age) || age < 0 || age >= 24 * 60 * 60 * 1000) throw new TutorServiceError('recovery_expired', 'The same-key recovery window has expired. No replacement paid request was sent.');
      const session = await this.current();
      this.verifyAuthorization(session, authorization);
      // The identical body, response_format included when the first send carried one: the key may be bound to it.
      const request = chatRequest(op.request);
      if (op.context?.kind === 'activities') this.trace(describeBatchRequest(request, 'journaled_prompt_only', 'recovery'), !!request.response_format);
      // An opening journal entry may never have reached the gateway. A same-key call is potentially
      // billable, so re-prove affordability under today's grant, balance and budget remainder.
      await this.admit(request, authorization.verifiedGrant.budget, op);
      const after = await this.current();
      if (after.generation !== session.generation || this.cancelled) throw new TutorServiceError('cancelled', 'Recovery was cancelled before sending.');
      op.generation = session.generation;
      await this.persist(ledger);
      return await this.run(ledger,op,request,authorization,false);
    } finally { this.active = undefined; this.busy = false; }
  }
  /** `fresh`: this is the operation's first send; nothing about it can have reached the gateway before. */
  private async run(ledger: Ledger, op: Operation, request: ChatRequest, authorization: PaidAuthorization, fresh: boolean, onText?: StreamObserver): Promise<TutorReply> {
    let completed = false;
    // A refusal that provably cost nothing; settles the entry as released/0 so it cannot block later calls.
    let zeroCharge = false;
    // Reported by the stream's `usage` event; hidden reasoning bills as output and counts against the budget.
    let reasoningTokens: bigint | undefined, outputTokens: bigint | undefined;
    // The reply's journal bytes so far (a recovery may resume over saved text).
    let textBytes = journalBytes(op.text);
    /** Only on a delivered activity batch (`answerComplete`), so the journal stays valid. */
    const markOutOfRoom = (finishReason: string) => {
      op.outOfRoom = true;
      const finish = /^[a-z_]{1,32}$/.test(finishReason) ? finishReason : 'other';
      this.budgetLog(`batch ran out of room: model=${op.request.model} finish_reason=${finish} max_output_tokens=${op.request.maxOutputTokens} ` +
        `reasoning_tokens=${reasoningTokens ?? 'unreported'} output_tokens=${outputTokens ?? 'unreported'} text_chars=${op.text.length}`);
    };
    try {
      // Durable writes and recovery can yield: refresh real consent, balance and remainder at the send boundary.
      const verifiedGrant = await verifyPaidGrant(this.client, authorization);
      try { await this.admit(request, verifiedGrant.budget, op); }
      catch (error) {
        if (request.response_format && formatRefusal(error)) { zeroCharge = fresh; throw formatUnsupported(); }
        if (fresh && error instanceof TutorServiceError && ZERO_CHARGE_CODES.includes(error.code)) zeroCharge = true;
        throw error;
      }
      // The contract supplies a fresh snapshot, not an immutable per-operation spending guarantee.
      // The service independently enforces current consent; never infer policy identity from generation.
      // Persistence may have yielded for a long time. Fence again at the send boundary.
      const beforeSend = await this.current();
      this.verifyAuthorization(beforeSend, {...authorization, verifiedGrant});
      if (beforeSend.generation !== op.generation || this.cancelled)
        throw new TutorServiceError('cancelled', 'Account changed or request cancelled before sending.');
      let stream: ChatStream;
      try { stream = await this.client.chat(request,{operationId:op.id,idempotencyKey:op.key}); }
      catch (error) {
        // Refused before any hold. On a fresh send it cost nothing; during recovery the first send may have been charged.
        if (request.response_format && formatRefusal(error)) { zeroCharge = fresh; throw formatUnsupported(); }
        const refused = strictRefusal(error);
        if (!refused) throw error;
        zeroCharge = fresh; throw refused;
      }
      this.active = stream;
      if (this.cancelled) { await stream.cancel(); throw new TutorServiceError('cancelled', 'Delivery stopped; billing may still settle.'); }
      const session = await this.current();
      if (session.generation !== op.generation) { await stream.cancel(); throw new TutorServiceError('account_changed','Account changed while opening the request.'); }
      op.state = 'streaming'; await this.persist(ledger);
      for await (const event of stream) {
        if (this.cancelled) throw new TutorServiceError('cancelled', 'Delivery stopped; billing may still settle.');
        const current = await this.current();
        if (current.generation !== op.generation) throw new TutorServiceError('account_changed','Account changed during the request.');
        if (event.type === 'meta') op.callId = event.call_id;
        if (event.type === 'usage') {
          reasoningTokens = event.usage.reasoning_tokens ?? reasoningTokens; outputTokens = event.usage.output_tokens ?? outputTokens;
          // A gateway may report usage after `done`: an empty delivered batch is then marked once the reasoning count is known.
          if (op.answerComplete && !op.outOfRoom && op.context?.kind === 'activities' && !op.text.trim() && (reasoningTokens ?? 0n) > 0n) markOutOfRoom('stop');
        }
        if (event.type === 'delta') {
          textBytes += journalBytes(event.text);
          if (op.text.length + event.text.length > MAX_TEXT || textBytes > MAX_TEXT_BYTES) throw new TutorServiceError('output_limit','The lesson exceeded the supported size.');
          op.text += event.text;
        }
        if (event.type === 'tool_call') throw new TutorServiceError('unexpected_tool','This request did not authorize tools.');
        if (event.type === 'done' || event.type === 'error' || event.type === 'replay') {
          const charge = event.type === 'replay' ? event.record.charge : event.charge;
          op.charge = savedCharge(charge); op.state = charge.state === 'pending' ? 'settling' : 'finalized';
          if (event.type === 'replay') op.callId = event.record.call_id;
          if (event.type === 'done') this.noteSettlement(op, event);
          // A batch cut off by its output budget still carries whole activities; the batch parser keeps them.
          const deliverable = event.type === 'done' && (['stop','end_turn'].includes(event.finish_reason) ||
            (op.context?.kind === 'activities' && LENGTH_REASONS.includes(event.finish_reason)));
          if (deliverable) op.answerComplete = true;
          // A batch that ran out of room: cut off by the budget, or nothing visible after hidden reasoning.
          if (deliverable && op.context?.kind === 'activities' &&
              (LENGTH_REASONS.includes(event.finish_reason) || (!op.text.trim() && (reasoningTokens ?? 0n) > 0n))) markOutOfRoom(event.finish_reason);
          await this.persist(ledger);
          if (event.type === 'error') throw new TutorServiceError(event.code,'The AI request ended with an error. Its charge remains recorded.');
          if (event.type === 'replay') throw new TutorServiceError('receipt_only','The receipt was recovered. The service does not replay the original answer; no new paid request was sent.');
          if (!deliverable) throw new TutorServiceError('incomplete_output','The generated activity did not finish normally.');
          completed = true;
        }
        // Persist output incrementally; force-kill never turns an uncertain charge into zero.
        await this.persist(ledger);
        // Observers see only journaled text. They never affect the stream, its billing or its settlement.
        if (event.type === 'delta' && onText) {
          try { onText({operationId: op.id, model: op.request.model, text: op.text}); }
          catch (error) { console.error('[aha] stream observer failed', error); }
        }
      }
      if (!completed) throw new TutorServiceError('interrupted','The stream ended without a completed lesson.');
      return this.replyValue(op);
    } catch (error) {
      op.callId ??= this.active?.callId;
      if (zeroCharge && op.state === 'opening' && !op.callId) { op.charge = {state: 'released', charged2z: '0'}; op.state = 'finalized'; }
      if (op.state !== 'finalized' && op.state !== 'settling') op.state = 'interrupted';
      // Cancellation must happen even when disk-full prevents a journal update.
      try { await this.active?.cancel(); } catch { /* original opening record remains uncertain */ }
      try { await this.persist(ledger); } catch {
        throw new TutorServiceError('journal_write_failed', 'Local storage failed. Delivery was stopped; the saved opening request still requires receipt recovery.');
      }
      if (error instanceof TutorServiceError) throw error;
      if (error instanceof SdkError) {
        const delay = error.retryAfterSeconds;
        const retryAfter = typeof delay === 'number' && Number.isSafeInteger(delay) && delay >= 0 ? delay : undefined;
        throw new TutorServiceError(error.code, 'Free2Z could not finish this request. Its identity is saved for recovery.', retryAfter);
      }
      throw new TutorServiceError('service_unavailable', 'Free2Z could not finish this request. Its identity is saved for recovery.');
    }
  }
}
/** The wire request for a journaled body: strict output always, `response_format` and `reasoning_effort` exactly when saved. */
function chatRequest(saved: SavedRequest): ChatRequest {
  const request: EffortRequest = {model: saved.model, messages: saved.messages, max_output_tokens: BigInt(saved.maxOutputTokens), max_output_tokens_strict: true,
    ...(saved.responseFormat ? {response_format: structuredClone(saved.responseFormat) as ChatRequest['response_format']} : {}),
    ...(saved.reasoningEffort ? {reasoning_effort: saved.reasoningEffort} : {})};
  return request;
}
let nativeClient: Client | undefined;
export function getNativeClient(): Client { return nativeClient ??= new Client(new NativeTransport(nativeBridge)); }
