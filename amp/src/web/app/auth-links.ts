import { gateContinuation, type FundedSearch } from "../lib/funded-entry";

/*
 * Auth addresses (amp/AGENTS.md, "Frontend architecture"): the one place an
 * address of the sign-in screens is built with the sign-in's continuation
 * (`FundedSearch`: a campaign's labels, a program, the return, the pitch's
 * entry). The continuation is the sign-in gate's own contract
 * (app/sign-in-gate.ts): it rides along from screen to screen of signing in
 * and comes back out once signed in, and nothing else in the app writes it.
 * No router, query or auth, so the pitch can link here. This is a
 * sanctioned mechanism (tests/architecture-ratchet.test.ts, SANCTIONED):
 * outside it, `authStep` takes no continuation (the ratchet counts one as a
 * query-string handoff). A screen names a way back (`authReturn`), or moves
 * on within signing in, carrying what its own address already carries
 * (`authMove`). Why a visitor signs up is the tab's (lib/program-choice.ts).
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

/** The gate's ways back that a screen sends someone to sign in with. */
export type AuthBack = "access" | "family-approval";

/** Sign in (or up), then come back to `back`. */
export function authReturn<Step extends "sign-in" | "sign-up">(
  step: Step,
  back: AuthBack,
): AuthTarget<Step> {
  return authStep(step, { return: back });
}

/** The next step of signing in: the gate's continuation this address
 * already carries (never the visitor's arrival), and what that step names
 * itself (the password form, a reset link's token). */
export function authMove<Step extends AuthStep>(
  step: Step,
  here: Record<string, unknown>,
  own: Pick<AuthSearch, "method" | "token"> = {},
): AuthTarget<Step> {
  return authStep(step, { ...gateContinuation(here), ...own });
}
