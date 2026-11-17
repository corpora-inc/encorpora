import type { SignedInMe } from "../../../account/contracts";

/*
 * The pay flow's addresses (docs/architecture/web-app.md, "Pay"). A path
 * names a screen and the learner (or invoice) it is about; nothing else
 * rides in the address. The method tab, the plan and the program are
 * choices on one screen, kept in the pay store (store.ts).
 *
 *   /pay/<learner>                    choose: Card | Education funds
 *   /pay/<learner>/card/done          back from Stripe: the confirmation
 *   /pay/<learner>/invoice/<invoice>  the invoice: access, PDF, how to submit
 */

export function payPath(learnerId: string) {
  return `/pay/${encodeURIComponent(learnerId)}`;
}
export function cardDonePath(learnerId: string) {
  return `${payPath(learnerId)}/card/done`;
}
export function invoicePath(learnerId: string, invoiceId: string) {
  return `${payPath(learnerId)}/invoice/${encodeURIComponent(invoiceId)}`;
}

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
 * Where an old pay address goes, in one hop (the legacy redirects in
 * app/pay-routes.tsx): the learner it named (or the account's only one),
 * whose choices the hop seeds; with no learner to name, Billing, which
 * lists each learner's "Choose a plan".
 */
export function legacyPayTarget(
  me: SignedInMe,
  learner?: string,
): { href: string; learnerId?: string } {
  const named = learner ? payLearnerFor(me, learner) : undefined;
  const target = named ?? onlyPayableLearner(me);
  return target
    ? { href: payPath(target.id), learnerId: target.id }
    : { href: "/account/billing" };
}
