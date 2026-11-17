import {
  fundedPrograms,
  type FundedPath,
  type FundedProgramSlug,
} from "../../lib/funded-entry";
import type { Me, SignedInMe } from "../../../account/contracts";
import { appReturn } from "../spaces/returns";
import { isSetupKind, RETIRED_STEPS, SETUP_STEPS } from "./setup/steps";

/** "What brings you to AMP?" (`/start`) and each of its answers, one URL
 * each. Any signed-in adult may open it to add a place. */
export const starterChoices = [
  "myself",
  "parent",
  "tutor",
  "teacher",
  "school",
] as const;
export type StarterChoice = (typeof starterChoices)[number];
export const isStarterChoice = (value: unknown): value is StarterChoice =>
  starterChoices.includes(value as StarterChoice);
export function isStarterPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/start") return true;
  const choice = /^\/start\/([^/]+)$/.exec(path)?.[1];
  // A parent's or a tutor's setup steps are the starter's too.
  if (/^\/start\/(parent|tutor)\/[a-z-]+$/.test(path)) return true;
  return isStarterChoice(choice);
}

/** The account's first run (`me.setup`, owned by the server). A provider
 * that doesn't send it (native, offline) gets the server's own rule for an
 * account with no first-run record: done once it has a place. */
export function setupOf(me: SignedInMe): Setup {
  return me.setup ?? { persona: null, done: me.next !== "start" };
}
type Setup = NonNullable<SignedInMe["setup"]>;

/** "Add a place" once the first run is done and there is a place: until
 * then `/start` is the account's own question, every answer offered and the
 * one given marked, however much of its setup is already saved. */
export function addingPlace(me: SignedInMe | null) {
  return !!me && setupOf(me).done && placesFor(me).length > 0;
}

/** The answer already given, shown as the current one; none while adding a
 * place. */
export function currentChoice(me: SignedInMe | null): StarterChoice | null {
  if (!me || addingPlace(me)) return null;
  return setupOf(me).persona;
}

export type FirstRunTarget = { to: string };

/**
 * The one first-run router for `/start` and its steps, used by their route
 * guard. The URL is the step; `me.setup` is the progress; the kids are what
 * `/me` says. Returns where to go instead, or null to stay. It never sends
 * anyone out of setup because a family now exists.
 *
 * - `/start/<unknown>` is the question; `/start/teacher` is classroom setup.
 * - `/start/<parent|tutor>/<step>`: a retired step opens its successor, an
 *   unknown one the first step; a later step needs what the first saves
 *   (a parent's kids, a tutor's class).
 * - `/start?return=free-practice` (an old trial link) resumes an account
 *   whose first run is done at `/`.
 *
 * Each is one hop, to an address that needs no further routing. Nothing
 * rides along in a query string: the path names the step, and `me` the rest.
 */
export function routeFor(
  me: SignedInMe | null,
  location: { pathname: string; search: Record<string, unknown> },
): FirstRunTarget | null {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const [, , choice, step, ...rest] = path.split("/");
  if (path === "/start")
    return location.search.return === "free-practice" &&
      !appReturn(location.search.from) &&
      me &&
      setupOf(me).done
      ? { to: "/" }
      : null;
  if (!path.startsWith("/start/")) return null;
  if (!isStarterChoice(choice) || rest.length) return { to: "/start" };
  if (choice === "teacher") return { to: "/school/start" };
  if (step === undefined) return null;
  if (!isSetupKind(choice)) return { to: `/start/${choice}` };
  const at = (id: string) => ({
    to: id ? `/start/${choice}/${id}` : `/start/${choice}`,
  });
  const retired = RETIRED_STEPS[choice][step];
  if (retired !== undefined) return at(retired);
  const ids: readonly string[] = SETUP_STEPS[choice].map((entry) => entry.id);
  if (!ids.includes(step) || step === "") return at("");
  // A later step needs what the first one saves.
  if (
    me &&
    (!me.familyClass || (choice === "parent" && me.learners.length === 0))
  )
    return at("");
  return null;
}

/** The steps that remain around the starter: Stripe's enrollment return; the
 * plan a parent approving another family's child pays for first; the learner
 * steps of funded programs, gifts and a paid purchase that no learner holds
 * yet; the email confirmation that binds a gift or a funded invoice to the
 * address it was made out to; and renewed consent after a withdrawal. */
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
  | "/start"
  | "/"
  | "/access"
  | "/sign-in"
  | FundedPath
  | `/family/approvals/${string}`;
const learnerSteps: readonly string[] = ["/start/name", "/start/birth-year"];

/**
 * The single first-run guard, used by route `beforeLoad` and by the mounted
 * screen when `/me` changes. Returns where to go instead, or null to stay.
 *
 * A new account answers one question at `/start` (the server's `next` is
 * "start" while the account has no place). The starter itself is open to
 * every signed-in adult, to add a place. Stripe's enrollment return always
 * stays. Funded programs, gifts and a paid purchase without a learner keep
 * their learner steps; anyone else who opens one of those steps goes where
 * `next` says.
 *
 * No consent step stands before learning. A learner 13 or older is outside
 * COPPA (16 CFR 312.2), and a child who may be under 13 learns, paid, gifted
 * or funded, on the restricted internal-operations basis (16 CFR
 * 312.5(c)(7)). Consent is asked only where a parent collects more (a
 * family-class approval) or after the parent withdrew it (312.6(a)(2)).
 */
export function startDestination(
  me: Me,
  pathname: string,
  _buying = false,
  funded: boolean | FundedProgramSlug = false,
): StartTarget | null {
  if (!me.signedIn) return "/sign-in";
  if (funded) {
    const program = fundedPrograms[funded === true ? "arkansas-efa" : funded];
    // A funded invoice is made out to an email; its paid access goes only to
    // an account that has confirmed that address. The invoice page asks for
    // it in place, when an invoice is to be connected; never up front.
    if (pathname === "/start/verify-email")
      return me.account.confirmationRequired ? null : program.path;
    // The parent withdrew consent: adding a child under 13 resumes
    // collection they refused, so it needs their renewed consent
    // (16 CFR 312.6(a)(2)). Nobody else ever sees this step.
    const withdrawn = me.consent.status === "withdrawn";
    if (pathname === "/start/consent") return withdrawn ? null : program.path;
    if (learnerSteps.includes(pathname))
      return withdrawn ? "/start/consent" : null;
    return program.path;
  }
  if (isStarterPath(pathname)) return null;
  if (pathname === "/start/purchase") return null;
  // An invoice or gift page sends an unconfirmed account here to bind it to
  // its address: the page opens for anyone with an address to confirm.
  if (pathname === "/start/verify-email" && me.account.confirmationRequired)
    return null;
  // Approving another family's child: the plan comes before any learner of
  // this account, and paying for it is the consent the approval needs.
  if (
    pathname === "/start/plan" &&
    me.familyApproval &&
    me.consent.status !== "active"
  )
    return null;
  return route(me, pathname);
}

function route(
  me: Extract<Me, { signedIn: true }>,
  pathname: string,
): StartTarget | null {
  const stay = (allowed: readonly string[], fallback: StartTarget) =>
    allowed.includes(pathname) ? null : fallback;
  // A parent who opened another family's approval link approves that child,
  // rather than starting a place of their own (docs/families.md, step 5).
  if (
    me.familyApproval &&
    (me.next === "add-learner" ||
      me.next === "start" ||
      (me.next === "practice" && me.consent.status === "active"))
  )
    return `/family/approvals/${me.familyApproval.id}`;
  switch (me.next) {
    case "accept-gift":
      // A gift is found by its recipient's address, so taking it needs that
      // address confirmed: the binding, not consent.
      if (me.account.confirmationRequired)
        return pathname === "/start/verify-email"
          ? null
          : "/start/verify-email";
      return stay(learnerSteps, "/access");
    case "add-learner":
      // Paid before any learner held it: choose or add who it is for.
      return stay(learnerSteps, "/start/name");
    case "start":
      return "/start";
    case "practice":
      return pathname === "/" ? null : "/";
  }
}

/** Router navigation options for a guard target (app screens use the splat route). */
const isApproval = (
  target: StartTarget,
): target is `/family/approvals/${string}` =>
  target.startsWith("/family/approvals/");
export function startNavigation(target: StartTarget) {
  if (isApproval(target))
    return {
      to: "/family/approvals/$approvalId",
      params: { approvalId: target.slice("/family/approvals/".length) },
    } as const;
  return { to: target } as const;
}

/** One place a person works: their family and practice side, their own
 * practice, or a school. */
export type PlaceId = "home" | "me" | `school:${string}`;

/** A family or practice side to open: learners, the family's class (a
 * tutor's, before any child of their own), or consent, a purchase or a gift
 * on its way to a learner. One account can be a parent and work at schools,
 * all at once. */
export function hasHome(me: SignedInMe) {
  return (
    me.learners.length > 0 ||
    !!me.familyClass ||
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
 * setup keeps its own URL. A parent’s personal practice returns to their
 * family home; standalone adult learners return to their own record.
 */
export function homePlace(
  me: SignedInMe,
  remembered: string | null,
): PlaceId | "schools" {
  const schools = me.staffOf ?? [];
  const home = hasHome(me);
  const own = !!me.adultPractice?.learner;
  if (remembered === "me" && own && !home) return "me";
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
  "/overview",
  "/practice",
  "/progress",
  "/lessons",
  "/books",
  "/pathways",
  "/inventory",
];
const HOME_PATHS = [
  "/overview",
  "/practice",
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
