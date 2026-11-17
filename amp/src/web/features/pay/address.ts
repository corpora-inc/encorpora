import type { SignedInMe } from "../../../account/contracts";
import { childFamily } from "../spaces/learner-urls";

/*
 * Where paying lives (docs/architecture/web-app.md, "Pay"): an overlay
 * nested under the screen it was opened from, which stays behind it.
 *
 *   /family/<family>/kids/<learner>/pay           over the child's page
 *   /family/<family>/pay/<learner>                over the family's Today
 *   /account/billing/pay/<learner>                over Billing
 *
 * and under each base, `/done` (back from Stripe) and `/invoice/<invoice>`
 * (the invoice made). Closing goes to the origin: exactly the screen behind.
 * Nothing else rides in the address: the tab, the plan, the program and the
 * education-funds step live in the pay store (store.ts).
 */

export type PayView =
  | { kind: "choose" }
  | { kind: "done" }
  | { kind: "invoice"; invoiceId: string };

export type PayAddress = {
  /** The screen behind the overlay, where closing goes. */
  origin: string;
  /** The overlay's own address: `<origin>/pay[/<learner>]`. */
  base: string;
  learnerId: string;
  view: PayView;
};

const CHILD_PAGE = /^\/family\/([^/]+)\/kids\/([^/]+)$/;

/** What a pay overlay's address says, or null if it isn't one. */
export function payAddress(pathname: string): PayAddress | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const match = /^(.*?)\/pay(\/.*)?$/.exec(path);
  if (!match) return null;
  const origin = match[1] || "/";
  const rest = (match[2] ?? "").split("/").filter(Boolean);
  const child = CHILD_PAGE.exec(origin);
  let learnerId = child ? decodeURIComponent(child[2]!) : undefined;
  let base = `${origin}/pay`;
  if (!child) {
    const named = rest.shift();
    if (!named) return null;
    learnerId = decodeURIComponent(named);
    base = `${origin}/pay/${named}`;
  }
  const [step, id] = rest;
  const view: PayView =
    step === "done"
      ? { kind: "done" }
      : step === "invoice" && id
        ? { kind: "invoice", invoiceId: decodeURIComponent(id) }
        : { kind: "choose" };
  return { origin, base, learnerId: learnerId!, view };
}

/** The overlay over `origin` for a learner: on their own page, its `/pay`;
 * anywhere else, `/pay/<learner>`. */
export function payOver(origin: string, learnerId: string) {
  const child = CHILD_PAGE.exec(origin);
  return child && decodeURIComponent(child[2]!) === learnerId
    ? `${origin}/pay`
    : `${origin.replace(/\/$/, "")}/pay/${encodeURIComponent(learnerId)}`;
}

/** A learner's own place, where paying opens when nothing else names one
 * (an older link, Stripe's return in another tab): a child's page in their
 * family; the adult's (or a practice profile's) Billing. */
export function learnerOrigin(me: SignedInMe, learnerId: string) {
  const learner = me.family.learners.find((entry) => entry.id === learnerId);
  const family =
    learner && !learner.adult && !learner.simulation
      ? childFamily(me, learnerId)
      : null;
  return family
    ? `/family/${family}/kids/${encodeURIComponent(learnerId)}`
    : "/account/billing";
}

/** The screens a pay overlay opens over (app/family-routes.tsx, router.tsx):
 * the family's Today, a child's page, Billing. */
const HOSTS = [
  /^\/family\/[^/]+$/,
  /^\/family\/[^/]+\/kids\/[^/]+$/,
  /^\/account\/billing$/,
];
export const isPayHost = (pathname: string) =>
  HOSTS.some((host) => host.test(pathname.replace(/\/+$/, "")));
