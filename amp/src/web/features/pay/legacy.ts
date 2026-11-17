import type { AuthSession } from "../../auth";
import { queryClient } from "../../lib/query";
import { fundingOffersOptions, offerInterval } from "./api";
import { usePayStore, type LearnerChoice } from "./store";

/* What the older pay addresses' one hop needs (app/pay-routes.tsx), loaded
   only when one is opened. */
export { legacyPayTarget } from "./paths";
export { stripeReturnTarget } from "./stripe-return";

/** Writes what an old address carried into the store for its learner,
 * once; the address is never read again. */
export function carry(
  session: AuthSession,
  learnerId: string | undefined,
  choice: LearnerChoice,
) {
  const given = Object.fromEntries(
    Object.entries(choice).filter(([, value]) => value !== undefined),
  ) as LearnerChoice;
  if (learnerId && Object.keys(given).length)
    usePayStore.getState().choose(session.accountId, learnerId, given);
}

/** An old link's education-funds offer, as the program and plan it is. */
export async function offerChoice(offerId: string) {
  const { offers } = await queryClient
    .ensureQueryData(fundingOffersOptions)
    .catch((error) => {
      console.error("Education-funds offers didn't load", error);
      return { offers: [] };
    });
  const offer = offers.find((entry) => entry.id === offerId);
  return offer
    ? { program: offer.programId, interval: offerInterval(offer) }
    : null;
}
