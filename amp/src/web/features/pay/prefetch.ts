import type { AuthSession } from "../../auth";
import { meOptions, queryClient } from "../../lib/query";
import { enrollmentOptions, offerOptions } from "../billing";
import { fundingOffersOptions, purchaseStatusOptions } from "./api";
import { checkoutKind } from "./CardPanel";
import { liveLearner } from "./paths";

/**
 * What the choosing screen shows, asked for before it renders (its route's
 * loader): it opens whole, with its tabs, plans and programs in place, and
 * no wait that later grows into them. A failure here is the screen's own
 * to show, with its Try again, so it is only logged.
 */
export async function prefetchPay(session: AuthSession, learnerId: string) {
  const me = await queryClient.ensureQueryData(meOptions(session));
  if (!me.signedIn) return;
  const learner = liveLearner(me, learnerId);
  const asks: Promise<unknown>[] = [
    queryClient.ensureQueryData(fundingOffersOptions),
    queryClient.ensureQueryData(offerOptions(session)),
  ];
  if (learner && !learner.hasAccess)
    asks.push(
      checkoutKind(me, learner) === "learner"
        ? queryClient.ensureQueryData(purchaseStatusOptions(session, learner.id))
        : queryClient.ensureQueryData(enrollmentOptions(session)),
    );
  for (const result of await Promise.allSettled(asks))
    if (result.status === "rejected")
      console.warn("A pay screen's data didn't load ahead", result.reason);
}
