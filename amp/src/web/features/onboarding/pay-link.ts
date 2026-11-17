import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { fundedProgramForPath } from "../../lib/funded-entry";
import { refreshMe } from "../../lib/query";
import { learnerOrigin, payOver } from "../pay/address";
import { legacyPayTarget } from "../pay/paths";
import { usePayStore, type LearnerChoice } from "../pay/store";

/**
 * Paying for a learner the first run just set up: their pay overlay, over
 * their own place (features/pay/address.ts). What was chosen on the way (a
 * plan on the pitch, a funded program) goes into the pay store, never into
 * the address. `/me` is read fresh, so a learner made a moment ago has
 * their place.
 */
export async function payHref(
  session: AuthSession,
  learnerId: string,
  choice: LearnerChoice,
) {
  const me = await refreshMe(session);
  usePayStore.getState().choose(session.accountId, learnerId, choice);
  return payOver(
    me.signedIn ? learnerOrigin(me, learnerId) : "/account",
    learnerId,
  );
}

/** A first-run target that is a funded program's purchase: the pay
 * overlay of the account's learner on that program's tab (Billing when
 * there are several to choose from). Null for any other target. */
export function fundedPayHref(
  session: AuthSession,
  me: SignedInMe,
  target: string,
) {
  const program = fundedProgramForPath(target);
  if (!program) return null;
  const pay = legacyPayTarget(me);
  if (pay.learnerId)
    usePayStore.getState().choose(session.accountId, pay.learnerId, {
      method: "esa",
      program: program.id,
    });
  return pay.href;
}
