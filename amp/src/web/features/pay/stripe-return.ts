import type { AuthSession } from "../../auth";
import { purchaseLearner } from "./api";
import { cardDonePath, payPath } from "./paths";
import { payState, usePayStore, type CheckoutKind } from "./store";

/**
 * Stripe Checkout's return address is the one query string the flow can't
 * avoid: the server gives Stripe `?billing=processing|canceled&purchase=<id>`
 * (billing/stripe/gateway.ts). It is read here once, resolved through the
 * server, kept in the pay store, and the parent lands on a clean path: the
 * learner's confirmation, or their plan again after leaving Stripe.
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
  const open = payState(session.accountId).checkout;
  // A learner checkout records its learner; an enrollment checkout names
  // none until it is claimed, so only this tab knows who it was for.
  const recorded =
    kind === "learner" && purchaseId
      ? await purchaseLearner(session, purchaseId).catch((error) => {
          console.error("The checkout's learner wasn't found", error);
          return null;
        })
      : null;
  const learnerId = recorded ?? (open?.kind === kind ? open.learnerId : undefined);
  if (!learnerId) return null;
  if (search.billing === "canceled") {
    // Left Stripe without paying: the plan again, on the card tab.
    usePayStore.getState().choose(session.accountId, learnerId, { method: "card" });
    return payPath(learnerId);
  }
  usePayStore.getState().checkoutReturned(session.accountId, {
    learnerId,
    kind,
    checkoutId: purchaseId ?? "",
  });
  return cardDonePath(learnerId);
}
