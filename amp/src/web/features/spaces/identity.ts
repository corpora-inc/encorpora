/**
 * Whose learning screen an address names (docs/architecture/spaces.md,
 * "Learning screens"), in one order everywhere: the path's own learner (a
 * family's child, `/family/<family>/kids/<learner>/…`; `/learners/<id>/…`;
 * `/pay/<id>`; `/practice/<id>`, where a path may name one of the adult's
 * practice profiles, which is their learner), then the legacy `?learner=`
 * (an older link; app/legacy-aliases.ts sends it to the canonical address
 * before it shows). Null: the address names nobody. A shared learning
 * screen that names nobody is self's (`selfOf`). Pure, so a loader, the
 * resolver, the learning view and practice all read the same identity from
 * the same address and the same choice.
 */
export type AddressedIdentity = { kind: "learner" | "profile"; id: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH = new RegExp(
  `^/(?:learners|pay|practice|family/${UUID}/kids)/([^/]+)`,
  "i",
);

/** What practice is held to, in its address: a problem type, a skill or an
 * area (strand). None is mixed practice. */
export type PracticeFocus = {
  skill?: string;
  template?: string;
  strand?: string;
};
const FOCUS_SEGMENT = { template: "types", skill: "skills", strand: "areas" };
const FOCUS = /^\/practice\/[^/]+\/(types|skills|areas)\/([^/]+)\/?$/;

/** A learner's practice: `/practice/<learner>`, mixed; held to a problem
 * type, a skill or an area, `/practice/<learner>/types/<id>`, `…/skills/<id>`,
 * `…/areas/<strand>`. Bare `/practice` names nobody and is an older address
 * (one hop: practice-mode.ts). */
export function practicePath(learner: string, focus: PracticeFocus = {}) {
  const at = `/practice/${encodeURIComponent(learner)}`;
  const kind = focus.template
    ? "template"
    : focus.skill
      ? "skill"
      : focus.strand
        ? "strand"
        : null;
  return kind
    ? `${at}/${FOCUS_SEGMENT[kind]}/${encodeURIComponent(focus[kind]!)}`
    : at;
}
/** The `$` route's params for a learner's practice. */
export const practiceParams = (learner: string, focus?: PracticeFocus) => ({
  _splat: practicePath(learner, focus).slice(1),
});
/** What a practice address holds practice to (unchecked: practice checks it
 * against the catalog, features/practice/curriculum-filter.ts). */
export function practiceFocus(pathname: string): PracticeFocus {
  const [, segment, id] = FOCUS.exec(pathname) ?? [];
  if (!segment || !id) return {};
  const value = decodeURIComponent(id);
  return segment === "types"
    ? { template: value }
    : segment === "skills"
      ? { skill: value }
      : { strand: value };
}
const text = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null;

export function addressedIdentity(
  pathname: string,
  search: Record<string, unknown> = {},
): AddressedIdentity | null {
  const own = PATH.exec(pathname)?.[1];
  if (own) return { kind: "learner", id: decodeURIComponent(own) };
  const learner = text(search.learner);
  return learner ? { kind: "learner", id: learner } : null;
}

/** Whether the path itself names the learner (`/learners/<id>`,
 * `/pay/<id>`, a family child's address), rather than a search value.
 * Only a path may name one of the adult's own practice profiles as a
 * learner; `?learner=` never names a profile (CP-2 r3). */
export const namesLearnerByPath = (pathname: string) => PATH.test(pathname);

/** The shared learning screens: an address among them that names nobody is
 * self's (`selfOf`). */
const SELF =
  /^\/(?:practice|overview|progress|pathways|inventory|lessons|books)(?:\/|$)/;
export const isSelfAddress = (pathname: string) => SELF.test(pathname);

/** What an account's practice self is made of: its own learner and its
 * practice profiles. */
export type SelfAccount = {
  adultPractice?: { learner?: { id: string } | null } | null;
  practiceProfiles?: readonly { id: string }[] | null;
};

/**
 * Who "self" is on a shared learning screen that names nobody: the practice
 * profile the adult is practicing as (practicing as someone else is the
 * account's current learner, learner-store.ts, being one of its profiles),
 * else the adult's own learner. An account with neither (a parent who
 * doesn't practice, a student's session) has no self: null.
 */
export function selfOf(
  account: SelfAccount | null | undefined,
  current: string | null | undefined,
): AddressedIdentity | null {
  if (current && account?.practiceProfiles?.some((p) => p.id === current))
    return { kind: "profile", id: current };
  const own = account?.adultPractice?.learner?.id;
  return own ? { kind: "learner", id: own } : null;
}

/**
 * Whose a learning screen is, with self filled in: what the address names
 * (a path naming one of the account's practice profiles names it as that
 * profile), else, on a shared learning screen, `self` (`selfOf`; a bare id
 * is a learner).
 */
export function learningIdentity(
  pathname: string,
  search: Record<string, unknown> = {},
  self: AddressedIdentity | string | null | undefined = null,
  account: SelfAccount | null | undefined = null,
): AddressedIdentity | null {
  const named = addressedIdentity(pathname, search);
  if (named)
    return named.kind === "learner" &&
      namesLearnerByPath(pathname) &&
      !!account?.practiceProfiles?.some((p) => p.id === named.id)
      ? { kind: "profile", id: named.id }
      : named;
  if (!self || !isSelfAddress(pathname)) return null;
  return typeof self === "string" ? { kind: "learner", id: self } : self;
}

/** A family's child's learning screens: their page (the Overview) and its
 * Pathways and Inventory tabs. */
export type ChildScreen = "overview" | "pathways" | "inventory";
const CHILD = new RegExp(
  `^/family/(${UUID})/kids/([^/]+)(?:/(pathways|inventory))?/?$`,
  "i",
);

/** The canonical address of a family's child's screen. */
export const childPath = (
  family: string,
  learner: string,
  screen: ChildScreen = "overview",
) =>
  `/family/${family}/kids/${encodeURIComponent(learner)}${screen === "overview" ? "" : `/${screen}`}`;

/** The family, child and screen a child's address names, or null. */
export function childAddress(pathname: string) {
  const found = CHILD.exec(pathname);
  return found
    ? {
        family: found[1]!.toLowerCase(),
        learner: decodeURIComponent(found[2]!),
        screen: (found[3] ?? "overview") as ChildScreen,
      }
    : null;
}
