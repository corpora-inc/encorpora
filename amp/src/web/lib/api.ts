import { observePurchaseRequest } from "./purchase-analytics";
import type { z } from "zod";
import { AppError } from "./AppError";
import { validationPaths } from "./batch-capability-fallback";
import {
  buildIsStale,
  reloadIntoCurrentRelease,
  signedOut,
} from "./app-recovery";
const messages: Record<string, string> = {
  gift_unavailable:
    "This invitation is no longer available. Return to your access page to check your options.",
  gift_already_assigned:
    "This gift is already attached to a learner. Open practice to continue.",
  gift_learner_unavailable: "Choose a learner from this account and try again.",
  invalid_gift_request: "Choose a learner and try again.",
  gift_service_unavailable:
    "Your access could not be activated. Please try again; your gift will not be used twice.",
  confirmed_parent_email_required:
    "Sign in and confirm the parent email used on your invoice.",
  invoice_cannot_discard:
    "This invoice cannot be discarded. Check its payment status before making another request.",
  invoice_unavailable:
    "This invoice needs a billing review. Contact support with your invoice number before making another payment.",
  invoice_already_claimed:
    "This invoice is already connected to another learner. Open your purchase history.",
  invoice_name_font_unsupported:
    "This PDF cannot print one of the characters in the student name. Contact support for an invoice with the correct name.",
  offer_unavailable:
    "This offer is unavailable. Refresh to check purchase options.",
  invalid_funding_request: "Check the email and student name, then try again.",
  verified_consent_required:
    "Complete the parent notice before connecting your learner.",

  purchase_measurement_changed:
    "Your preference changed in another request. Review the updated setting and try again.",
  purchase_measurement_email_required:
    "Confirm your own AMP account email before allowing purchase sharing.",
  purchase_measurement_unavailable:
    "Your purchase preference could not be saved. Refresh and try again.",
  invalid_purchase_measurement_request:
    "Review the purchase-sharing notice and choose again.",
  consent_required: "Continue setup to review parent consent.",
  parental_consent_required: "Continue setup to review parent consent.",
  license_required: "Choose a plan for this learner before practicing.",
  sign_in_required: "Your session ended. Sign in again to continue.",
  "Sign in to continue": "Your session ended. Sign in again to continue.",
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
const errorCode = (data: unknown) =>
  data &&
  typeof data === "object" &&
  "error" in data &&
  typeof data.error === "string"
    ? data.error
    : "";
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
  const method =
    options.method ?? (options.body === undefined ? "GET" : "POST");
  const observe = observePurchaseRequest(path, method);
  const checkAborted = () => {
    if (options.signal?.aborted) {
      observe("cancelled");
      options.signal.throwIfAborted();
    }
  };
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      signal: options.signal,
      method,
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
    if (options.signal?.aborted) {
      observe("cancelled");
      throw cause;
    }
    const error = new AppError(
      "network",
      "Check your connection and try again.",
      true,
    );
    observe("failed", error.kind);
    error.log();
    throw error;
  }
  const requestId = response.headers.get("x-request-id");
  const data: unknown = await response.json().catch(() => null);
  checkAborted();
  // A tab running an older release than the API: a missing route or a
  // rejected sign-in reloads into the current release rather than reporting a
  // failure the visitor didn't cause. Other errors still show, so a filled-in
  // form is never wiped by a reload.
  if (
    (response.status === 401 || response.status === 404) &&
    (await buildIsStale())
  ) {
    const reloading = reloadIntoCurrentRelease();
    if (reloading) return reloading;
  }
  // The server ended this parent's sign-in: go to sign-in instead of failing.
  // A free-practice request reports the parent's sign-in the same way; only
  // "This free trial has ended" belongs to the practice screens.
  if (
    response.status === 401 &&
    (!options.trial || errorCode(data) === "Sign in to continue") &&
    signedOut()
  ) {
    observe("cancelled");
    return new Promise<never>(() => {});
  }
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
      response.status,
      code === "Invalid request" &&
        data &&
        typeof data === "object" &&
        "details" in data
        ? validationPaths(data.details)
        : null,
    );
    observe("failed", error.kind);
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
    observe("failed", error.kind);
    error.log();
    throw error;
  }
  checkAborted();
  observe("succeeded");
  return parsed.data;
}
