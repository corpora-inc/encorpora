import { redirect } from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import { hasPurchaseReturn } from "../purchase-return";
import { queryClient, sessionOptions } from "../lib/query";
import { toOwnPlace } from "./sign-in-gate";

/*
 * Third-party returns (amp/AGENTS.md, "Frontend architecture"): the one
 * exception to "no query strings carry app state" is a value a provider puts
 * on its return address. Each is read here, once, resolved, and the person
 * lands on a clean path. Nothing else in the app reads them. This is a
 * sanctioned mechanism (tests/architecture-ratchet.test.ts, SANCTIONED).
 *
 * - Stripe Checkout: `?billing=processing|canceled&purchase=<id>`, the
 *   return address our server gives Stripe (billing/stripe/gateway.ts),
 *   resolved by features/pay/stripe-return.ts.
 * - A sign-in provider (Google, Apple, Clever): `/?signed-in` after a
 *   returning account's sign-in (features/auth/SignInScreen.tsx), and
 *   `/?security` after linking one (AccountSecurity.tsx).
 * - Clever's refusal on `/school/connect`: `?error=<code>`.
 */

type Location = { pathname: string; searchStr: string; search: unknown };

/** Stripe's return to a learner's checkout (at `/`) or a parent's
 * enrollment (at `/start/purchase`): that learner's confirmation, in one
 * hop. Nothing when the address carries no return, or one this account
 * can't place (the screen's own then). */
export async function stripeReturn(
  location: Location,
  kind: "learner" | "enrollment",
  session: AuthSession | null,
  fallback?: string,
) {
  if (!session || !hasPurchaseReturn(location.searchStr)) return;
  const { stripeReturnTarget } = await import("../features/pay/stripe-return");
  const href =
    (await stripeReturnTarget(
      session,
      location.search as Record<string, unknown>,
      kind,
    )) ?? fallback;
  if (href) throw redirect({ href, replace: true });
}

/** A provider's return to `/`: the account's place after a sign-in, Sign-in
 * & security after linking one, a checkout's confirmation after Stripe. */
export async function homeReturn(location: Location) {
  const search = (location.search ?? {}) as Record<string, unknown>;
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) return;
  if ("signed-in" in search) await toOwnPlace();
  await stripeReturn(location, "learner", session, "/account/billing");
  if ("security" in search)
    throw redirect({ href: "/account/security", replace: true });
}

/** Clever's refusal on `/school/connect`, the one search that screen reads
 * (spread into its route's options). */
const CLEVER_ERRORS = ["clever_identity_already_linked", "clever_link_expired"];
export const cleverReturn = {
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    CLEVER_ERRORS.includes(String(search.error))
      ? { error: String(search.error) }
      : {},
};
