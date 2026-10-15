import { SdkError, type Session } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';
import { diagnostics, type DiagnosticsLog } from '../diagnostics/log';

/** Translate stable classifications, never expose SDK details, IDs or raw response bodies. */
export function learningError(error: unknown): string {
  if (error instanceof SdkError || error instanceof TutorServiceError) {
    const messages: Record<string, string> = {
      // Store-neutral (App Store 3.1.1/3.1.3, Play Payments): a calm statement of fact. No amount, price or call to
      // buy or add 2Z; Settings offers only the neutral Manage Free2Z account exit.
      insufficient_balance: 'No credits. Local practice continues.',
      cap_exceeded: 'App budget reached. Local practice continues.',
      not_enough_2z: 'No credits. Local practice continues.',
      ai_not_ready: 'Free2Z AI isn’t switched on for apps yet. Nothing was charged.',
      budget_pending: 'Free2Z is still setting up spending for this app. Nothing was charged.',
      insufficient_scope: 'Free2Z has not granted the access needed for this action. Sign in again to review the requested permissions.',
      scope_denied: 'Free2Z has not granted AI access to AHA. Sign in again to review permissions.',
      invalid_token: 'Your Free2Z session needs a fresh sign-in. Your recorded learning progress is safe on this device.',
      token_revoked: 'Free2Z access has changed. Sign in again; your recorded progress remains on this device.',
      insufficient_user_authentication: 'Free2Z needs a fresh sign-in before this action.',
      account_frozen: 'Free2Z has paused spending for this account. You can check the account in Free2Z.',
      account_in_debt: 'Free2Z has paused AI for this account. Local practice continues.',
      model_disabled: 'This tutor model is temporarily unavailable. Refresh the connection before starting another lesson.',
      model_not_found: 'This tutor model is no longer available. Refresh the connection before starting another lesson.',
      unavailable: 'Free2Z is temporarily unavailable. Your progress is saved. Try Refresh connection later; no replacement paid request is sent automatically.',
      rate_limited: 'Free2Z is busy. Please wait before trying again. No replacement paid request is sent automatically.',
      concurrency_limit: 'Free2Z is already handling other requests for this account. Please wait before trying again.',
      cancelled: 'The request was stopped. Any recorded usage still needs to settle; check AI usage before starting another paid lesson.',
      // Recovery runs on its own (application/receiptRecovery.ts); nothing for the learner to do.
      settlement_pending: 'Finishing an earlier AI request. AHA settles it on its own; no new paid request is sent until it does.',
      too_large: 'This set of activities is too large for the chosen AI model. Choose another model in Settings. Nothing was charged.',
    };
    const message = messages[error.code] ?? (error instanceof TutorServiceError ? error.message : 'Free2Z could not complete this action. Your recorded progress is safe; try Refresh connection in Settings.');
    const seconds = 'retryAfterSeconds' in error ? error.retryAfterSeconds : undefined;
    return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? `${message} Wait at least ${Math.ceil(seconds)} seconds.` : message;
  }
  return error instanceof Error ? error.message : 'The action could not finish. Your recorded progress remains on this device.';
}

/**
 * The refusal kind: `low_balance` (402 `insufficient_balance`, "No credits") or `raise_budget` (403 `cap_exceeded`,
 * "App budget reached"). Either one makes Manage Free2Z account the primary action in Settings. Anything else is undefined.
 */
export function refusalAction(error: unknown): 'low_balance' | 'raise_budget' | undefined {
  if (!(error instanceof SdkError || error instanceof TutorServiceError)) return undefined;
  return error.code === 'insufficient_balance' ? 'low_balance' : error.code === 'cap_exceeded' ? 'raise_budget' : undefined;
}

export function retryDeadline(error: unknown, now = Date.now()): number | undefined {
  const seconds = error instanceof SdkError || error instanceof TutorServiceError ? error.retryAfterSeconds : undefined;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
    ? now + Math.ceil(seconds * 1000) : undefined;
}

/**
 * The connected account as Settings names it: "@username" when Free2Z granted the `profile` scope, else "Free2Z account".
 * Display only. Usernames are not unique and can change, so nothing is ever keyed by this; local data stays keyed by
 * `subject`. A session from before AHA asked for `profile` has none until its next sign-in.
 */
export function accountLabel(session: Pick<Session, 'preferredUsername'>): string {
  const name = session.preferredUsername?.trim();
  return name ? `@${name}` : 'Free2Z account';
}

/** Shown, at most, after the person closes the Free2Z sign-in themselves. */
export const SIGN_IN_NOT_COMPLETED = 'Free2Z sign-in closed; you can connect any time.';

/**
 * Codes that mean the person closed or declined sign-in, not that anything broke.
 * Since tauri-plugin-f2z d4d58ea3 (zuu #1138) a dismissed iOS ASWebAuthenticationSession or
 * Android Custom Tab rejects with `user_cancelled`. `browser_error` is the fallback for any
 * other browser failure, and what every rejection was before #1138 (an older plugin); it stays
 * quiet as before. `access_denied` is the IdP's answer when consent is declined; `cancelled` is a
 * sign-in the plugin itself stopped (sign-out, window closed). `browser_unavailable` and `timeout`
 * are failures with their own messages below.
 */
const SIGN_IN_CLOSED = new Set(['user_cancelled', 'browser_error', 'access_denied', 'cancelled']);
const SIGN_IN_MESSAGES: Record<string, string> = {
  authentication_busy: 'A Free2Z sign-in is already open. Finish or close it, then try again.',
  timeout: 'The Free2Z sign-in took too long and was closed. Tap Connect Free2Z to try again.',
  browser_unavailable: 'AHA could not open a browser for the Free2Z sign-in. Check that a web browser is installed and enabled, then tap Connect Free2Z again.',
  transport_error: 'AHA could not reach Free2Z. Check the internet connection, then try again.',
  storage_unavailable: 'This device could not keep the Free2Z sign-in safely, so AHA did not connect. Please try again.',
  invalid_authentication_response: 'Free2Z’s sign-in reply could not be verified, so AHA did not connect. Please try again.',
  protocol_error: 'Free2Z’s sign-in reply could not be verified, so AHA did not connect. Please try again.',
  login_required: 'Free2Z needs you to finish signing in. Tap Connect Free2Z to try again.',
  consent_required: 'Free2Z needs you to finish signing in. Tap Connect Free2Z to try again.',
  interaction_required: 'Free2Z needs you to finish signing in. Tap Connect Free2Z to try again.',
  server_error: 'Free2Z is temporarily unavailable. Please try connecting again later.',
  temporarily_unavailable: 'Free2Z is temporarily unavailable. Please try connecting again later.',
  unavailable: 'Free2Z is temporarily unavailable. Please try connecting again later.',
  configuration_error: 'Free2Z sign-in is not set up correctly in this version of AHA. Your progress is safe; please report this problem.',
  invalid_scope: 'Free2Z sign-in is not set up correctly in this version of AHA. Your progress is safe; please report this problem.',
  invalid_request: 'Free2Z sign-in is not set up correctly in this version of AHA. Your progress is safe; please report this problem.',
  unauthorized_client: 'Free2Z sign-in is not set up correctly in this version of AHA. Your progress is safe; please report this problem.',
};
const SIGN_IN_GENERIC = 'The Free2Z sign-in did not finish. Your progress is safe; please try again.';

export type SignInOutcome = { quiet: true; note: string } | { quiet: false; message: string };

/**
 * Classify a rejected native sign-in. A person closing the sign-in is recorded as
 * a warn/info event and returns quietly; every other failure, known or not, is logged
 * as an error with its code before a kind, code-free message is shown.
 */
export function signInFailure(error: unknown, log: Pick<DiagnosticsLog, 'add' | 'error'> = diagnostics): SignInOutcome {
  const code = error instanceof SdkError ? error.code : undefined;
  if (code !== undefined && SIGN_IN_CLOSED.has(code)) {
    // browser_error is the unclassified fallback (it may be a browser that never opened), so it
    // stays visible in the console (warn) though the UI is quiet; a cancel or decline is just info.
    log.add(code === 'browser_error' ? 'warn' : 'info', 'sign-in', `Sign-in closed by the person or browser [${code}]`);
    return { quiet: true, note: SIGN_IN_NOT_COMPLETED };
  }
  log.error('sign-in', error);
  const message = code !== undefined ? SIGN_IN_MESSAGES[code] : undefined;
  return { quiet: false, message: message ?? SIGN_IN_GENERIC };
}
