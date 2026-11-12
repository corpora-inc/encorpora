import { observeLearningRequest } from "./learning-analytics";
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
  not_found:
    "This class isn't open to this account. Check the link, or ask your school's AMP admin.",
  invalid_school_request: "Check the details and try again.",
  school_service_unavailable:
    "School details could not be loaded. Try again in a moment.",
  too_many_requests:
    "Too many requests from this network. Wait a minute, then try again.",
  gift_unavailable:
    "This invitation is no longer available. Return to your access page to check your options.",
  gift_already_assigned:
    "This gift is already attached to a learner. Open practice to continue.",
  gift_learner_unavailable: "Choose a learner from this account and try again.",
  family_learner_required:
    "Add a learner first. Your family’s gift starts with them.",
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
  profile_not_found:
    "This profile isn’t in your account anymore. Choose another from your places.",
  consent_withdrawn:
    "Learning is paused for this account. Open Family → Privacy to resume it.",
  starter_unavailable: "Sign in with your own account to start a place.",
  own_practice_too_young:
    "Under 13, a parent sets up AMP for you. Ask yours to choose “I’m a parent”.",
  family_class_required: "Your family’s class couldn’t be made. Try again.",
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
  "free-allowance-complete": "Continue with AMP to practice more.",
  too_many_learners:
    "This account has 1,000 learners, the most one account can hold. Delete a learner to add another.",
  "free-workbooks-complete": "Continue with AMP to make more workbooks.",
  free_workbooks_unavailable: "This learner has no workbook available yet.",
  "Too Many Requests":
    "Too many requests from this network. Wait a few minutes, then try again.",
};
/** What a request was for, so a failure without its own message still says
 * what failed: what didn't load, or what didn't go through. */
const areas: [RegExp, string, string][] = [
  [/^\/billing\/(prices|offer)/, "The plans", "Choosing a plan"],
  [/^\/billing\/status\//, "This learner’s plan", "Checking the plan"],
  [/^\/billing\/checkout/, "Checkout", "Opening checkout"],
  [/^\/billing\//, "Billing", "The billing change"],
  [/^\/family\/second-parent/, "The second parent", "The invitation"],
  [/^\/family\/approvals/, "The approval", "The approval"],
  [/^\/family\//, "Family details", "The family change"],
  [/^\/me\/profiles/, "Practice profiles", "The profile change"],
  [/^\/me\/practice/, "Your practice", "Starting your practice"],
  [/^\/me(\/|$)/, "Your account", "The account change"],
  [/^\/start/, "Getting started", "Getting started"],
  [/^\/school\//, "School details", "The school change"],
  [/^\/learners\/[^/]+\/workbooks/, "Workbooks", "The workbook"],
  [/^\/learners\//, "This learner", "The learner change"],
  [/^\/(problems|practice|attempts|batches)/, "Practice", "Your answer"],
  [/^\/access/, "Your access", "Activating access"],
  [/^\/(funding|invoices)/, "The funding request", "The funding request"],
];
/** The message for a failure the server gave no known code for. */
export function failureMessage(path: string, method: string, status: number) {
  const read = method === "GET";
  const [, thing, change] = areas.find(([pattern]) => pattern.test(path)) ?? [
    null,
    "This page",
    "That change",
  ];
  if (status >= 500)
    return `${read ? thing : change} isn’t available right now. Try again in a moment.`;
  return read
    ? `${thing} didn’t load. Try again.`
    : `${change} didn’t go through. Check what you entered, then try again.`;
}
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
    body?: unknown;
    signal?: AbortSignal;
    method?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const method =
    options.method ?? (options.body === undefined ? "GET" : "POST");
  const purchase = observePurchaseRequest(path, method);
  const learning = observeLearningRequest(path, method);
  const observe = (
    outcome: "succeeded" | "failed" | "cancelled",
    failure?: import("./AppError").ErrorKind,
  ) => {
    purchase(outcome, failure);
    learning(outcome, failure);
  };
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
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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
  // The demo school was rebuilt overnight: this link was into yesterday's.
  // The visitor's place is already in today's, so open it there instead of
  // failing (docs/schools.md#demo-places).
  if (response.status === 409 && errorCode(data) === "demo_moved") {
    const next =
      data && typeof data === "object" && "path" in data
        ? String(data.path)
        : "";
    if (/^school\/[0-9a-f-]{36}\/classes\/[0-9a-f-]{36}\/today$/.test(next)) {
      observe("cancelled");
      location.replace(`/${next}`);
      return new Promise<never>(() => {});
    }
  }
  // The server ended this parent's sign-in: go to sign-in instead of failing.
  if (response.status === 401 && signedOut()) {
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
      messages[code] ?? failureMessage(path, method, response.status),
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
