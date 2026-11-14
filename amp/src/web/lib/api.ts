import {
  requestWith,
  requestMethod,
  replacedSession,
  type RequestOptions,
} from "./request-transport";
export {
  requestWith,
  requestFetch,
  SessionUnconfirmedError,
} from "./request-transport";
import { observeLearningRequest } from "./learning-analytics";
import { observePurchaseRequest } from "./purchase-analytics";
import type { z } from "zod";
import { AppError } from "./AppError";
import { isRetired } from "./session-generation";
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
  demo_preparing: "The demo is being prepared. Try again in a few minutes.",
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
 * what failed, as one plain sentence: "Couldn’t load <what it reads>." or
 * "Couldn’t <what it does>." Each part is written to follow those words, so
 * a plural ("your workbooks") never meets a singular verb. */
export const failureAreas: readonly {
  path: RegExp;
  /** What a read loads, after "Couldn’t load": "your workbooks". */
  load: string;
  /** What a change does, after "Couldn’t": "make the workbook". */
  change: string;
}[] = [
  {
    path: /^\/billing\/(prices|offer)/,
    load: "the plans",
    change: "choose that plan",
  },
  {
    path: /^\/billing\/status\//,
    load: "this learner’s plan",
    change: "check the plan",
  },
  { path: /^\/billing\/checkout/, load: "checkout", change: "open checkout" },
  { path: /^\/billing\//, load: "billing", change: "save the billing change" },
  {
    path: /^\/family\/second-parent/,
    load: "the invitation",
    change: "send the invitation",
  },
  {
    path: /^\/family\/approvals/,
    load: "the approval",
    change: "save the approval",
  },
  {
    path: /^\/family\/learners\/[^/]+\/birth-year/,
    load: "the family details",
    change: "save the birth year",
  },
  {
    path: /^\/family\//,
    load: "the family details",
    change: "save the family change",
  },
  {
    path: /^\/me\/profiles/,
    load: "the practice profiles",
    change: "save the profile change",
  },
  {
    path: /^\/me\/practice\/birth-year/,
    load: "your practice",
    change: "save the change to your start",
  },
  {
    path: /^\/me\/practice/,
    load: "your practice",
    change: "start your practice",
  },
  {
    path: /^\/me(\/|$)/,
    load: "your account",
    change: "save the account change",
  },
  { path: /^\/start/, load: "the setup", change: "finish getting started" },
  {
    path: /^\/school\//,
    load: "the school details",
    change: "save the school change",
  },
  {
    path: /^\/learners\/[^/]+\/workbooks\/[^/]+\/results/,
    load: "the workbook’s results",
    change: "save the results",
  },
  {
    path: /^\/learners\/[^/]+\/workbooks/,
    load: "the workbooks",
    change: "make the workbook",
  },
  {
    path: /^\/learners\//,
    load: "this learner",
    change: "save the learner change",
  },
  {
    path: /^\/(problems|practice|attempts|batches)/,
    load: "the next problem",
    change: "send your answer",
  },
  { path: /^\/access/, load: "your access", change: "activate your access" },
  {
    path: /^\/(funding|invoices)/,
    load: "the funding request",
    change: "send the funding request",
  },
];
/** The message for a failure the server gave no known code for: what
 * failed, then what to do. */
export function failureMessage(path: string, method: string, status: number) {
  const area = failureAreas.find(({ path: pattern }) => pattern.test(path));
  const failed =
    method === "GET"
      ? `Couldn’t load ${area?.load ?? "this page"}.`
      : `Couldn’t ${area?.change ?? "make that change"}.`;
  if (status >= 500) return `${failed} Try again in a moment.`;
  return method === "GET"
    ? `${failed} Try again.`
    : `${failed} Check what you entered, then try again.`;
}
const errorCode = (data: unknown) =>
  data &&
  typeof data === "object" &&
  "error" in data &&
  typeof data.error === "string"
    ? data.error
    : "";
export function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  return requestWith(() => send(path, schema, options), options);
}

async function send<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions,
): Promise<T> {
  const method = requestMethod(options);
  // A student's token opens only the student routes. When a device is handed
  // to a child ("Let Wren practice here"), the staff screen still mounted
  // reads again with the child's session for a moment before practice
  // replaces it: those reads would only be refused (and logged as a session
  // that ended), so they wait for that screen to go instead.
  if (
    method === "GET" &&
    options.token?.startsWith("st_") &&
    path.startsWith("/school/") &&
    !/^\/school\/(student|join)\//.test(path)
  )
    return new Promise<T>((_, reject) =>
      options.signal?.addEventListener(
        "abort",
        () => reject(options.signal!.reason),
        { once: true },
      ),
    );
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
  // A session that ended while this was on its way: its answer, success or
  // failure, is nobody's now. Checked before any handler (a 401's sign-out
  // included) can act on it in the session on screen.
  const checkSession = () => {
    if (isRetired(options.token)) {
      observe("cancelled");
      throw replacedSession();
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
    checkSession();
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
  checkSession();
  checkAborted();
  // A tab running an older release than the API: a missing route or a
  // rejected sign-in reloads into the current release rather than reporting a
  // failure the visitor didn't cause. Other errors still show, so a filled-in
  // form is never wiped by a reload.
  if (response.status === 401 || response.status === 404) {
    const stale = await buildIsStale();
    // The release lookup is another async boundary: this request's session
    // may have ended while it waited, even though its API response arrived.
    checkSession();
    checkAborted();
    if (stale) {
      const reloading = reloadIntoCurrentRelease();
      if (reloading) return reloading;
    }
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
      response.status < 500 ? data : null,
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
  checkSession();
  checkAborted();
  observe("succeeded");
  return parsed.data;
}
