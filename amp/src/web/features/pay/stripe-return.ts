import type { AuthSession } from "../../auth";
import { purchaseLearner } from "./api";
import { meOptions, queryClient } from "../../lib/query";
import { learnerOrigin, payAddress, payOver } from "./address";
import { loadSettingsHub } from "../spaces/settings-hub";
import { payState, usePayStore, type CheckoutKind } from "./store";

/**
 * Stripe Checkout's return address is the one query string the flow can't
 * avoid: the server gives Stripe `?billing=processing|canceled&purchase=<id>`
 * (billing/stripe/gateway.ts). It is read here once, resolved through the
 * server, kept in the pay store, and the parent lands on a clean path: the
 * pay overlay it was opened from, over the same screen, on its
 * confirmation, or on the plan again after leaving Stripe (its back link or
 * the browser's Back: both land on that same overlay).
 * (Stripe's own `session_id` isn't used: the server's checkout id is.) Null
 * when it names no learner this account can see (another device's
 * enrollment checkout, which names none): the caller's own screen then.
 */
export async function stripeReturnTarget(
  session: AuthSession,
  search: Record<string, unknown>,
  kind: CheckoutKind,
): Promise<string | null> {
  const purchaseId =
    typeof search.purchase === "string" && search.purchase.length <= 200
      ? search.purchase
      : undefined;
  if (!purchaseId && typeof search.billing !== "string") return null;
  // The billing portal's return names no checkout: Billing, by the caller.
  if (search.billing === "account") return null;
  const open = payState(session.accountId).checkout;
  const opened = open?.kind === kind ? open : undefined;
  // A learner checkout records its learner; an enrollment checkout names
  // none until it is claimed, so only this tab knows who it was for.
  const recorded =
    kind === "learner" && purchaseId
      ? await purchaseLearner(session, purchaseId).catch((error) => {
          console.error("The checkout's learner wasn't found", error);
          return null;
        })
      : null;
  const learnerId = recorded ?? opened?.learnerId;
  if (!learnerId) return null;
  // The overlay it was opened from, over the same screen. A practice
  // profile's checkout records the adult's own learner it started: the same
  // screen, for them.
  const from = opened ? payAddress(opened.base) : null;
  const rebased = from ? payOver(from.origin, learnerId) : undefined;
  let base =
    opened && opened.learnerId === learnerId
      ? opened.base
      : // Only where that screen has a pay overlay for them (another
        // child's page has none).
        rebased && payAddress(rebased)?.learnerId === learnerId
        ? rebased
        : undefined;
  if (!base) {
    // Opened in another tab: the learner's own place, a child's page in
    // their family, else the account's settings hub (a family's Settings),
    // never a screen they didn't come from.
    const me = await queryClient.ensureQueryData(meOptions(session));
    if (!me.signedIn) return null;
    const origin = learnerOrigin(me, learnerId);
    const hub =
      origin === "/account"
        ? await loadSettingsHub(session).catch((error: unknown) => {
            console.error("The account's settings hub didn't load", error);
            return origin;
          })
        : origin;
    base = payOver(hub, learnerId);
  }
  if (search.billing === "canceled") {
    // Left Stripe without paying: the plan again, on the card tab.
    usePayStore.getState().choose(session.accountId, learnerId, { method: "card" });
    return base;
  }
  usePayStore.getState().checkoutReturned(session.accountId, {
    learnerId,
    kind,
    checkoutId: purchaseId ?? "",
  });
  return `${base}/done`;
}

/** Billing over the account's settings hub (a family's Settings), where a
 * return this account can't place, and the billing portal's, land. */
export function billingHub(session: AuthSession): Promise<string> {
  return loadSettingsHub(session, "billing").catch((error: unknown) => {
    console.error("The account's settings hub didn't load", error);
    return "/account/billing";
  });
}
