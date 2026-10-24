import {
  fundedPrograms,
  type FundedPath,
  type FundedProgramSlug,
} from "../../lib/funded-entry";
import type { Me } from "../../../account/contracts";

/** Every first-run step. The server's `me.next` alone decides which may open. */
export const startSteps = [
  "/start/verify-email",
  "/start/plan",
  "/start/purchase",
  "/start/consent",
  "/start/name",
  "/start/birth-year",
] as const;
export type StartStep = (typeof startSteps)[number];

export type StartTarget =
  | StartStep
  | "/access"
  | "/sign-in"
  | "/purchase"
  | FundedPath
  | "/practice"
  | "/try";
const learnerSteps: readonly string[] = ["/start/name", "/start/birth-year"];

/** Steps that record consent or take payment; they need a confirmed address. */
const consentSteps: readonly string[] = [
  "/start/plan",
  "/start/purchase",
  "/start/consent",
];

/**
 * The single first-run guard, used by route `beforeLoad` and by the mounted
 * screen when `/me` changes. Returns where to go instead, or null to stay.
 *
 * Order: free trial → plan → secure payment (the verified parental consent)
 * → learner name → birth year → practice. No learner details are collected
 * before consent, so the learner steps open only once `next` says so. A
 * parent whose address is unconfirmed confirms it on the way into the plan:
 * nothing before that waits for it. `buying` is a plan chosen on the paywall
 * before sign-up.
 */
export function startDestination(
  me: Me,
  pathname: string,
  buying = false,
  funded: boolean | FundedProgramSlug = false,
): StartTarget | null {
  if (!me.signedIn) return "/sign-in";
  if (funded) {
    if (me.account.confirmationRequired)
      return pathname === "/start/verify-email" ? null : "/start/verify-email";
    if (me.consent.status !== "active")
      return pathname === "/start/consent" ? null : "/start/consent";
    if (learnerSteps.includes(pathname)) return null;
    return me.learners.length
      ? fundedPrograms[funded === true ? "arkansas-efa" : funded].path
      : "/start/name";
  }
  const confirm =
    !!me.account.confirmationRequired &&
    (me.next === "try" || me.next === "choose-plan");
  if (pathname === "/start/verify-email") {
    if (confirm) return null;
    // Confirmed: continue to the plan the parent was opening.
    return route(me, "/start/plan", buying) ?? "/start/plan";
  }
  const target = route(me, pathname, buying);
  return confirm && consentSteps.includes(target ?? pathname)
    ? "/start/verify-email"
    : target;
}

function route(
  me: Extract<Me, { signedIn: true }>,
  pathname: string,
  buying: boolean,
): StartTarget | null {
  const stay = (allowed: readonly string[], fallback: StartTarget) =>
    allowed.includes(pathname) ? null : fallback;
  switch (me.next) {
    case "accept-gift":
      if (me.account.confirmationRequired)
        return pathname === "/start/verify-email"
          ? null
          : "/start/verify-email";
      if (me.consent.status !== "active")
        return pathname === "/start/consent" ? null : "/access";
      if (pathname === "/start/consent") return "/start/name";
      return stay(learnerSteps, "/access");
    case "try":
      // The plan opens when the parent chooses to buy; otherwise practice free.
      return stay(
        ["/start/plan", "/start/purchase", "/start/consent"],
        buying ? "/start/plan" : "/try",
      );
    case "choose-plan":
      // With consent already recorded (for example through email-plus), the
      // purchase is for an existing learner: per-learner checkout in billing.
      return me.consent.status === "active"
        ? stay(learnerSteps, "/purchase")
        : stay(
            ["/start/plan", "/start/purchase", "/start/consent"],
            "/start/plan",
          );
    case "add-learner":
      return stay([...learnerSteps, "/start/purchase"], "/start/name");
    case "practice":
      return stay(learnerSteps, "/practice");
  }
}

/** Router navigation options for a guard target (app screens use the splat route). */
export function startNavigation(target: StartTarget) {
  if (target === "/try") return { to: "/try" } as const;
  return target === "/purchase" || target === "/practice"
    ? ({ to: "/$", params: { _splat: target.slice(1) } } as const)
    : ({ to: target } as const);
}
