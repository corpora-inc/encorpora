import { SdkError } from '@free2z/sdk';
import { TutorServiceError, type PaidAuthorization, type PendingOperation, type TutorReply } from '../provider/free2z';
import { describeError, type LogLevel } from '../diagnostics/log';

/**
 * Automatic receipt recovery (same-key, never a fresh key).
 *
 * An AI request that a restart, reinstall or dropped connection interrupted stays in the journal unsettled, and the
 * provider refuses every new paid call until it settles (#882). This settles it with no learner action, using only
 * the provider's existing recovery paths:
 * - `reconcile()`: reads `GET /v1/calls/{id}` for operations that reached the gateway (free, no new call);
 * - `recover(id)`: resends the journaled body with the operation's ORIGINAL Idempotency-Key, which replays that call's
 *   settled result and never charges twice. A completed reply comes back from the journal without any service call.
 *
 * It never sends a new paid request and never clears the block itself: the block clears only when the journal shows
 * nothing unsettled. Failures retry with backoff; only a persistent failure produces a Settings note.
 */
export type RecoveryTrigger = 'launch' | 'sign-in' | 'resume' | 'before-batch' | 'before-request' | 'manual' | 'retry';

/** The provider surface recovery uses. `Free2zTutor` implements it; tests may pass a real tutor over a fake SDK. */
export interface ReceiptTutor {
  inspectPending(): Promise<PendingOperation[]>;
  reconcile(): Promise<{ pending: number; spent2z: bigint }>;
  recover(operationId: string, authorization: PaidAuthorization): Promise<TutorReply>;
}
export interface RecoveryHooks {
  tutor: ReceiptTutor;
  /** The free grant check (no paid call). May throw; reconcile still runs without it. */
  authorize(): Promise<PaidAuthorization>;
  /** The learner on screen: an operation started for another learner is recovered when that learner is selected. */
  profileId(): string | undefined;
  /** Hand a recovered reply to the learner. A reply the caller does not deliver stays saved in the journal. */
  deliver(reply: TutorReply): Promise<void>;
  log(level: LogLevel, message: string): void;
}
export interface RecoveryOutcome {
  /** `clear`: nothing unsettled. `blocked`: still unsettled after this attempt. `deferred`: waiting for the backoff. */
  state: 'clear' | 'blocked' | 'deferred';
  /** Unsettled operations after the attempt. */
  pending: number;
  /** Something was unsettled and this attempt tried to settle it (false when nothing was pending, or deferred). */
  attempted: boolean;
  /** The free grant check passed during this attempt, so AI can be shown as ready once clear. */
  authorized: boolean;
  /** A calm, actionable Settings note, only after recovery has failed persistently. */
  note?: string;
  /** When the next automatic attempt is due (blocked or deferred). */
  retryInMs?: number;
  error?: unknown;
}

/** Unsettled this long, recovery is reported as persistently failing. Matches the gateway's same-key window. */
export const PERSISTENT_MS = 24 * 60 * 60 * 1000;
export const RETRY_BASE_MS = 15_000;
export const RETRY_MAX_MS = 10 * 60_000;
/** Codes no automatic retry can fix. */
const DEFINITIVE = new Set(['recovery_expired', 'account_mismatch', 'operation_missing', 'journal_invalid', 'already_finalized']);
export const PERSISTENT_NOTE =
  'An earlier AI request has not settled. No new AI request is sent until it does, and local practice continues. ' +
  'Try Recover original request below; if it stays, send a problem report.';
export const OTHER_LEARNER_NOTE =
  'An earlier AI request belongs to another learner on this device. Open that learner to finish it; local practice continues.';

const codeOf = (error: unknown): string | undefined =>
  error instanceof TutorServiceError || error instanceof SdkError ? error.code : undefined;
const retryAfterMs = (error: unknown): number => {
  const seconds = error instanceof TutorServiceError || error instanceof SdkError ? error.retryAfterSeconds : undefined;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : 0;
};

export class ReceiptRecovery {
  private failures = 0;
  private nextAt = 0;
  private running?: Promise<RecoveryOutcome>;
  constructor(private readonly now: () => number = Date.now) {}
  /** Consecutive failed attempts (for tests and diagnostics). */
  get failedAttempts(): number { return this.failures; }

  /**
   * One attempt. Concurrent callers share the attempt in progress. `force` (launch, Refresh connection) ignores the
   * backoff; automatic triggers respect it.
   */
  run(trigger: RecoveryTrigger, hooks: RecoveryHooks, options: { force?: boolean } = {}): Promise<RecoveryOutcome> {
    if (this.running) return this.running;
    const run = this.attempt(trigger, hooks, !!options.force).finally(() => { if (this.running === run) this.running = undefined; });
    this.running = run;
    return run;
  }

  private async attempt(trigger: RecoveryTrigger, hooks: RecoveryHooks, force: boolean): Promise<RecoveryOutcome> {
    const { tutor, log } = hooks;
    let pending: PendingOperation[];
    try { pending = await tutor.inspectPending(); }
    catch (error) { return this.blocked(trigger, hooks, [], error, false); }
    if (!pending.length) { this.reset(); return { state: 'clear', pending: 0, attempted: false, authorized: false }; }
    const now = this.now();
    if (!force && now < this.nextAt)
      return { state: 'deferred', pending: pending.length, attempted: false, authorized: false, retryInMs: this.nextAt - now, ...this.persistent(pending, undefined) };
    log('info', `${trigger}: ${pending.length} unsettled AI request${pending.length === 1 ? '' : 's'}; recovering with the original request identity`);
    let lastError: unknown;
    let authorization: PaidAuthorization | undefined;
    try { authorization = await hooks.authorize(); }
    catch (error) { lastError = error; }
    // 1. Free: read the settled record of every operation that reached the gateway.
    if (pending.some(op => op.canReconcile)) {
      try {
        const result = await tutor.reconcile();
        log('info', `${trigger}: receipt check left ${result.pending} unsettled`);
      } catch (error) { lastError = error; log('warn', `${trigger}: receipt check failed: ${describeError(error)}`); }
      try { pending = await tutor.inspectPending(); }
      catch (error) { return this.blocked(trigger, hooks, pending, error, !!authorization); }
    }
    // 2. Same-key recovery of whatever is still unsettled (the original key and identical body; never a new key).
    const learner = hooks.profileId();
    for (const op of pending) {
      if (op.profileId && op.profileId !== learner) continue;
      if (!op.canRecover) continue;
      if (!authorization) continue;
      try {
        const reply = await tutor.recover(op.operationId, authorization);
        log('info', `${trigger}: recovered an earlier ${reply.context?.kind ?? 'AI'} request with its original identity`);
        try { await hooks.deliver(reply); }
        catch (error) { log('warn', `${trigger}: the recovered reply stays saved: ${describeError(error)}`); }
      } catch (error) {
        // The gateway replayed only the receipt: the operation is settled, there is just no text to show.
        if (codeOf(error) === 'receipt_only') { log('info', `${trigger}: receipt recovered (the original reply is not replayed)`); continue; }
        lastError = error;
        log('warn', `${trigger}: same-key recovery failed: ${describeError(error)}`);
      }
    }
    let remaining: PendingOperation[];
    try { remaining = await tutor.inspectPending(); }
    catch (error) { return this.blocked(trigger, hooks, pending, error, !!authorization); }
    if (!remaining.length) {
      this.reset();
      log('info', `${trigger}: every earlier AI request is settled; AI continues`);
      return { state: 'clear', pending: 0, attempted: true, authorized: !!authorization };
    }
    return this.blocked(trigger, hooks, remaining, lastError, !!authorization);
  }

  private blocked(trigger: RecoveryTrigger, hooks: RecoveryHooks, pending: PendingOperation[], error: unknown, authorized: boolean): RecoveryOutcome {
    this.failures++;
    const delay = Math.max(Math.min(RETRY_BASE_MS * 2 ** Math.min(this.failures - 1, 20), RETRY_MAX_MS), retryAfterMs(error));
    this.nextAt = this.now() + delay;
    const persistent = this.persistent(pending, error, hooks.profileId());
    hooks.log(persistent.note ? 'warn' : 'info',
      `${trigger}: ${pending.length || 'some'} AI request${pending.length === 1 ? '' : 's'} still unsettled` +
      `${error === undefined ? '' : ` (${describeError(error)})`}; no new paid request; retrying in ${Math.ceil(delay / 1000)} s`);
    return { state: 'blocked', pending: pending.length, attempted: true, authorized, retryInMs: delay, ...(error === undefined ? {} : { error }), ...persistent };
  }

  /** Persistent: a definitive error, nothing automatic can settle it, or unsettled for a day. */
  private persistent(pending: PendingOperation[], error: unknown, learner?: string): { note?: string } {
    const now = this.now();
    const oldest = Math.min(...pending.map(op => Date.parse(op.createdAt)).filter(Number.isFinite));
    const stuck = pending.some(op => !op.canRecover && !op.canReconcile);
    const definitive = DEFINITIVE.has(codeOf(error) ?? '');
    if (definitive || stuck || (Number.isFinite(oldest) && now - oldest >= PERSISTENT_MS))
      return { note: PERSISTENT_NOTE };
    if (learner !== undefined && pending.length && pending.every(op => op.profileId && op.profileId !== learner))
      return { note: OTHER_LEARNER_NOTE };
    return {};
  }

  private reset(): void { this.failures = 0; this.nextAt = 0; }
}
