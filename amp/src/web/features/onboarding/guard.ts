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

export type StartTarget = StartStep | "/sign-in" | "/purchase" | "/practice";
const learnerSteps: readonly string[] = ["/start/name", "/start/birth-year"];

/**
 * The single first-run guard, used by route `beforeLoad` and by the mounted
 * screen when `/me` changes. Returns where to go instead, or null to stay.
 *
 * Order: verify email → plan → secure payment (the verified parental consent)
 * → learner name → birth year → practice. No learner details are collected
 * before consent, so the learner steps open only once `next` says so.
 */
export function startDestination(me: Me, pathname: string): StartTarget | null {
  if (!me.signedIn) return "/sign-in";
  const stay = (allowed: readonly string[], fallback: StartTarget) =>
    allowed.includes(pathname) ? null : fallback;
  switch (me.next) {
    case "verify-email":
      return stay(["/start/verify-email"], "/start/verify-email");
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
  return target === "/purchase" || target === "/practice"
    ? ({ to: "/$", params: { _splat: target.slice(1) } } as const)
    : ({ to: target } as const);
}
