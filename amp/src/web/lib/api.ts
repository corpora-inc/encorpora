import type { z } from "zod";
import { AppError } from "./AppError";
const messages: Record<string, string> = {
  consent_required: "Continue setup to review parent consent.",
  parental_consent_required: "Continue setup to review parent consent.",
  license_required: "Choose a plan for this learner before practicing.",
  sign_in_required: "Your session ended. Sign in again to continue.",
  invalid_family_request: "Check the learner details and try again.",
  family_service_unavailable: "Family details could not be loaded. Try again.",
  notice_changed:
    "The parent notice was just updated. Review it and confirm again to continue.",
  email_unconfirmed:
    "Confirm your email first. Open the link we sent you, then continue.",
  offer_changed:
    "The price was just updated. Review the current plan, then continue.",
  checkout_plan_conflict:
    "A checkout for the other plan is still open. Continue that checkout, or wait for it to expire.",
  checkout_request_conflict:
    "That checkout closed. Choose your plan again to open a new one.",
  purchase_consent_unavailable:
    "Online enrollment just became unavailable. No payment was taken. Contact support for help.",
  paid_license_unavailable:
    "This payment is no longer active, so it can't be given to a learner. Open billing to review it.",
  paid_license_requires_reconciliation:
    "This payment needs a billing review before access starts. Contact support; you won't be charged again.",
  license_already_assigned:
    "This plan already belongs to another learner. Open practice to continue.",
  learner_already_licensed:
    "This learner already has access. Open practice to continue.",
  checkout_requires_reconciliation:
    "Your checkout needs a billing review before a new one can start. Contact support; you won’t be charged twice.",
  subscription_already_started:
    "Your payment already went through. Check your enrollment status instead of paying again.",
  license_ready_for_assignment:
    "Your payment is confirmed. Continue to add your learner.",
  purchase_not_found:
    "That purchase isn’t available to this account. Choose your plan again.",
  billing_account_not_found:
    "No billing account exists yet. Complete a checkout first.",
  billing_unavailable:
    "Billing is temporarily unavailable. Try again in a moment; you won’t be charged twice.",
  "trial-complete": "All free problems are used. Choose a plan to continue.",
  trial_ended:
    "That free practice has ended on this device. Continue to add the learner and choose a starting point.",
  "Too Many Requests":
    "Too many requests from this network. Wait a few minutes, then try again.",
};
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    token?: string | null;
    /** An anonymous free-trial token, sent instead of a parent token. */
    trial?: string | null;
    body?: unknown;
    signal?: AbortSignal;
    method?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      signal: options.signal,
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: {
        ...options.headers,
        ...(options.trial
          ? { Authorization: `Trial ${options.trial}` }
          : options.token
            ? { Authorization: `Bearer ${options.token}` }
            : {}),
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    const error = new AppError(
      "network",
      "Check your connection and try again.",
      true,
    );
    error.log();
    throw error;
  }
  const requestId = response.headers.get("x-request-id");
  const data: unknown = await response.json().catch(() => null);
  options.signal?.throwIfAborted();
  if (!response.ok) {
    const code =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "";
    const kind =
      response.status === 401
        ? "authentication"
        : response.status === 403
          ? "permission"
          : response.status < 500
            ? "validation"
            : "unavailable";
    const error = new AppError(
      kind,
      messages[code] ??
        (response.status >= 500
          ? "This service is temporarily unavailable. Try again."
          : "This request could not be completed. Check the details and try again."),
      response.status >= 500,
      requestId,
      code || null,
    );
    error.log();
    throw error;
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const error = new AppError(
      "contract",
      "The service returned incomplete information. Try again.",
      true,
      requestId,
    );
    error.log();
    throw error;
  }
  options.signal?.throwIfAborted();
  return parsed.data;
}
