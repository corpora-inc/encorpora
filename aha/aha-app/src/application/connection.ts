import { SdkError, type Models } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';

/** Only select IDs actually advertised to this account. Catalogue order is the service preference. */
export function chooseTutorModel(catalog: Models): string {
  const model = catalog.models.find(m => typeof m.id === 'string' &&
    m.id.length > 0 && m.id.length <= 256 && !/[\s\u0000-\u001f\u007f]/.test(m.id) &&
    (m.max_output_tokens === undefined || typeof m.max_output_tokens === 'bigint' && m.max_output_tokens >= 1800n));
  if (!model) throw new TutorServiceError('model_unavailable', 'No suitable math tutor model is available from Free2Z yet. Try Refresh connection in grown-up settings.');
  return model.id as string;
}

/** Translate stable classifications, never expose SDK details, IDs or raw response bodies. */
export function learningError(error: unknown): string {
  if (error instanceof SdkError || error instanceof TutorServiceError) {
    const messages: Record<string, string> = {
      insufficient_balance: 'Your Free2Z balance cannot cover this lesson. A grown-up can review the balance in Free2Z. No top-up happens automatically.',
      cap_exceeded: 'The spending allowance for this app is used up. A grown-up can review AHA’s authorization in Free2Z; adding balance alone does not change this allowance.',
      insufficient_scope: 'Free2Z has not granted the access needed for this action. A grown-up can sign in again and review the requested permissions.',
      scope_denied: 'Free2Z has not granted AI access to AHA. A grown-up can sign in again to review permissions.',
      invalid_token: 'Your Free2Z session needs a fresh sign-in. Your recorded learning progress is safe on this device.',
      token_revoked: 'Free2Z access has changed. A grown-up can sign in again; your recorded progress remains on this device.',
      insufficient_user_authentication: 'Free2Z needs a fresh sign-in from a grown-up before this action.',
      account_frozen: 'Free2Z has paused spending for this account. A grown-up can check the account in Free2Z.',
      account_in_debt: 'Free2Z reports an outstanding balance. A grown-up can review it in Free2Z before paid learning resumes.',
      model_disabled: 'This tutor model is temporarily unavailable. Refresh the connection before starting another lesson.',
      model_not_found: 'This tutor model is no longer available. Refresh the connection before starting another lesson.',
      unavailable: 'Free2Z is temporarily unavailable. Your progress is saved. Try Refresh connection later; no replacement paid request is sent automatically.',
      rate_limited: 'Free2Z is busy. Please wait before trying again. No replacement paid request is sent automatically.',
      concurrency_limit: 'Free2Z is already handling other requests for this account. Please wait before trying again.',
      cancelled: 'The request was stopped. Any recorded usage still needs to settle; check AI usage before starting another paid lesson.',
    };
    const message = messages[error.code] ?? (error instanceof TutorServiceError ? error.message : 'Free2Z could not complete this action. Your recorded progress is safe; try Refresh connection in grown-up settings.');
    const seconds = 'retryAfterSeconds' in error ? error.retryAfterSeconds : undefined;
    return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? `${message} Wait at least ${Math.ceil(seconds)} seconds.` : message;
  }
  return error instanceof Error ? error.message : 'The action could not finish. Your recorded progress remains on this device.';
}

export function retryDeadline(error: unknown, now = Date.now()): number | undefined {
  const seconds = error instanceof SdkError || error instanceof TutorServiceError ? error.retryAfterSeconds : undefined;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? now + Math.ceil(seconds * 1000) : undefined;
}
