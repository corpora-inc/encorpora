import type { FundedSearch } from "../lib/funded-entry";

/*
 * Auth addresses (amp/AGENTS.md, "Frontend architecture"): the one place an
 * address of the sign-in screens is built with the sign-in's continuation
 * (`FundedSearch`: a campaign's labels, a program, the return, the pitch's
 * entry). The continuation is the sign-in gate's own contract
 * (app/sign-in-gate.ts): it rides along from screen to screen of signing in
 * and comes back out once signed in, and nothing else in the app writes it.
 * Dependency-free so the pitch can link here (no router, query or auth).
 * This is a sanctioned mechanism (tests/architecture-ratchet.test.ts,
 * SANCTIONED).
 */

/** The continuation, plus what a step itself names: the password form on
 * sign-up, a reset link's token, a failure to show on arrival. */
export type AuthSearch = FundedSearch & {
  method?: "password";
  token?: string;
  error?: string;
};

const paths = {
  "sign-in": "/sign-in",
  "sign-up": "/sign-up",
  reset: "/reset-password",
} as const;
type PathStep = keyof typeof paths;
/** The steps at `/sign-in/<step>`. */
type SignInStep = "forgot" | "check-email" | "two-factor";
export type AuthStep = PathStep | SignInStep;

export type AuthTarget<Step extends AuthStep> = Step extends PathStep
  ? { to: (typeof paths)[Step]; search: AuthSearch }
  : { to: "/sign-in/$step"; params: { step: Step }; search: AuthSearch };

/** The address of an auth step, carrying the continuation. */
export function authStep<Step extends AuthStep>(
  step: Step,
  carry: AuthSearch = {},
): AuthTarget<Step> {
  const search = Object.fromEntries(
    Object.entries(carry).filter(([, value]) => value !== undefined),
  ) as AuthSearch;
  return (
    step in paths
      ? { to: paths[step as PathStep], search }
      : { to: "/sign-in/$step", params: { step }, search }
  ) as AuthTarget<Step>;
}
