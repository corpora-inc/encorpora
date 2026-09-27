import { Client, NativeTransport, type ChatRequest, type ChatStream, type Charge, type Session } from '@free2z/sdk';
import { nativeBridge } from '@free2z/tauri-plugin-f2z-api';

export interface Journal { getJournal(key: string): Promise<unknown>; putJournal(key: string, value: any): Promise<void> }
export type SdkClient = Pick<Client, 'session' | 'signIn' | 'signOut' | 'balance' | 'models' | 'estimate' | 'chat' | 'call'>;
export interface TestAuthorization { subject: string; maximum2z: bigint; verifiedGrant: { subject: string; period: 'total'; limit2z: bigint } }
interface SavedRequest { model: string; messages: ChatRequest['messages']; maxOutputTokens: string }
interface Operation {
  id: string; key: string; subject: string; generation: string; createdAt: string;
  request: SavedRequest; state: 'opening' | 'streaming' | 'interrupted' | 'settling' | 'finalized';
  callId?: string; text: string; charge?: { state: 'pending' | 'released' | 'charged'; charged2z?: string; receiptId?: string };
}
interface Ledger { version: 1; operations: Operation[] }
const SLOT = 'aha-billing-v1';
const MAX_TEXT = 24_000;
const MAX_JOURNAL_BYTES = 480_000;
export class TutorServiceError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'TutorServiceError'; }
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
function readLedger(input: unknown): Ledger {
  if (input == null) return { version: 1, operations: [] };
  if (typeof input !== 'object' || (input as Ledger).version !== 1 || !Array.isArray((input as Ledger).operations))
    throw new TutorServiceError('journal_invalid', 'The usage journal needs recovery before another paid request.');
  const ledger = input as Ledger;
  for (const op of ledger.operations) {
    if (!op || typeof op.id !== 'string' || typeof op.subject !== 'string' || typeof op.key !== 'string' ||
      !['opening', 'streaming', 'interrupted', 'settling', 'finalized'].includes(op.state) ||
      typeof op.text !== 'string' || !op.request || !Array.isArray(op.request.messages) ||
      (op.charge?.state === 'charged' && !/^\d+$/.test(op.charge.charged2z ?? '')))
      throw new TutorServiceError('journal_invalid', 'The usage journal is incomplete; paid requests are paused.');
  }
  return ledger;
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
    await this.journal.putJournal(SLOT, ledger);
  }
  private async archiveFinalized(ledger: Ledger): Promise<void> {
    for (const op of ledger.operations) {
      if (op.state !== 'finalized' || (!op.text && !op.request.messages.length)) continue;
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
  async cancel(): Promise<void> { this.cancelled = true; await this.active?.cancel(); }
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
  async reply(model: string, system: string, context: string, authorization: TestAuthorization): Promise<{ text: string; operationId: string }> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    this.busy = true; this.cancelled = false;
    try {
      const session = await this.current();
      if (authorization.subject !== session.subject || authorization.maximum2z <= 0n || authorization.maximum2z > 500n)
        throw new TutorServiceError('authorization_required', 'Identify the approved test account and its budget before using paid AI.');
      const grant = authorization.verifiedGrant;
      if (!grant || grant.subject !== session.subject || grant.period !== 'total' || grant.limit2z <= 0n || grant.limit2z > authorization.maximum2z)
        throw new TutorServiceError('grant_verification_required', 'Live testing requires verified total-period Free2Z grant metadata for this account. An estimate does not establish the grant period.');
      if (system.length + context.length > 16_000) throw new TutorServiceError('context_limit', 'The learning context is too large.');
      const ledger = await this.ledger();
      if (ledger.operations.some(o => o.subject !== this.subject)) throw new TutorServiceError('account_mismatch', 'Usage records belong to another account.');
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
      const op: Operation = { id:crypto.randomUUID(),key:crypto.randomUUID(),subject:this.subject,generation:session.generation,createdAt:new Date().toISOString(),request:{model,messages:request.messages,maxOutputTokens:'1800'},state:'opening',text:'' };
      ledger.operations.push(op);
      if (new TextEncoder().encode(JSON.stringify(ledger)).length + MAX_TEXT * 6 > MAX_JOURNAL_BYTES)
        throw new TutorServiceError('journal_capacity', 'Archive usage history before another paid request.');
      await this.persist(ledger);
      return await this.run(ledger, op, request);
    } finally { this.active = undefined; this.busy = false; }
  }
  /** Explicit same-key recovery only; the gateway may replay just a receipt, not content. */
  async recover(operationId: string): Promise<{text: string; operationId: string}> {
    if (this.busy) throw new TutorServiceError('busy', 'An AI request is already in progress.');
    this.busy = true; this.cancelled = false;
    try {
      await this.current(); const ledger = await this.ledger(); const op = ledger.operations.find(o => o.id === operationId);
      if (!op || op.subject !== this.subject) throw new TutorServiceError('operation_missing', 'That request does not belong to this account.');
      if (op.state === 'finalized') throw new TutorServiceError('already_finalized', 'This request is already settled; use its saved content.');
      const age = Date.now() - Date.parse(op.createdAt);
      if (!Number.isFinite(age) || age < 0 || age >= 24 * 60 * 60 * 1000) throw new TutorServiceError('recovery_expired', 'The same-key recovery window has expired. No replacement paid request was sent.');
      const session = await this.current(); op.generation = session.generation;
      const request: ChatRequest = {model:op.request.model,messages:op.request.messages,max_output_tokens:BigInt(op.request.maxOutputTokens)};
      return await this.run(ledger,op,request);
    } finally { this.active = undefined; this.busy = false; }
  }
  private async run(ledger: Ledger, op: Operation, request: ChatRequest): Promise<{text: string; operationId: string}> {
    let completed = false;
    try {
      // Persistence may have yielded for a long time. Fence again at the send boundary.
      const beforeSend = await this.current();
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
      return {text:op.text,operationId:op.id};
    } catch (error) {
      op.callId ??= this.active?.callId;
      if (op.state !== 'finalized' && op.state !== 'settling') op.state = 'interrupted';
      // Cancellation must happen even when disk-full prevents a journal update.
      try { await this.active?.cancel(); } catch { /* original opening record remains uncertain */ }
      try { await this.persist(ledger); } catch {
        throw new TutorServiceError('journal_write_failed', 'Local storage failed. Delivery was stopped; the saved opening request still requires receipt recovery.');
      }
      if (error instanceof TutorServiceError) throw error;
      throw new TutorServiceError('service_unavailable','Free2Z could not finish this request. Its identity is saved for recovery.');
    }
  }
}
let nativeClient: Client | undefined;
export function getNativeClient(): Client { return nativeClient ??= new Client(new NativeTransport(nativeBridge)); }
