import {
  fundedPrograms,
  type FundedPath,
  type FundedProgramSlug,
} from "../../lib/funded-entry";
import type { Me, SignedInMe } from "../../../account/contracts";

/** Every first-run step. The server's `me.next` alone decides which may open. */
export const startSteps = [
  "/start/verify-email",
  "/start/plan",
  "/start/purchase",
  "/start/consent",
  "/start/name",
  "/start/birth-year",
] as const;
export type StartStep = (typeof startSteps)[number];

export type StartTarget =
  | StartStep
  | "/access"
  | "/sign-in"
  | "/purchase"
  | FundedPath
  | "/practice"
  | "/school"
  | "/try"
  | `/family/approvals/${string}`;
const learnerSteps: readonly string[] = ["/start/name", "/start/birth-year"];

/** Steps that record consent or take payment; they need a confirmed address. */
const consentSteps: readonly string[] = [
  "/start/plan",
  "/start/purchase",
  "/start/consent",
];

/**
 * The single first-run guard, used by route `beforeLoad` and by the mounted
 * screen when `/me` changes. Returns where to go instead, or null to stay.
 *
 * Order: free trial → plan → secure payment (the verified parental consent)
 * → learner name → birth year → practice. No learner details are collected
 * before consent, so the learner steps open only once `next` says so. A
 * parent whose address is unconfirmed confirms it on the way into the plan:
 * nothing before that waits for it. `buying` is a plan chosen on the paywall
 * before sign-up.
 */
export function startDestination(
  me: Me,
  pathname: string,
  buying = false,
  funded: boolean | FundedProgramSlug = false,
): StartTarget | null {
  if (!me.signedIn) return "/sign-in";
  // School staff aren't new parents. Someone with learners, a free assessment
  // under way or a purchase for a family is both, and carries on here.
  if (!funded && !buying && me.staffOf?.length && !hasHome(me))
    return "/school";
  if (funded) {
    if (me.account.confirmationRequired)
      return pathname === "/start/verify-email" ? null : "/start/verify-email";
    if (me.consent.status !== "active")
      return pathname === "/start/consent" ? null : "/start/consent";
    if (learnerSteps.includes(pathname)) return null;
    return me.learners.length
      ? fundedPrograms[funded === true ? "arkansas-efa" : funded].path
      : "/start/name";
  }
  const confirm =
    !!me.account.confirmationRequired &&
    (me.next === "try" || me.next === "choose-plan");
  if (pathname === "/start/verify-email") {
    if (confirm) return null;
    // Confirmed: continue to the plan the parent was opening.
    return route(me, "/start/plan", buying) ?? "/start/plan";
  }
  const target = route(me, pathname, buying);
  return confirm && consentSteps.includes(target ?? pathname)
    ? "/start/verify-email"
    : target;
}

function route(
  me: Extract<Me, { signedIn: true }>,
  pathname: string,
  buying: boolean,
): StartTarget | null {
  const stay = (allowed: readonly string[], fallback: StartTarget) =>
    allowed.includes(pathname) ? null : fallback;
  // A parent who opened another family's approval link approves that child
  // once their consent is in, rather than adding a new one (step 5).
  if (
    me.familyApproval &&
    (me.next === "add-learner" ||
      (me.next === "choose-plan" && me.consent.status === "active"))
  )
    return `/family/approvals/${me.familyApproval.id}`;
  switch (me.next) {
    case "accept-gift":
      if (me.account.confirmationRequired)
        return pathname === "/start/verify-email"
          ? null
          : "/start/verify-email";
      if (me.consent.status !== "active")
        return pathname === "/start/consent" ? null : "/access";
      if (pathname === "/start/consent") return "/start/name";
      return stay(learnerSteps, "/access");
    case "try":
      // The plan opens when the parent chooses to buy; otherwise practice free.
      return stay(
        ["/start/plan", "/start/purchase", "/start/consent"],
        buying ? "/start/plan" : "/try",
      );
    case "choose-plan":
      // With consent already recorded (for example through email-plus), the
      // purchase is for an existing learner: per-learner checkout in billing.
      return me.consent.status === "active"
        ? stay(learnerSteps, "/purchase")
        : stay(
            ["/start/plan", "/start/purchase", "/start/consent"],
            "/start/plan",
          );
    case "add-learner":
      return stay([...learnerSteps, "/start/purchase"], "/start/name");
    case "practice":
      return stay(learnerSteps, "/practice");
  }
}

/** Router navigation options for a guard target (app screens use the splat route). */
const isApproval = (
  target: StartTarget,
): target is `/family/approvals/${string}` =>
  target.startsWith("/family/approvals/");
export function startNavigation(target: StartTarget) {
  if (target === "/try") return { to: "/try" } as const;
  if (isApproval(target))
    return {
      to: "/family/approvals/$approvalId",
      params: { approvalId: target.slice("/family/approvals/".length) },
    } as const;
  if (target === "/school")
    return { to: "/$", params: { _splat: "school" } } as const;
  return target === "/purchase" || target === "/practice"
    ? ({ to: "/$", params: { _splat: target.slice(1) } } as const)
    : ({ to: target } as const);
}

/** One place a person works: their family and practice side, their own
 * practice, or a school. */
export type PlaceId = "home" | "me" | `school:${string}`;

/** A family or practice side to open: learners, a free assessment under way,
 * or consent, a purchase or a gift on its way to a learner. One account can be a
 * parent, have a trial in progress and work at schools, all at once. */
export function hasHome(me: SignedInMe) {
  return (
    me.learners.length > 0 ||
    me.trial === true ||
    me.consent.status === "active" ||
    !!me.unassignedPurchase ||
    !!me.availableAccessGrant
  );
}

/** Where a family's class opens, without the leading slash: Today. */
export const familyClassPath = (family: { orgId: string; classId: string }) =>
  `school/${family.orgId}/classes/${family.classId}/today`;

/** The adult's own practice: they have their own learner, or they qualify to
 * start one (a teacher at a licensed school, or a parent of a child with
 * access). */
export function hasOwnPractice(me: SignedInMe) {
  return !!me.adultPractice?.learner || me.adultPractice?.eligible === true;
}

/** Every place this account can open: its family side, its own practice, then
 * its schools. */
export function placesFor(me: SignedInMe): PlaceId[] {
  return [
    ...(hasHome(me) ? (["home"] as const) : []),
    ...(hasOwnPractice(me) ? (["me"] as const) : []),
    ...[...(me.staffOf ?? [])]
      .sort((a, b) => a.orgName.localeCompare(b.orgName))
      .map((org) => `school:${org.orgId}` as const),
  ];
}

/**
 * Where `/` opens: where this person last worked, if they can still open it;
 * otherwise their family side when they have one, and their school when they
 * work only at schools (`"schools"` to choose between several), then their
 * own practice. A school whose setup this admin hasn't finished never takes
 * `/` from someone with a family side: the switcher is one tap away, and the
 * setup keeps its own URL. Their own practice is remembered only once they
 * have it.
 */
export function homePlace(
  me: SignedInMe,
  remembered: string | null,
): PlaceId | "schools" {
  const schools = me.staffOf ?? [];
  const home = hasHome(me);
  const own = !!me.adultPractice?.learner;
  if (remembered === "me" && own) return "me";
  const last = schools.find((org) => `school:${org.orgId}` === remembered);
  if (last && !(last.setupPending && home)) return `school:${last.orgId}`;
  if (home) return "home";
  if (schools.length)
    return schools.length === 1 ? `school:${schools[0]!.orgId}` : "schools";
  return own ? "me" : "home";
}

/** Learning screens show whichever learner is chosen: the adult's own
 * learner makes them part of the adult's own practice. */
const LEARNING_PATHS = [
  "/practice",
  "/progress",
  "/lessons",
  "/books",
  "/pathways",
  "/inventory",
];
const HOME_PATHS = [
  "/practice",
  "/try",
  "/start",
  "/family",
  "/pathways",
  "/inventory",
  "/learners",
  "/purchase",
  "/access",
  "/profile",
  "/consent",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The place a screen belongs to, so `/` can return there; null for screens
 * that belong to none, such as sign-in and the public pages. `ownLearner` is
 * the adult's own learner when it is the one chosen. */
export function placeOfPath(
  pathname: string,
  search: Record<string, unknown> = {},
  ownLearner: string | null = null,
): PlaceId | null {
  if (pathname === "/me" || pathname.startsWith("/me/")) return "me";
  if (
    ownLearner &&
    (LEARNING_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) ||
      pathname.startsWith(`/learners/${ownLearner}/`))
  )
    return "me";
  const school = /^\/school\/([^/]+)/.exec(pathname)?.[1];
  if (school && UUID.test(school)) return `school:${school.toLowerCase()}`;
  if (
    pathname === "/school/new" &&
    typeof search.org === "string" &&
    UUID.test(search.org)
  )
    return `school:${search.org.toLowerCase()}`;
  if (
    pathname === "/" ||
    HOME_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  )
    return "home";
  return null;
}
