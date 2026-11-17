import { learnerOrigin, payOver } from "./address";
import type { SignedInMe } from "../../../account/contracts";

/* Who a pay overlay is for, and where an older pay address goes. The
   overlay's own addresses are address.ts's. */

type Learner = SignedInMe["family"]["learners"][number];

/** The account's live learner with this id. */
export function liveLearner(me: SignedInMe, learnerId: string) {
  return me.family.learners.find(
    (entry) => entry.id === learnerId && !entry.deletedAt,
  );
}

/**
 * Who a purchase "for this learner" is really for. A practice profile has
 * no plan of its own (docs/families.md): the family's plan for its first
 * child without access covers the adult and every profile, so that child is
 * who pays; with no children, the adult's own learner. Everyone else is
 * themself. Undefined when the learner isn't this account's.
 */
export function payLearnerFor(
  me: SignedInMe,
  learnerId: string,
): Learner | undefined {
  const learner = liveLearner(me, learnerId);
  if (!learner?.simulation) return learner;
  const live = me.family.learners.filter((entry) => !entry.deletedAt);
  return (
    live.find((entry) => !entry.adult && !entry.simulation && !entry.hasAccess) ??
    live.find((entry) => entry.adult && !entry.simulation) ??
    learner
  );
}

/** The learners a plan can be bought for, as Billing lists them. */
export function payableLearners(me: SignedInMe) {
  const all = me.family.learners.filter(
    (entry) => !entry.deletedAt && !entry.simulation,
  );
  const children = all.filter((entry) => !entry.adult);
  return children.length ? children : all;
}

/** The one learner a link without one means, when there is exactly one. */
export function onlyPayableLearner(me: SignedInMe) {
  const learners = payableLearners(me);
  return learners.length === 1 ? learners[0] : undefined;
}

/** How a learner is named in the flow's subtitle. */
export function forWhom(learner: Pick<Learner, "adult" | "name">) {
  return learner.adult ? "For your own practice" : `For ${learner.name}`;
}
/** The learner's name in a sentence ("August has full access"). */
export function whoName(learner: Pick<Learner, "adult" | "name">) {
  return learner.adult ? "You" : learner.name;
}

/**
 * Where an old pay address goes, in one hop (app/pay-routes.tsx): the pay
 * overlay of the learner it named (or the account's only one), over their
 * own page; with no learner to name, Billing, which lists each learner's
 * "Choose a plan".
 */
export function legacyPayTarget(
  me: SignedInMe,
  learner?: string,
): { href: string; learnerId?: string } {
  const named = learner ? payLearnerFor(me, learner) : undefined;
  const target = named ?? onlyPayableLearner(me);
  return target
    ? { href: payOver(learnerOrigin(me, target.id), target.id), learnerId: target.id }
    : { href: "/account/billing" };
}
