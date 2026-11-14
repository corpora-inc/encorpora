import type { SignedInMe } from "../../../account/contracts";
import type {
  ClassResource,
  OrgKind,
  OrgResource,
  StaffRole,
} from "../../../schools/contracts";
import type {
  FamilyPlaces,
  FamilyProjection,
} from "../../../family/projection-contracts";
import type { TabItem } from "../../ui/Tabs";
import { shellFrame, type ShellFrame } from "../navigation/shell-frame";
import { addressedIdentity, type AddressedIdentity } from "./identity";
import { spaceOfPath, type RouteSpace, type Space } from "./space";
import {
  accountTabs,
  classroomTabs,
  familyPlaceTabs,
  familyTabs,
  learnerTabs,
  meTabs,
  schoolTabs,
} from "./tabs";
import { spaceWords, type SpaceWords } from "./words";

/*
 * The resolution truth table (docs/architecture/spaces.md, "Resolution"):
 *
 *   student session, with or without an adult cookie  → student
 *   no session                                        → public
 *   invitation, approval, buyer or progress link      → public entry
 *   class or school route                             → classroom or school,
 *       family when the org is a family's (holder, second parent or
 *       co-teacher: the relationship is resolved, never assumed)
 *   shared learning route                             → the learner the
 *       route names (`/learners/$id/…`, `/continue/$id`, `?profile=`), else
 *       the one chosen on this device: the adult's own or a profile is me,
 *       a child is that child's family
 *   account, setup, starter and payment steps         → account
 *
 * A resource that has not answered is `loading`; one the server refused or
 * could not find, or that does not belong to the place the route names, is
 * `unavailable`. Neither ever falls back to another family, child, class or
 * session. Every capability here is the server's, for one named target.
 */

/** The settled route: its address, its parameters and the space it
 * declares. */
export type SpaceMatch = {
  pathname: string;
  /** The deepest matched route's `staticData.space`, when it declares one. */
  space?: RouteSpace;
  search?: Record<string, unknown>;
  /** A learner the route itself names (`$learnerId`). */
  learner?: string;
};

/** Who is signed in on this device. A student's session always wins: a
 * parent's cookie beside it never brings the parent's chrome. A verified
 * staff sign-in that replaces a student session arrives here as an adult
 * session (`auth.ts`); nothing here decides that. */
export type SpaceSession =
  | { kind: "none" }
  | { kind: "student"; me: SignedInMe | null }
  | {
      kind: "adult";
      /** `/me` for this same account, once loaded. */
      me: SignedInMe | null;
      /** The learner chosen on this device. */
      learnerId: string | null;
    };

/** What the server has said about the place the route names, as already
 * loaded: never fetched here, never a grant. `undefined` is not yet
 * answered; `null` is refused, missing or failed. */
export type SpaceResources = {
  org?: OrgResource | null;
  /** The org's classes in use, as this person reads them. */
  classes?: readonly ClassResource[] | null;
  /** The server's answer for the one class the route names: its year, and
   * (from a current server) what binds it to a place and what this person
   * may do in it. */
  year?: {
    past: boolean;
    /** The class's own org. */
    orgId?: string;
    /** The orgs from the top down to the class's own. */
    path?: readonly string[];
    name?: string | null;
    can?: readonly string[];
  } | null;
  /** Students covered by the class's running practice. */
  covered?: number;
  /** The family a `/family/<family>/…` address names: its own children and
   * what this reader may do with each (docs/architecture/family-api.md). */
  family?: FamilyProjection | null;
  /** The families this account belongs to (`GET /families`): which family a
   * tutoring group's class is, for the switcher. */
  families?: FamilyPlaces | null;
  /** A lookup failed without a refusal (the network, a server error). */
  failed?: boolean;
  /** This session's own `/me` failed before it ever answered: whatever is
   * on screen belongs to an earlier session. */
  unconfirmed?: boolean;
};

export type SpaceAction =
  "start-class" | "demo-setup" | "practice" | "sign-out" | "profile-back";

export type DestinationIcon =
  | "child"
  | "learn"
  | "level"
  | "workbooks"
  | "class"
  | "school"
  | "standings"
  | "someone";

/** A link in the drawer: one of the current space's own screens. */
export type Destination = {
  id: string;
  label: string;
  /** Without the leading slash. */
  path: string;
  icon: DestinationIcon;
  /** The learner a learning screen is for, in its address: a refresh or a
   * shared link never changes whose record it is. */
  search?: { learner: string };
  detail?: string;
  current: boolean;
};

/** What the server said one target allows this person. */
export type TargetCapabilities = {
  /** A learner target is one child of a family: naming, consent, purchase
   * and the rest are that child's, never the family's at large. */
  target: { kind: "org" | "class" | "learner"; id: string };
  can: readonly string[];
};

/**
 * A learner's own target, from what the server's `/me` says of them: whose
 * they are (the account's own children, a family it is the second parent
 * of, the adult's own learner) and their access. Never from a space.
 * - `learner.read`: their record;
 * - `learner.practice`: practice as them on this device (`canPractice`);
 * - `learner.handover`: let them practice here from the family's Today (a
 *   second parent's children);
 * - `learner.name`, `learner.consent`, `learner.purchase`: the account
 *   holder's own children only.
 */
export function learnerTarget(
  me: SignedInMe | null,
  id: string,
): TargetCapabilities | null {
  if (!me) return null;
  const access = me.family.learners.find((entry) => entry.id === id);
  const practice =
    access?.canPractice === true ? (["learner.practice"] as const) : [];
  if (me.adultPractice?.learner?.id === id)
    return {
      target: { kind: "learner", id },
      can: ["learner.read", "learner.practice"],
    };
  if (me.learners.some((learner) => learner.id === id))
    return {
      target: { kind: "learner", id },
      can: [
        "learner.read",
        ...practice,
        "learner.name",
        "learner.consent",
        "learner.purchase",
      ],
    };
  if (
    (me.secondParentOf ?? []).some((family) =>
      family.learners.some((learner) => learner.id === id),
    )
  )
    return {
      target: { kind: "learner", id },
      can: ["learner.read", "learner.handover"],
    };
  return null;
}

export type LearnerRef = { id: string; name: string };
export type OrgRef = {
  id: string;
  name: string | null;
  kind: OrgKind | null;
  demo: boolean;
  /** A one-class school: the class is the place. */
  lone: boolean;
};
export type ClassRef = {
  id: string;
  name: string | null;
  past: boolean;
  /** The sign-in board (`start`) is open. */
  board: boolean;
  /** Practice can be started for someone in it, or it's a demo. */
  start: boolean;
};
/** `failed`: a lookup failed (not refused): the place may be fine, and
 * trying again may show it. */
export type Resolution = "ready" | "loading" | "unavailable" | "failed";
/** How this person belongs to the family on screen. */
export type FamilyRelation = "holder" | "second-parent" | "co-teacher";
/** How this person reaches the class on screen. */
export type ClassRole = "teacher" | "admin" | "viewer" | "aide" | "staff";

type Frame = {
  /** The bar: a row of tabs, practice's tools, the logo alone, or none (the
   * screen keeps a frame of its own). */
  bar: "tabs" | "practice" | "plain" | null;
  tabs: readonly TabItem[];
  /** The open tab. */
  active: string | null;
  actions: readonly SpaceAction[];
  destinations: readonly Destination[];
  words: SpaceWords;
  /** The place switcher's id for where this is, if it is a place. */
  place: string | null;
  /** The place named in the bar ("Grade 4 Math · Alder Grove", "My
   * practice", a child's name on their learning screens): null when
   * nothing is named. */
  label: string | null;
};

export type SpaceDescriptor =
  | (Frame & {
      space: "public";
      /** A page anyone reads, or a link carrying its own authority. */
      entry: "page" | "invite" | "approval" | "buyer" | "student-entry";
    })
  | (Frame & {
      space: "account";
      scope: "settings" | "setup" | "starter" | "steps";
    })
  | (Frame & {
      space: "student";
      status: Resolution;
      learner: LearnerRef | null;
    })
  | (Frame & {
      space: "me";
      /** `unavailable`: the address named a learner this account doesn't
       * read. */
      status: Resolution;
      /** Their own practice, a practice profile, or nothing started yet. */
      mode: "own" | "profile" | "none";
      learner: LearnerRef | null;
    })
  | (Frame & {
      space: "family";
      status: Resolution;
      /** The family is its org: the holder's, or one this person is the
       * second parent or a co-teacher of. Never "the account's family". Null
       * only for a learning screen of their own child who is hosted in
       * another family's class, until the family projection (P2) names it. */
      family: { id: string | null; name: string | null; demo: boolean };
      relation: FamilyRelation | null;
      class: ClassRef | null;
      learner: LearnerRef | null;
      /** The family's own children, to choose between: never a class's
       * other students. */
      learners: readonly LearnerRef[];
      capabilities: readonly TargetCapabilities[];
    })
  | (Frame & {
      space: "classroom";
      status: Resolution;
      org: OrgRef;
      class: ClassRef;
      role: ClassRole | null;
      capabilities: readonly TargetCapabilities[];
    })
  | (Frame & {
      space: "school";
      status: Resolution;
      org: OrgRef;
      capabilities: readonly TargetCapabilities[];
    });

const text = (value: unknown) => (typeof value === "string" ? value : null);

/** Whether the server's answer for the class places it under the org the
 * route names (its own org, or one above it): `true`, `false`, or `null`
 * when the answer proves nothing (an older answer without its place), which
 * is unresolved, never accepted. */
const boundTo = (
  year: SpaceResources["year"],
  orgId: string,
): boolean | null => (year?.path ? year.path.includes(orgId) : null);

/** The class's own capabilities, when the server sent them. */
const classTarget = (
  classId: string,
  year: SpaceResources["year"],
): TargetCapabilities[] =>
  year?.can ? [{ target: { kind: "class", id: classId }, can: year.can }] : [];

type FamilyPlace = {
  orgId: string;
  classId: string;
  name: string;
  relation: "holder" | "second-parent";
  learners: readonly LearnerRef[];
};

/** The family at this org that this account belongs to by relationship. */
function familyAt(me: SignedInMe | null, orgId: string): FamilyPlace | null {
  if (me?.familyClass?.orgId === orgId)
    return {
      orgId,
      classId: me.familyClass.classId,
      name: me.familyClass.className,
      relation: "holder",
      learners: me.learners,
    };
  const shared = me?.secondParentOf?.find((family) => family.orgId === orgId);
  return shared
    ? {
        orgId,
        classId: shared.classId,
        name: shared.className,
        relation: "second-parent",
        learners: shared.learners,
      }
    : null;
}

type Chosen =
  | { kind: "own"; id: string; name: string; profile: boolean }
  | { kind: "child"; id: string; name: string; family: string | null };

/** Whose learning screens these are. The route's own learner or profile
 * first; then this device's choice; then their first child, else their own
 * practice. A learner who is none of theirs is nobody's here. */
function chosenLearner(
  me: SignedInMe | null,
  /** What the address names (features/spaces/identity.ts): the one answer
   * when present, in the same order and with the same kinds as the
   * learning view and practice read it. */
  named: AddressedIdentity | null,
  selected: string | null,
): Chosen | null {
  const own = me?.adultPractice?.learner ?? null;
  const learnerOf = (id: string): Chosen | null => {
    if (own?.id === id)
      return { kind: "own", id, name: own.name, profile: false };
    const child = me?.learners.find((learner) => learner.id === id);
    if (child) return { kind: "child", id, name: child.name, family: null };
    for (const family of me?.secondParentOf ?? []) {
      const shared = family.learners.find((learner) => learner.id === id);
      if (shared)
        return { kind: "child", id, name: shared.name, family: family.orgId };
    }
    return null;
  };
  const profileOf = (id: string): Chosen | null => {
    const profile = me?.practiceProfiles?.find((entry) => entry.id === id);
    return profile
      ? { kind: "own", id, name: profile.label, profile: true }
      : null;
  };
  // Named: that learner or profile, of the kind named, or nobody.
  if (named)
    return named.kind === "profile" ? profileOf(named.id) : learnerOf(named.id);
  const chosen = selected ? (learnerOf(selected) ?? profileOf(selected)) : null;
  if (chosen) return chosen;
  const first = me?.learners[0];
  if (first)
    return { kind: "child", id: first.id, name: first.name, family: null };
  if (own) return { kind: "own", id: own.id, name: own.name, profile: false };
  const shared = me?.secondParentOf?.find((family) => family.learners.length);
  return shared
    ? {
        kind: "child",
        id: shared.learners[0]!.id,
        name: shared.learners[0]!.name,
        family: shared.orgId,
      }
    : null;
}

/**
 * The one description of where the person is (docs/architecture/spaces.md):
 * the space, the place in it and how they belong there, its tabs, its bar's
 * actions, its drawer's destinations and its words, from the settled route,
 * the session and the resources the route names. Pure: the same inputs
 * always describe the same frame, so a late answer for another place, Back,
 * or a second tab can only ever describe the place its own inputs name.
 */
export function resolveSpace(
  match: SpaceMatch,
  session: SpaceSession,
  resources: SpaceResources = {},
): SpaceDescriptor {
  const resolved = resolveOnce(match, session, resources);
  // What is still unanswered because a lookup failed, or a place shown to a
  // session whose own account never answered, is `failed`: nothing of it
  // shows until it is asked again.
  return "status" in resolved &&
    resolved.status !== "unavailable" &&
    (resources.unconfirmed ||
      (resources.failed && resolved.status === "loading"))
    ? { ...resolved, status: "failed", tabs: [], actions: [], destinations: [] }
    : resolved;
}

function resolveOnce(
  match: SpaceMatch,
  session: SpaceSession,
  resources: SpaceResources,
): SpaceDescriptor {
  const frame =
    session.kind === "none"
      ? null
      : shellFrame(match.pathname, text(match.search?.class) ?? undefined);
  const route = match.space ?? spaceOfPath(match.pathname);
  const me = session.kind === "none" ? null : (session.me ?? null);
  const base: Frame = {
    bar: !frame
      ? null
      : frame.kind === "practice"
        ? "practice"
        : frame.kind === "plain"
          ? "plain"
          : "tabs",
    tabs: [],
    active: frame && "active" in frame ? frame.active : null,
    actions: [],
    destinations: [],
    words: spaceWords("public"),
    place: null,
    label: null,
  };
  const words = (space: Space) => ({ words: spaceWords(space) });
  if (session.kind === "student")
    return studentSpace({ ...base, ...words("student") }, frame, me);
  if (session.kind === "none")
    return { ...base, ...words("public"), space: "public", entry: "page" };
  if (route === "public" || route === "student")
    return {
      ...base,
      ...words("public"),
      // A link's own screen: no tabs, no place, nothing of other places.
      tabs: [],
      space: "public",
      entry: entryOf(match.pathname, route),
    };
  if (route === "account")
    return {
      ...base,
      ...words("account"),
      space: "account",
      scope:
        frame?.kind === "account"
          ? "settings"
          : /^\/start(\/|$)/.test(match.pathname)
            ? "starter"
            : /^\/school(\/|$)/.test(match.pathname)
              ? "setup"
              : "steps",
      tabs: frame?.kind === "account" ? [...accountTabs] : [],
      actions: frame?.kind === "plain" && frame.practice ? ["practice"] : [],
      label: frame?.kind === "account" ? "Account" : null,
    };
  if (frame?.kind === "family")
    return frame.leaf === "group" || frame.leaf.startsWith("group/")
      ? groupSpace({ ...base, ...words("classroom") }, frame, resources)
      : familyPlaceSpace({ ...base, ...words("family") }, frame, me, resources);
  if (route === "classroom" || route === "school") {
    const orgId =
      frame?.kind === "class" || frame?.kind === "school" ? frame.org : null;
    if (orgId) {
      const org = resources.org?.id === orgId ? resources.org : undefined;
      const missing = resources.org === null;
      const family =
        familyAt(me, orgId) ??
        (org?.kind === "family" ? ("co-teacher" as const) : null);
      // A family-kind class at its class address is a tutoring group: a
      // parent's own family class opens at /family (its old addresses
      // redirect), so what renders here is the whole group, the classroom
      // composition, a teaching place of its own (R2).
      if (family && frame?.kind === "class") {
        const group = resources.families?.families.find(
          (entry) => entry.teachingPlace?.classId === frame.classId,
        );
        const space = teachingSpace(
          { ...base, ...words("classroom") },
          "classroom",
          frame,
          orgId,
          { ...resources, org: missing ? null : org },
        );
        // The class the parent's relationship names, never another one.
        const named =
          family !== "co-teacher" && family.classId !== frame.classId;
        if (named)
          return {
            ...space,
            status: "unavailable",
            tabs: [],
            destinations: [],
            actions: [],
            label: null,
          } as SpaceDescriptor;
        return {
          ...space,
          label: "Tutoring group",
          place: `group:${group?.familyId ?? orgId}`,
          destinations: space.destinations.map((entry) =>
            entry.id === "class"
              ? { ...entry, label: "Tutoring group" }
              : entry,
          ),
        };
      }
      if (family)
        return familySpace({ ...base, ...words("family") }, frame, me, {
          orgId,
          relation: family === "co-teacher" ? null : family.relation,
          resources: { ...resources, org: missing ? null : org },
          selected: session.learnerId,
        });
      return teachingSpace({ ...base, ...words(route) }, route, frame!, orgId, {
        ...resources,
        org: missing ? null : org,
      });
    }
  }
  if (route === "learner" || route === "me" || route === "family") {
    const named =
      route === "me"
        ? null
        : addressedIdentity(match.pathname, match.search ?? {});
    const chosen =
      route === "me" ? null : chosenLearner(me, named, session.learnerId);
    // The address named someone this account doesn't read: unavailable,
    // never whoever was chosen before.
    const foreign = route === "learner" && !chosen && !!named;
    if (chosen?.kind === "child")
      return familySpace({ ...base, ...words("family") }, frame, me, {
        orgId: chosen.family ?? me?.familyClass?.orgId ?? null,
        relation: chosen.family ? "second-parent" : "holder",
        resources: {},
        selected: chosen.id,
        learnerOnly: true,
        child: { id: chosen.id, name: chosen.name },
      });
    return meSpace(
      { ...base, ...words("me") },
      frame,
      me,
      foreign ? null : (chosen ?? chosenLearner(me, null, session.learnerId)),
      match.pathname,
      foreign,
    );
  }
  // A class or school address with no place in it: the account's setup.
  return {
    ...base,
    ...words("account"),
    space: "account",
    scope: "setup",
  };
}

function entryOf(
  pathname: string,
  route: RouteSpace,
): Extract<SpaceDescriptor, { space: "public" }>["entry"] {
  if (route === "student") return "student-entry";
  if (pathname.startsWith("/school/invite")) return "invite";
  if (pathname.startsWith("/family/approv")) return "approval";
  if (pathname.startsWith("/schools/continue")) return "buyer";
  return "page";
}

function studentSpace(
  base: Frame,
  frame: ShellFrame | null,
  me: SignedInMe | null,
): SpaceDescriptor {
  const learner = me?.learners[0];
  return {
    ...base,
    space: "student",
    status: "ready",
    learner: learner ? { id: learner.id, name: learner.name } : null,
    label: learner?.name ?? null,
    // A student's own record; nothing of a class's or a parent's.
    tabs: frame?.kind === "progress" ? learnerTabs() : [],
    bar:
      frame?.kind === "account" ||
      frame?.kind === "class" ||
      frame?.kind === "school"
        ? "plain"
        : base.bar,
    actions: frame?.kind === "practice" ? ["sign-out"] : [],
    destinations: [
      {
        id: "practice",
        label: "Practice",
        path: "practice",
        icon: "learn",
        current: frame?.kind === "practice",
      },
      ...(me?.school?.standings && frame?.kind !== "practice"
        ? [
            {
              id: "standings",
              label: "Standings",
              path: "standings",
              icon: "standings" as const,
              detail: "Your class’s board",
              current: false,
            },
          ]
        : []),
    ],
  };
}

function meSpace(
  base: Frame,
  frame: ShellFrame | null,
  me: SignedInMe | null,
  chosen: Chosen | null,
  pathname: string,
  /** The route named a learner that isn't this account's. */
  foreign: boolean,
): SpaceDescriptor {
  const own = me?.adultPractice?.learner ?? null;
  const learner =
    !foreign && chosen?.kind === "own"
      ? { id: chosen.id, name: chosen.name }
      : !foreign && own
        ? { id: own.id, name: own.name }
        : null;
  const workbooks = own ? `learners/${own.id}/workbooks` : null;
  const onWorkbooks =
    !!workbooks &&
    (pathname === `/${workbooks}` || pathname.startsWith(`/${workbooks}/`));
  const tabbed = frame?.kind === "progress";
  const active = onWorkbooks
    ? "workbooks"
    : frame?.kind === "progress"
      ? frame.active === "overview"
        ? "levels"
        : frame.active
      : frame?.kind === "practice"
        ? "practice"
        : base.active;
  const destination = (
    id: string,
    label: string,
    path: string,
    icon: DestinationIcon,
    search?: { learner: string },
  ): Destination => ({
    id,
    label,
    path,
    icon,
    ...(search ? { search } : {}),
    current: id === active && (tabbed || frame?.kind === "practice"),
  });
  return {
    ...base,
    space: "me",
    status: foreign ? "unavailable" : "ready",
    mode:
      chosen?.kind === "own" && chosen.profile
        ? "profile"
        : own
          ? "own"
          : "none",
    learner,
    tabs:
      tabbed && !foreign
        ? meTabs(
            own?.id ?? null,
            chosen?.kind === "own" && chosen.profile ? chosen.id : null,
          )
        : [],
    bar: frame?.kind === "account" ? "plain" : base.bar,
    active,
    actions:
      frame?.kind === "practice"
        ? ["profile-back"]
        : // Practice is a tab once there is someone to practice as.
          (tabbed && !own) || (frame?.kind === "plain" && frame.practice)
          ? ["practice"]
          : [],
    destinations: own
      ? [
          destination("practice", "Practice", "practice", "learn", {
            learner: own.id,
          }),
          destination("levels", "Levels", "me", "level"),
          destination("workbooks", "Workbooks", workbooks!, "workbooks"),
          destination("profiles", "Profiles", "me/profiles", "someone"),
        ]
      : [
          ...(me?.adultPractice?.eligible
            ? [
                destination(
                  "start",
                  "Start my own practice",
                  "me/start",
                  "learn",
                ),
              ]
            : []),
          destination("profiles", "Profiles", "me/profiles", "someone"),
        ],
    place: "me",
    label:
      chosen?.kind === "own" && chosen.profile ? chosen.name : "My practice",
  };
}

function familySpace(
  base: Frame,
  frame: ShellFrame | null,
  me: SignedInMe | null,
  {
    orgId,
    relation: known,
    resources,
    selected,
    learnerOnly = false,
    child,
  }: {
    orgId: string | null;
    relation: "holder" | "second-parent" | null;
    resources: SpaceResources;
    selected: string | null;
    /** A learning screen for one of the family's children. */
    learnerOnly?: boolean;
    /** The child a learning screen names, already found to be theirs. */
    child?: { id: string; name: string };
  },
): SpaceDescriptor {
  const onClass = frame?.kind === "class" || frame?.kind === "school";
  const family = orgId ? familyAt(me, orgId) : null;
  const relation: FamilyRelation | null =
    family?.relation ?? known ?? (resources.org ? "co-teacher" : null);
  const org = resources.org ?? null;
  // A family's class is the one its relationship names. A class the route
  // names that isn't the family's is unavailable, never swapped for another.
  const classId =
    frame?.kind === "class" ? frame.classId : (family?.classId ?? null);
  // The named class must be the family's (by relationship) and must belong
  // to the org the route names (by the server's answer for it).
  const bound =
    frame?.kind === "class" && orgId ? boundTo(resources.year, orgId) : true;
  const mismatch =
    frame?.kind === "class" &&
    ((!!family && family.classId !== frame.classId) || bound === false);
  const klass = (resources.classes ?? []).find((entry) => entry.id === classId);
  const status: Resolution = learnerOnly
    ? "ready"
    : mismatch || resources.org === null || resources.year === null
      ? "unavailable"
      : !family && !org
        ? "loading"
        : frame?.kind === "class" &&
            (resources.year === undefined || bound !== true)
          ? "loading"
          : "ready";
  // A co-teacher teaches the family's class; its children are not theirs.
  // A child of theirs hosted in another family's class has no family class
  // of their own here yet: they are still theirs, never dropped.
  const learners =
    family?.learners ??
    (child && relation === "holder"
      ? (me?.learners ?? [child])
      : child
        ? [child]
        : []);
  const learner =
    learners.find((entry) => entry.id === selected) ?? learners[0] ?? null;
  const past = resources.year?.past === true;
  const tabs =
    status !== "ready"
      ? []
      : onClass && classId && orgId
        ? familyTabs(orgId, classId, {
            past,
            learners: klass?.studentCount ?? learners.length,
            ...(frame?.kind === "class"
              ? { can: resources.year?.can ?? [] }
              : {}),
          })
        : frame?.kind === "progress"
          ? learnerTabs().map((item) =>
              learner ? { ...item, search: { learner: learner.id } } : item,
            )
          : [];
  const active =
    frame?.kind === "class" && frame.leaf === "report-cards"
      ? "report-cards"
      : base.active;
  // A parent's family opens at its own address; a co-teacher's class is
  // the class's Today.
  const home =
    status === "unavailable" || !orgId
      ? null
      : relation === "holder" || relation === "second-parent"
        ? // A family's id need not be its org's: the landing alias opens it.
          "family"
        : classId
          ? `school/${orgId}/classes/${classId}/today`
          : null;
  return {
    ...base,
    space: "family",
    status,
    family: {
      id: orgId,
      name: org?.name ?? family?.name ?? null,
      demo: org?.demo === true,
    },
    relation,
    class: classId
      ? {
          id: classId,
          name: klass?.name ?? resources.year?.name ?? family?.name ?? null,
          past,
          board: frame?.kind === "class" && frame.board,
          start: false,
        }
      : null,
    learner: learner ? { id: learner.id, name: learner.name } : null,
    learners: learners.map(({ id, name }) => ({ id, name })),
    capabilities: [
      ...(org
        ? [{ target: { kind: "org" as const, id: org.id }, can: org.can ?? [] }]
        : []),
      ...(classId && frame?.kind === "class"
        ? classTarget(classId, resources.year)
        : []),
      ...(learner
        ? [learnerTarget(me, learner.id)].filter(
            (entry): entry is TargetCapabilities => !!entry,
          )
        : []),
    ],
    tabs,
    bar: frame?.kind === "account" ? "plain" : base.bar,
    active,
    actions:
      frame?.kind === "practice"
        ? ["profile-back"]
        : frame?.kind === "progress" ||
            (frame?.kind === "plain" && frame.practice)
          ? ["practice"]
          : [],
    destinations:
      status === "unavailable"
        ? []
        : [
            ...(home
              ? [
                  {
                    id: "today",
                    label: "Today",
                    path: home,
                    icon: "class" as const,
                    current: onClass && active === "today",
                  },
                ]
              : []),
          ],
    place: !orgId
      ? "home"
      : relation === "holder"
        ? "home"
        : relation === "second-parent"
          ? `family:${orgId}`
          : `school:${orgId}`,
    // A child's learning screens name the child; the family's own screens
    // name the family.
    label: learnerOnly
      ? (learner?.name ?? null)
      : (org?.name ?? family?.name ?? null),
  };
}

function teachingSpace(
  base: Frame,
  space: "classroom" | "school",
  frame: ShellFrame,
  orgId: string,
  resources: SpaceResources,
): SpaceDescriptor {
  const onClass = frame.kind === "class";
  const org = resources.org ?? null;
  const classes = resources.classes ?? [];
  const lone = org?.solo === true && classes.length <= 1;
  const demo = org?.demo === true;
  const year = resources.year;
  const past = year?.past === true;
  const bound = onClass ? boundTo(year, orgId) : true;
  const status: Resolution =
    resources.org === null || (onClass && (year === null || bound === false))
      ? "unavailable"
      : !org || (onClass && (year === undefined || bound !== true))
        ? "loading"
        : "ready";
  const klass = onClass
    ? classes.find((entry) => entry.id === frame.classId)
    : undefined;
  // Starting needs the class's sign-in board, where the server says so.
  const start =
    onClass &&
    status === "ready" &&
    !past &&
    !!year?.can?.includes("signin.read") &&
    (demo || (resources.covered ?? 0) > 0);
  const tabs =
    status !== "ready" || !org
      ? []
      : onClass
        ? classroomTabs(org.id, frame.classId, { past, can: year?.can ?? [] })
        : schoolTabs(org, { lone });
  const can = new Set(org?.can ?? []);
  const roles = new Set<StaffRole>(org?.roles ?? []);
  const orgRef: OrgRef = {
    id: orgId,
    name: org?.name ?? null,
    kind: org?.kind ?? null,
    demo,
    lone,
  };
  const capabilities: TargetCapabilities[] = [
    ...(org
      ? [{ target: { kind: "org" as const, id: org.id }, can: org.can ?? [] }]
      : []),
    ...(onClass ? classTarget(frame.classId, year) : []),
  ];
  const actions: SpaceAction[] = [
    ...(demo ? (["demo-setup"] as const) : []),
    ...(start && !demo ? (["start-class"] as const) : []),
  ];
  const school: Destination[] =
    status !== "unavailable" && !lone && (!onClass || can.has("overview.read"))
      ? [
          {
            id: "school",
            label: onClass ? "School" : (org?.name ?? "School"),
            path: `school/${orgId}`,
            icon: "school",
            ...(onClass && org ? { detail: org.name } : {}),
            current: !onClass,
          },
        ]
      : [];
  if (!onClass)
    return {
      ...base,
      space: "school",
      status,
      org: orgRef,
      capabilities,
      tabs,
      actions,
      destinations: school,
      place: `school:${orgId}`,
      label: org?.name ?? null,
    };
  return {
    ...base,
    space: space === "school" ? "classroom" : space,
    status,
    org: orgRef,
    class: {
      id: frame.classId,
      name: klass?.name ?? year?.name ?? null,
      past,
      board: frame.board,
      start,
    },
    // How they reach this class: teaching it, or from above it. A viewer or
    // an admin inspecting it is never offered a teacher's controls by this.
    // A role from above (a district's admin or viewer) shows in what the
    // server lets them do here, not in a role held at this org.
    role: !org
      ? null
      : org.teaches?.includes(frame.classId)
        ? "teacher"
        : roles.has("admin") || can.has("staff.manage")
          ? "admin"
          : roles.has("viewer") || can.has("overview.read")
            ? "viewer"
            : roles.has("aide")
              ? "aide"
              : "staff",
    capabilities,
    tabs,
    actions,
    destinations:
      status === "unavailable"
        ? []
        : [
            {
              id: "class",
              label: klass?.name ?? year?.name ?? "Class",
              path: `school/${orgId}/classes/${frame.classId}/today`,
              icon: "class",
              current: true,
            },
            ...school,
          ],
    place: `class:${orgId}:${frame.classId}`,
    label: (() => {
      const name = klass?.name ?? year?.name ?? null;
      return name && status !== "unavailable"
        ? lone || !org
          ? name
          : `${name} · ${org.name}`
        : null;
    })(),
  };
}

type FamilyFrame = Extract<ShellFrame, { kind: "family" }>;

/**
 * The family's own class, when it has one, with the org that holds it. A
 * family's id is an opaque key that need not be its class's org
 * (docs/architecture/family-api.md), so the class comes from the projection
 * (a child's class hosted by the family, or its tutoring class) or, for an
 * account holder before any child, their own family class; never from
 * comparing ids. A family whose children are all hosted elsewhere has none.
 */
export function ownClassOf(
  me: SignedInMe | null,
  family: string,
  projection?: FamilyProjection | null,
): { id: string; name: string; org: string } | null {
  const data = projection?.familyId === family ? projection : null;
  const relationClass = (classId: string) => {
    if (me?.familyClass?.classId === classId)
      return {
        id: classId,
        name: me.familyClass.className,
        org: me.familyClass.orgId,
      };
    const shared = me?.secondParentOf?.find(
      (entry) => entry.classId === classId,
    );
    return shared
      ? { id: classId, name: shared.className, org: shared.orgId }
      : null;
  };
  if (data) {
    const hosted = data.children
      .flatMap((child) => child.classes)
      .find((entry) => entry.hostedByFamily);
    if (hosted) return { id: hosted.id, name: hosted.name, org: hosted.orgId };
    if (data.teachingPlace) return relationClass(data.teachingPlace.classId);
    if (data.role === "holder" && me?.familyClass)
      return relationClass(me.familyClass.classId);
    return null;
  }
  // Before the projection answers: the relationship whose org is this id
  // (a family made by a compatible API).
  if (me?.familyClass?.orgId === family)
    return relationClass(me.familyClass.classId);
  const shared = me?.secondParentOf?.find((entry) => entry.orgId === family);
  return shared ? relationClass(shared.classId) : null;
}

/** The capabilities a family projection grants, by name, for one target. */
function familyCan(data: FamilyProjection): string[] {
  return Object.entries(data.capabilities)
    .filter(([, allowed]) => allowed)
    .map(([name]) => name);
}

/**
 * A family's own screens (`/family/<family>/…`), from the family projection
 * that address names: its children (owned, or this second parent's family's,
 * never a class's other students), its tabs, and the children as the drawer's
 * rows. A projection for another family is never read; a refused or missing
 * one is unavailable.
 */
function familyPlaceSpace(
  base: Frame,
  frame: FamilyFrame,
  me: SignedInMe | null,
  resources: SpaceResources,
): SpaceDescriptor {
  const data =
    resources.family === null
      ? null
      : resources.family?.familyId === frame.family
        ? resources.family
        : undefined;
  const status: Resolution =
    data === null ? "unavailable" : data === undefined ? "loading" : "ready";
  const children = data?.children ?? [];
  const learners = children.map(({ id, name }) => ({ id, name }));
  const kid = /^kids\/([^/]+)/.exec(frame.leaf)?.[1] ?? null;
  const learner = kid
    ? (learners.find((entry) => entry.id === kid) ?? null)
    : null;
  const own = ownClassOf(me, frame.family, data);
  const home = `family/${frame.family}`;
  const workbooks = children.length
    ? children.some((child) => child.capabilities.readWorkbooks)
    : data?.role === "holder";
  return {
    ...base,
    space: "family",
    status,
    family: {
      id: frame.family,
      name: data?.displayName ?? null,
      demo: false,
    },
    relation: data?.role ?? null,
    class: own
      ? { id: own.id, name: own.name, past: false, board: false, start: false }
      : null,
    learner,
    learners,
    capabilities: data
      ? [
          { target: { kind: "org", id: frame.family }, can: familyCan(data) },
          // Each child's own rights, as the projection grants them.
          ...data.children.map((child) => ({
            target: { kind: "learner" as const, id: child.id },
            can: Object.entries(child.capabilities)
              .filter(([, allowed]) => allowed)
              .map(([name]) => name),
          })),
        ]
      : [],
    tabs:
      status === "ready" ? familyPlaceTabs(frame.family, { workbooks }) : [],
    bar: "tabs",
    active: frame.active,
    actions: [],
    destinations:
      status === "unavailable"
        ? []
        : [
            {
              id: "today",
              label: "Today",
              path: home,
              icon: "class",
              current: frame.leaf === "",
            },
            ...learners.map((child) => ({
              id: `child:${child.id}`,
              label: child.name,
              path: `${home}/kids/${child.id}`,
              icon: "child" as const,
              current: kid === child.id,
            })),
          ],
    place:
      status === "unavailable"
        ? null
        : data?.role === "holder"
          ? "home"
          : `family:${frame.family}`,
    label: data?.displayName ?? null,
  };
}

/**
 * A tutoring group (`/family/<family>/group`): a family-kind class that holds
 * other families' children, presented as a teaching place of its own, the
 * whole class in a classroom's words. It is never mixed into the family.
 */
function groupSpace(
  base: Frame,
  frame: FamilyFrame,
  resources: SpaceResources,
): SpaceDescriptor {
  const data =
    resources.family === null
      ? null
      : resources.family?.familyId === frame.family
        ? resources.family
        : undefined;
  const place = data?.teachingPlace ?? null;
  const status: Resolution =
    data === null || (data && !place)
      ? "unavailable"
      : data === undefined
        ? "loading"
        : "ready";
  return {
    ...base,
    space: "classroom",
    status,
    org: {
      id: frame.family,
      name: data?.displayName ?? null,
      kind: "family",
      demo: false,
      lone: true,
    },
    class: {
      id: place?.classId ?? "",
      name: place?.displayName ?? null,
      past: false,
      board: false,
      start: false,
    },
    role: data ? "teacher" : null,
    capabilities: [],
    tabs: [],
    // One screen: the bar names it, with no row of tabs under it.
    bar: "plain",
    active: null,
    actions: [],
    destinations:
      status === "unavailable"
        ? []
        : [
            {
              id: "group",
              label: "Tutoring group",
              path: `family/${frame.family}/group`,
              icon: "class",
              current: true,
            },
          ],
    place: `group:${frame.family}`,
    label: "Tutoring group",
  };
}

/** What the space's descriptor says this person may do with one target:
 * the server's own list, never inferred from a space or a role. */
export function canOn(
  space: SpaceDescriptor | null | undefined,
  target: TargetCapabilities["target"],
  capability: string,
): boolean {
  if (!space || !("capabilities" in space)) return false;
  return space.capabilities.some(
    (entry) =>
      entry.target.kind === target.kind &&
      entry.target.id === target.id &&
      entry.can.includes(capability),
  );
}
