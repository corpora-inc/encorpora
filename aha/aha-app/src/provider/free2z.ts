import { Client, NativeTransport, SdkError, type ChatRequest, type ChatStream, type Charge, type Session, type SignInOptions } from '@free2z/sdk';
import { nativeBridge } from '@free2z/tauri-plugin-f2z-api';

export interface Journal { getJournal(key: string): Promise<unknown>; putJournal(key: string, value: any): Promise<void> }
export type SdkClient = Pick<Client, 'session' | 'signIn' | 'signOut' | 'balance' | 'grant' | 'models' | 'estimate' | 'chat' | 'call'>;
export interface GrantPolicy { subject: string; clientId: string; maximum2z: bigint }
export interface VerifiedGrant {
  subject: string; clientId: string; period: 'total'; limit2z: bigint;
  sessionGeneration: string; asOf: string; checkedAt: number;
}
export interface TestAuthorization extends GrantPolicy { verifiedGrant: VerifiedGrant }
const GRANT_MAX_AGE_MS = 60_000;
/** Beta test authorization ceiling: an enforced, non-resetting `total` app cap of at most 500 whole 2Z. */
export const TEST_SPEND_CAP_2Z = 500n;
/**
 * Sign-in suggestion for exactly the policy `verifyTestGrant` admits: `TEST_SPEND_CAP_2Z` in `total`.
 * Only a consent-screen pre-selection: Free2Z lowers the amount to the registration default and the
 * user's existing grant (and ignores it when their capped period differs), and the user may edit it.
 * Paid admission never trusts the hint; it re-reads the grant through `verifyTestGrant`.
 */
export const SIGN_IN_OPTIONS: Readonly<SignInOptions> = Object.freeze({
  spendCap: Object.freeze({cap2z: TEST_SPEND_CAP_2Z, period: 'total' as const}),
});
/** Read-only live snapshot. Never persist this as spending authority or treat revocation stamps as policy versions. */
export async function verifyTestGrant(
  client: Pick<SdkClient, 'session' | 'grant'>, policy: GrantPolicy, now: () => number = Date.now,
): Promise<VerifiedGrant> {
  if (!policy || !opaque(policy.subject) || !opaque(policy.clientId) || typeof policy.maximum2z !== 'bigint' || policy.maximum2z <= 0n || policy.maximum2z > TEST_SPEND_CAP_2Z)
    throw new TutorServiceError('authorization_required', 'Identify the approved account, registered app, and budget before using paid AI.');
  const before = await client.session();
  const selected = (session: Session) => session.signedIn && session.subject === policy.subject && session.grantedScopes.includes('ai:invoke') && opaque(session.generation);
  if (!selected(before)) throw new TutorServiceError('account_changed', 'The approved Free2Z account must remain signed in with AI access.');
  const grant = await client.grant();
  const after = await client.session();
  if (!selected(after) || after.generation !== before.generation)
    throw new TutorServiceError('account_changed', 'The Free2Z account changed while verifying consent.');
  const checkedAt = now(); const asOf = Date.parse(grant?.as_of);
  if (!grant || grant.sub !== policy.subject || grant.client_id !== policy.clientId || grant.enforced !== true ||
      grant.cap_period !== 'total' || typeof grant.spend_cap_2z !== 'bigint' || grant.spend_cap_2z <= 0n || grant.spend_cap_2z > policy.maximum2z ||
      typeof grant.account_epoch !== 'bigint' || grant.account_epoch < 0n || typeof grant.grant_generation !== 'bigint' || grant.grant_generation <= 0n ||
      !Array.isArray(grant.scopes) || !grant.scopes.includes('ai:invoke') || typeof grant.as_of !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:[Zz]|\+00:00)$/.test(grant.as_of) ||
      !Number.isFinite(asOf) || new Date(asOf).toISOString().slice(0,19) !== grant.as_of.slice(0,19).toUpperCase() || !Number.isFinite(checkedAt) || checkedAt - asOf > GRANT_MAX_AGE_MS || asOf - checkedAt > 5_000)
    throw new TutorServiceError('grant_verification_required', 'Free2Z must freshly verify an enforced total spending limit within the approved budget for this account and app.');
  return Object.freeze({subject: policy.subject, clientId: policy.clientId, period: 'total', limit2z: grant.spend_cap_2z, sessionGeneration: after.generation, asOf: grant.as_of, checkedAt});
}
export type ResumeContext =
  | {kind: 'activity'; profileId: string; candidateSkillIds: string[]}
  | {kind: 'curiosity'; profileId: string; activityId: string; question: string};
export interface TutorReply { text: string; operationId: string; context?: ResumeContext }
interface SavedRequest { model: string; messages: ChatRequest['messages']; maxOutputTokens: string }
interface Operation {
  id: string; key: string; subject: string; generation: string; createdAt: string;
  request: SavedRequest; state: 'opening' | 'streaming' | 'interrupted' | 'settling' | 'finalized';
  context?: ResumeContext; answerComplete?: true; consumed?: true;
  callId?: string; text: string; charge?: { state: 'pending' | 'released' | 'charged'; charged2z?: string; receiptId?: string };
}
interface Ledger { version: 1; operations: Operation[] }
const SLOT = 'aha-billing-v1';
const MAX_TEXT = 24_000;
const MAX_JOURNAL_BYTES = 480_000;
export class TutorServiceError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryAfterSeconds?: number) { super(message); this.name = 'TutorServiceError'; }
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
function validResumeContext(value: unknown): value is ResumeContext {
  if (!object(value) || !opaque(value.profileId) || value.profileId.length > 100) return false;
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
  if (input == null) return { version: 1, operations: [] };
  if (!object(input) || input.version !== 1 || !Array.isArray(input.operations) || !keys(input, ['version', 'operations'])) invalidJournal();
  try { if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_JOURNAL_BYTES) invalidJournal(); }
  catch { invalidJournal(); }
  const ids = new Set<string>(), operationKeys = new Set<string>();
  for (const op of input.operations) {
    if (!object(op) || !keys(op, ['id','key','subject','generation','createdAt','request','state','callId','text','charge','context','answerComplete','consumed']) ||
      !opaque(op.id) || !opaque(op.key) || !opaque(op.subject) || !opaque(op.generation) ||
      ids.has(op.id) || operationKeys.has(op.key) ||
      typeof op.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(op.createdAt) ||
      !Number.isFinite(Date.parse(op.createdAt)) || new Date(op.createdAt).toISOString() !== op.createdAt ||
      Date.parse(op.createdAt) > Date.now() ||
      !['opening','streaming','interrupted','settling','finalized'].includes(op.state) ||
      (op.callId !== undefined && !opaque(op.callId)) || typeof op.text !== 'string' || op.text.length > MAX_TEXT) invalidJournal();
    if (op.context !== undefined && !validResumeContext(op.context)) invalidJournal();
    if (op.answerComplete !== undefined && (op.answerComplete !== true || !['settling','finalized'].includes(op.state))) invalidJournal();
    if (op.consumed !== undefined && (op.consumed !== true || op.answerComplete !== true || !op.context)) invalidJournal();
    ids.add(op.id); operationKeys.add(op.key);
    const request = op.request;
    if (!object(request) || !keys(request, ['model','messages','maxOutputTokens']) || !opaque(request.model) ||
      request.maxOutputTokens !== '1800' || !Array.isArray(request.messages)) invalidJournal();
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
      if (length > 16_000) invalidJournal();
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
  constructor(readonly client: SdkClient, private readonly journal: Journal, private readonly subject: string) {}
  private async ledger(): Promise<Ledger> { return readLedger(await this.journal.getJournal(SLOT)); }
  private async persist(ledger: Ledger): Promise<void> {
    if (new TextEncoder().encode(JSON.stringify(ledger)).length > MAX_JOURNAL_BYTES)
      throw new TutorServiceError('journal_capacity', 'The usage journal needs archival before more AI requests.');
    readLedger(ledger);
    await this.journal.putJournal(SLOT, ledger);
  }
  private async archiveFinalized(ledger: Ledger): Promise<void> {
    for (const op of ledger.operations) {
      if (op.state !== 'finalized' || this.deliverable(op) || (!op.text && !op.request.messages.length)) continue;
      await this.journal.putJournal(`aha-call-${op.id}`, op);
      op.text = ''; op.request = {...op.request, messages: []};
    }
    await this.persist(ledger);
  }
  private async current(): Promise<Session> {
    const session = await this.client.session();
    if (!session.signedIn || session.subject !== this.subject) throw new TutorServiceError('account_changed', 'Sign in to the account that started this session.');
    if (!session.grantedScopes.includes('ai:invoke')) throw new TutorServiceError('scope_denied', 'Free2Z has not granted AI access to this app.');
    return session;
  }
  private verifyAuthorization(session: Session, authorization: TestAuthorization): void {
      if (!authorization || typeof authorization.maximum2z !== 'bigint' || authorization.subject !== session.subject || !opaque(authorization.clientId) || authorization.maximum2z <= 0n || authorization.maximum2z > TEST_SPEND_CAP_2Z)
        throw new TutorServiceError('authorization_required', 'Identify the approved test account and its budget before using paid AI.');
      const grant = authorization.verifiedGrant;
      if (!grant || typeof grant.limit2z !== 'bigint' || grant.subject !== session.subject || grant.clientId !== authorization.clientId || grant.sessionGeneration !== session.generation || !Number.isFinite(grant.checkedAt) || !Number.isFinite(Date.parse(grant.asOf)) || Date.now() - Date.parse(grant.asOf) > GRANT_MAX_AGE_MS || Date.parse(grant.asOf) - Date.now() > 5_000 || Date.now() - grant.checkedAt > GRANT_MAX_AGE_MS || grant.checkedAt > Date.now() || grant.period !== 'total' || grant.limit2z <= 0n || grant.limit2z > authorization.maximum2z)
        throw new TutorServiceError('grant_verification_required', 'Live testing requires verified total-period Free2Z grant metadata for this account. An estimate does not establish the grant period.');
  }
  private deliverable(op: Operation): boolean { return op.answerComplete === true && !!op.context && !op.consumed; }
  private replyValue(op: Operation): TutorReply {
    return {text:op.text,operationId:op.id,...(op.context ? {context:structuredClone(op.context)} : {})};
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
  async reply(model: string, system: string, context: string, authorization: TestAuthorization, resumeContext?: ResumeContext): Promise<TutorReply> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    if (resumeContext !== undefined && !validResumeContext(resumeContext))
      throw new TutorServiceError('resume_context_invalid', 'The learning context cannot be safely restored. No paid request was sent.');
    const savedContext = resumeContext === undefined ? undefined : structuredClone(resumeContext);
    this.busy = true; this.cancelled = false;
    try {
      const session = await this.current();
      this.verifyAuthorization(session, authorization);
      if (system.length + context.length > 16_000) throw new TutorServiceError('context_limit', 'The learning context is too large.');
      const ledger = await this.ledger();
      if (ledger.operations.some(o => o.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
      if (ledger.operations.some(op => this.deliverable(op))) throw new TutorServiceError('answer_pending', 'A completed AI reply is waiting to be restored. No new paid request was sent.');
      if (ledger.operations.some(o => o.state !== 'finalized')) throw new TutorServiceError('settlement_pending', 'An earlier AI request still needs receipt recovery. No new paid request was sent.');
      await this.archiveFinalized(ledger);
      const spent = ledger.operations.reduce((n, o) => n + BigInt(o.charge?.charged2z ?? '0'), 0n);
      const remaining = authorization.maximum2z - spent;
      if (remaining <= 0n) throw new TutorServiceError('budget_exhausted', 'The authorized test budget has been used.');
      const catalog = await this.client.models();
      if (!catalog.models.some(m => m.id === model)) throw new TutorServiceError('model_unavailable', 'Choose a currently available Free2Z model.');
      const request: ChatRequest = { model, messages: [{role:'system',content:[{type:'text',text:system}]},{role:'user',content:[{type:'text',text:context}]}], max_output_tokens: 1800n };
      const estimate = await this.client.estimate(request);
      // A hold is NOT a spending cap. Require the service-enforced grant remainder
      // itself to fit the entire remaining authorization, even if the call overruns its hold.
      const cap = estimate.cap_remaining_milli_2z;
      if (typeof cap !== 'bigint' || cap <= 0n || cap > remaining * 1000n)
        throw new TutorServiceError('grant_cap_required', `Set the Free2Z grant's total cap to at most ${remaining} 2Z before this test. An estimate alone cannot enforce the budget.`);
      const after = await this.current();
      if (after.generation !== session.generation || this.cancelled) throw new TutorServiceError('cancelled', 'The request was cancelled before starting.');
      const op: Operation = { id:crypto.randomUUID(),key:crypto.randomUUID(),subject:this.subject,generation:session.generation,createdAt:new Date().toISOString(),request:{model,messages:request.messages,maxOutputTokens:'1800'},state:'opening',text:'',...(savedContext ? {context:savedContext} : {}) };
      ledger.operations.push(op);
      if (new TextEncoder().encode(JSON.stringify(ledger)).length + MAX_TEXT * 6 > MAX_JOURNAL_BYTES)
        throw new TutorServiceError('journal_capacity', 'Archive usage history before another paid request.');
      await this.persist(ledger);
      return await this.run(ledger, op, request, authorization, remaining);
    } finally { this.active = undefined; this.busy = false; }
  }
  /** Explicit same-key recovery only; the gateway may replay just a receipt, not content. */
  async recover(operationId: string, authorization: TestAuthorization): Promise<TutorReply> {
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
      const request: ChatRequest = {model:op.request.model,messages:op.request.messages,max_output_tokens:BigInt(op.request.maxOutputTokens)};
      // An opening journal entry may never have reached the gateway. A same-key
      // call is potentially billable, so re-prove the cap under today's grant.
      const spent = ledger.operations.reduce((n, item) => n + BigInt(item.charge?.charged2z ?? '0'), 0n);
      const remaining = authorization.maximum2z - spent;
      if (remaining <= 0n) throw new TutorServiceError('budget_exhausted', 'The authorized test budget has been used.');
      const estimate = await this.client.estimate(request);
      const cap = estimate.cap_remaining_milli_2z;
      if (typeof cap !== 'bigint' || cap <= 0n || cap > remaining * 1000n)
        throw new TutorServiceError('grant_cap_required', 'Same-key recovery requires a verified total grant cap within the remaining test budget. Receipt reconciliation remains available.');
      const after = await this.current();
      if (after.generation !== session.generation || this.cancelled) throw new TutorServiceError('cancelled', 'Recovery was cancelled before sending.');
      op.generation = session.generation;
      await this.persist(ledger);
      return await this.run(ledger,op,request,authorization,remaining);
    } finally { this.active = undefined; this.busy = false; }
  }
  private async run(ledger: Ledger, op: Operation, request: ChatRequest, authorization: TestAuthorization, remaining: bigint): Promise<TutorReply> {
    let completed = false;
    try {
      // Durable writes and recovery can yield: refresh real consent and remainder at the send boundary.
      const verifiedGrant = await verifyTestGrant(this.client, authorization);
      const estimate = await this.client.estimate(request);
      const cap = estimate.cap_remaining_milli_2z;
      if (typeof cap !== 'bigint' || cap <= 0n || cap > remaining * 1000n)
        throw new TutorServiceError('grant_cap_required', 'The current grant remainder exceeds the remaining approved budget.');
      // The contract supplies a fresh snapshot, not an immutable per-operation spending guarantee.
      // The service independently enforces current consent; never infer policy identity from generation.
      // Persistence may have yielded for a long time. Fence again at the send boundary.
      const beforeSend = await this.current();
      this.verifyAuthorization(beforeSend, {...authorization, verifiedGrant});
      if (beforeSend.generation !== op.generation || this.cancelled)
        throw new TutorServiceError('cancelled', 'Account changed or request cancelled before sending.');
      const stream = await this.client.chat(request,{operationId:op.id,idempotencyKey:op.key}); this.active = stream;
      if (this.cancelled) { await stream.cancel(); throw new TutorServiceError('cancelled', 'Delivery stopped; billing may still settle.'); }
      const session = await this.current();
      if (session.generation !== op.generation) { await stream.cancel(); throw new TutorServiceError('account_changed','Account changed while opening the request.'); }
      op.state = 'streaming'; await this.persist(ledger);
      for await (const event of stream) {
        if (this.cancelled) throw new TutorServiceError('cancelled', 'Delivery stopped; billing may still settle.');
        const current = await this.current();
        if (current.generation !== op.generation) throw new TutorServiceError('account_changed','Account changed during the request.');
        if (event.type === 'meta') op.callId = event.call_id;
        if (event.type === 'delta') {
          if (op.text.length + event.text.length > MAX_TEXT) throw new TutorServiceError('output_limit','The lesson exceeded the supported size.');
          op.text += event.text;
        }
        if (event.type === 'tool_call') throw new TutorServiceError('unexpected_tool','This request did not authorize tools.');
        if (event.type === 'done' || event.type === 'error' || event.type === 'replay') {
          const charge = event.type === 'replay' ? event.record.charge : event.charge;
          op.charge = savedCharge(charge); op.state = charge.state === 'pending' ? 'settling' : 'finalized';
          if (event.type === 'replay') op.callId = event.record.call_id;
          if (event.type === 'done' && ['stop','end_turn'].includes(event.finish_reason)) op.answerComplete = true;
          await this.persist(ledger);
          if (event.type === 'error') throw new TutorServiceError(event.code,'The AI request ended with an error. Its charge remains recorded.');
          if (event.type === 'replay') throw new TutorServiceError('receipt_only','The receipt was recovered. The service does not replay the original answer; no new paid request was sent.');
          if (event.finish_reason !== 'stop' && event.finish_reason !== 'end_turn') throw new TutorServiceError('incomplete_output','The generated activity did not finish normally.');
          completed = true;
        }
        // Persist output incrementally; force-kill never turns an uncertain charge into zero.
        await this.persist(ledger);
      }
      if (!completed) throw new TutorServiceError('interrupted','The stream ended without a completed lesson.');
      return this.replyValue(op);
    } catch (error) {
      op.callId ??= this.active?.callId;
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
let nativeClient: Client | undefined;
export function getNativeClient(): Client { return nativeClient ??= new Client(new NativeTransport(nativeBridge)); }
