import { SdkError } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';
import { learningError } from './connection';

export interface BackoffPolicy { baseTasks: number; baseMs: number; maxTasks: number; maxMs: number }
const DEFAULT_POLICY: BackoffPolicy = {baseTasks: 3, baseMs: 60_000, maxTasks: 12, maxMs: 10 * 60_000};

/**
 * When signed-in AI cannot produce an activity, local practice continues and AI is
 * retried later: after N local tasks OR M milliseconds (whichever comes first),
 * doubling on consecutive failures up to a cap, and never before a service Retry-After.
 * In-memory only: a restart tries AI again. This gates only *attempts*; every paid call
 * still passes grant verification and the provider's pending-receipt fence.
 */
export class AiBackoff {
  private failures = 0;
  private failedAt = 0;
  private localTasks = 0;
  private notBefore = 0;
  constructor(private readonly policy: BackoffPolicy = DEFAULT_POLICY) {}
  get degraded(): boolean { return this.failures > 0; }
  shouldTryAi(now: number): boolean {
    if (now < this.notBefore) return false;
    if (!this.failures) return true;
    const factor = 2 ** Math.min(this.failures - 1, 30);
    const tasks = Math.min(this.policy.baseTasks * factor, this.policy.maxTasks);
    const ms = Math.min(this.policy.baseMs * factor, this.policy.maxMs);
    return this.localTasks >= tasks || now - this.failedAt >= ms;
  }
  recordFailure(now: number, retryAt?: number): void {
    this.failures++;
    this.failedAt = now;
    this.localTasks = 0;
    if (retryAt !== undefined && Number.isFinite(retryAt)) this.notBefore = Math.max(this.notBefore, retryAt);
  }
  recordLocalTask(): void { if (this.failures) this.localTasks++; }
  recordSuccess(): void { this.failures = 0; this.failedAt = 0; this.localTasks = 0; this.notBefore = 0; }
}

/** Grown-up settings status for a fallback: the classified cause, then that learning continues here. */
export function aiFallbackStatus(error: unknown): string {
  return `${learningError(error)} Local practice continues in this account; AI tutoring will be tried again on a later task.`;
}

/** Visible log with context. Only the stable classification and message, never SDK response details. */
export function logAiFallback(stage: string, error: unknown): void {
  const code = error instanceof SdkError || error instanceof TutorServiceError ? error.code : undefined;
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[aha] AI unavailable for ${stage}; serving local practice in this account.`, JSON.stringify({code, name, message}));
}
