import { redirect } from "@tanstack/react-router";
import { currentInAppBrowser } from "../../analytics/browser-kind";
import { z } from "zod";
import { create } from "zustand";
import { signupEntrySchema } from "../../parent-followup/contracts";
import { useAuthDraft } from "../features/auth/draft";
import { carriesArrival, gateContinuation } from "../lib/funded-entry";
import { authStep } from "./auth-links";
import type { AuthSession } from "../auth";
import {
  clearPurchaseReturn,
  parsePurchaseReturn,
  purchaseReturnSlot,
  type PurchaseReturn,
} from "../purchase-return";
import { queryClient, sessionOptions } from "../lib/query";
import { keepArrival, keepSignUpIntent } from "../lib/program-choice";
import { requireSignedIn, returnSearchShape, toOwnPlace } from "./sign-in-gate";

/*
 * Third-party returns (amp/AGENTS.md, "Frontend architecture"): the one
 * exception to "no query strings carry app state" is a value a provider puts
 * on its return address. Each is read here, once, resolved, and the person
 * lands on a clean path. Nothing else in the app reads them. This is a
 * sanctioned mechanism (tests/architecture-ratchet.test.ts, SANCTIONED).
 *
 * - Stripe Checkout: `?billing=processing|canceled&purchase=<id>`, the
 *   return address our server gives Stripe (billing/stripe/gateway.ts),
 *   resolved by features/pay/stripe-return.ts. Signed out on its return
 *   (the sign-in ended during Checkout), the return is kept for this tab
 *   (purchase-return.ts's slot, 15 minutes) while the person signs in, and
 *   resumed on the first navigation after (`resumeStripeReturn`): never
 *   lost on a money path.
 * - A sign-in provider (Google, Apple, Clever): `/?signed-in` after a
 *   returning account's sign-in (features/auth/SignInScreen.tsx), and
 *   `/?security` after linking one (AccountSecurity.tsx).
 * - Clever's refusal on `/school/connect`: `?error=<code>`.
 * - A sign-in that failed, back on `/sign-in` or `/sign-up`:
 *   `?error=<code>`, with `&provider=` from a provider's error return
 *   (SignInScreen's `errorCallbackURL`), Clever's and a link's from our
 *   server (`signInReturn`).
 */

type Location = { pathname: string; searchStr: string; search: unknown };

/** What arrives on an address from outside the app, as the root's query
 * schema reads it (app/router.tsx): an ad's or a program page's entry label
 * and program, a mailed link's token, a provider's error, Stripe's return,
 * and the older mail's `/?sign-in`, `/?reset-password` (app/legacy-aliases.ts
 * rows) and a provider's `/?signed-in`. */
export const inboundSearchShape = {
  entry: signupEntrySchema.optional().catch(undefined),
  program: z.enum(["ar-efa", "az-esa", "nh-efa"]).optional().catch(undefined),
  token: z.string().max(2048).optional(),
  error: z.string().max(200).optional(),
  purchase: z.string().max(200).optional(),
  billing: z.string().max(40).optional(),
  "sign-in": z.string().optional(),
  "signed-in": z.string().optional(),
  method: z.enum(["password"]).optional().catch(undefined),
  "reset-password": z.string().optional(),
};

/**
 * The root route's query (spread into its options, app/router.tsx): what
 * arrives from outside, and the sign-in gate's way back. Nothing a screen
 * chose rides in the query; other keys pass through unread. An ad's or a
 * funding page's program and campaign labels are kept for the tab on
 * arrival (lib/program-choice.ts `keepArrival`, `keepInbound`) and never
 * carried from address to address.
 */
const rootSearchSchema = z
  .object({ ...returnSearchShape, ...inboundSearchShape })
  .passthrough();
export const inboundSearch = {
  validateSearch: (search: Record<string, unknown>) =>
    rootSearchSchema.parse(search),
};

/** An arrival's program and campaign labels, kept for the tab (the root's
 * `beforeLoad`, on every navigation that isn't a preload: an address that
 * names none keeps what was kept). */
export function keepInbound(search: unknown) {
  keepArrival((search ?? {}) as Record<string, unknown>);
}

/** Why a return landed where it did, for that screen to say inline: a
 * learner checkout the server couldn't match to this account opens Billing,
 * which says so (features/account, the billing overlay). Kept per account
 * for this tab, until the screen clears it. */
export type ReturnNotice = "purchase-unmatched";
export const useReturnNotices = create<{
  accounts: Record<string, ReturnNotice | undefined>;
  set: (account: string, notice: ReturnNotice | undefined) => void;
}>()((set) => ({
  accounts: {},
  set: (account, notice) =>
    set((state) => ({ accounts: { ...state.accounts, [account]: notice } })),
}));

/** Stripe's return values on an address, if it carries them. */
function stripeValues(searchStr: string): PurchaseReturn | null {
  const query = new URLSearchParams(searchStr);
  if (!query.has("billing")) return null;
  const state = query.get("billing");
  return parsePurchaseReturn({
    state,
    ...(state === "account" ? {} : { purchaseId: query.get("purchase") }),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
}

/** Where a Stripe return lands: that learner's confirmation, or (a learner
 * return this account can't place, the billing portal's return) Billing at
 * the account's own settings hub (a family's Settings), saying so. */
async function resolveStripe(
  session: AuthSession,
  values: PurchaseReturn,
  kind: "learner" | "enrollment",
  fallback: "billing" | undefined,
): Promise<string | undefined> {
  const { stripeReturnTarget, billingHub } =
    await import("../features/pay/stripe-return");
  const href = await stripeReturnTarget(
    session,
    {
      billing: values.state,
      ...(values.purchaseId ? { purchase: values.purchaseId } : {}),
    },
    kind,
  );
  if (href) return href;
  if (kind === "learner" && values.purchaseId)
    useReturnNotices.getState().set(session.accountId, "purchase-unmatched");
  return fallback ? billingHub(session) : undefined;
}

/** Stripe's return to a learner's checkout (at `/`) or a parent's
 * enrollment (at `/start/purchase`): that learner's confirmation, in one
 * hop. Nothing when the address carries no return, or an enrollment this
 * tab didn't open (the screen's own then). */
export async function stripeReturn(
  location: Location,
  kind: "learner" | "enrollment",
  session: AuthSession | null,
  fallback?: "billing",
) {
  const values = stripeValues(location.searchStr);
  if (!values) return;
  if (!session) {
    // Signed out on a learner's return: kept for this tab, resumed once
    // signed in. (An enrollment's step signs in by its own guard and
    // carries on with the first run.)
    if (kind !== "learner") return;
    try {
      sessionStorage.setItem(purchaseReturnSlot, JSON.stringify(values));
    } catch (error) {
      console.error("Stripe's return couldn't be kept across sign-in", error);
    }
    await requireSignedIn(location);
    return;
  }
  const href = await resolveStripe(session, values, kind, fallback);
  if (href) throw redirect({ href, replace: true });
}

/** A Stripe return kept across a sign-in (`stripeReturn`): on the first
 * navigation signed in, resolved once, in one hop (app/router.tsx, the
 * root's `beforeLoad`). */
export async function resumeStripeReturn() {
  let kept: PurchaseReturn | null = null;
  try {
    const raw = sessionStorage.getItem(purchaseReturnSlot);
    if (!raw) return;
    kept = raw.length <= 256 ? parsePurchaseReturn(JSON.parse(raw)) : null;
  } catch (error) {
    console.warn("A kept Stripe return couldn't be read", error);
  }
  if (!kept) return clearPurchaseReturn();
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) return;
  clearPurchaseReturn();
  const href = await resolveStripe(session, kept, "learner", "billing");
  throw redirect({ href: href ?? "/account/billing", replace: true });
}

/** A provider's return to `/`: the account's place after a sign-in, Sign-in
 * & security after linking one, a checkout's confirmation after Stripe. */
export async function homeReturn(location: Location) {
  const search = (location.search ?? {}) as Record<string, unknown>;
  const session = await queryClient.ensureQueryData(sessionOptions);
  await stripeReturn(location, "learner", session, "billing");
  if (!session) return;
  if ("signed-in" in search) {
    // A provider's sign-in: a sign-up intent kept from before its redirect
    // is recorded now (features/auth/signup-intent.ts), never waited on, and
    // why this tab signed up has served.
    keepSignUpIntent(null);
    void import("../features/auth/signup-intent")
      .then(({ recordPendingIntent }) => recordPendingIntent())
      .catch((error: unknown) =>
        console.error("The sign-up intent's retry didn't load", error),
      );
    await toOwnPlace();
  }
  if ("security" in search)
    throw redirect({ href: "/account/security", replace: true });
}

/** A sign-in's failure back on `/sign-in` or `/sign-up`: kept for the
 * screen to show once (features/auth/draft.ts), then one hop to the same
 * screen's clean address with the gate's own continuation, so a refresh or
 * Back never shows it again. */
export function signInReturn(location: AuthLocation) {
  const { error, provider } = (location.search ?? {}) as Record<
    string,
    unknown
  >;
  if (typeof error !== "string" || !error) return;
  useAuthDraft.getState().arrive({
    error: error.slice(0, 200),
    ...(typeof provider === "string" ? { provider } : {}),
  });
  cleanAuthAddress(location);
}

/** An older sign-up link's or another browser's arrival on a signed-out
 * `/sign-in` or `/sign-up` (`?entry=pitch-try&return=free-practice`, an
 * ad's labels: the legacy form, read into the tab by the root's
 * `keepInbound`): one hop to the clean address. Signed in, the route's own
 * hop to the account's place goes first, so it is never a chain. */
export function arrivalReturn(location: AuthLocation) {
  // In an app's own browser the address keeps it: that address is what the
  // app's "Open in browser" opens, and the phone's browser starts with empty
  // storage (features/auth/OpenInBrowser.tsx writes it there when the
  // one-tap jump didn't leave).
  if (currentInAppBrowser()) return;
  if (carriesArrival((location.search ?? {}) as Record<string, unknown>))
    cleanAuthAddress(location);
}

type AuthLocation = Location & { hash?: string };

/** The same auth screen with the gate's continuation only (and its
 * fragment: a handed-off Google start), replacing this address. */
function cleanAuthAddress(location: AuthLocation): never {
  const { method, ...rest } = (location.search ?? {}) as Record<
    string,
    unknown
  >;
  throw redirect({
    ...authStep(location.pathname === "/sign-up" ? "sign-up" : "sign-in", {
      ...gateContinuation(rest),
      ...(method === "password" ? { method } : {}),
    }),
    ...(location.hash ? { hash: location.hash } : {}),
    replace: true,
  } as never);
}

/** A sign-in failure waiting to be shown: the sign-in screen stays, even
 * for someone signed in (security, a link that failed). */
export const signInArrivalPending = () => !!useAuthDraft.getState().arrival;

/** Clever's refusal on `/school/connect`, the one search that screen reads
 * (spread into its route's options). */
const CLEVER_ERRORS = ["clever_identity_already_linked", "clever_link_expired"];
export const cleverReturn = {
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    CLEVER_ERRORS.includes(String(search.error))
      ? { error: String(search.error) }
      : {},
};
