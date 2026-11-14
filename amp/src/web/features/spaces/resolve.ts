import type { SignedInMe } from "../../../account/contracts";
import type {
  ClassResource,
  OrgKind,
  OrgResource,
  StaffRole,
} from "../../../schools/contracts";
import type { TabItem } from "../../ui/Tabs";
import { shellFrame, type ShellFrame } from "../navigation/shell-frame";
import { spaceOfPath, type RouteSpace, type Space } from "./space";
import {
  accountTabs,
  classroomTabs,
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
};

export type SpaceAction =
  "start-class" | "demo-setup" | "practice" | "sign-out" | "profile-back";

export type DestinationIcon =
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
  target: { kind: "org" | "class"; id: string };
  can: readonly string[];
};

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
export type Resolution = "ready" | "loading" | "unavailable";
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

/** The class the server answered for belongs to the org the route names
 * (its own org, or one above it). An older server says nothing: unknown. */
const boundTo = (year: SpaceResources["year"], orgId: string) =>
  !year?.path || year.path.includes(orgId);

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
  routeLearner: string | null,
  profileId: string | null,
  selected: string | null,
  named: string | null = null,
): Chosen | null {
  const own = me?.adultPractice?.learner ?? null;
  const pick = (id: string | null): Chosen | null => {
    if (!id) return null;
    if (own?.id === id)
      return { kind: "own", id, name: own.name, profile: false };
    const profile = me?.practiceProfiles?.find((entry) => entry.id === id);
    if (profile) return { kind: "own", id, name: profile.label, profile: true };
    const child = me?.learners.find((learner) => learner.id === id);
    if (child) return { kind: "child", id, name: child.name, family: null };
    for (const family of me?.secondParentOf ?? []) {
      const shared = family.learners.find((learner) => learner.id === id);
      if (shared)
        return { kind: "child", id, name: shared.name, family: family.orgId };
    }
    return null;
  };
  // One order everywhere (adoption, the address builder, here): the route's
  // own `$learnerId`, then a practice profile (a mode), then `?learner=`,
  // then the device's choice.
  if (routeLearner) return pick(routeLearner);
  const profile = profileId ? pick(profileId) : null;
  if (profile?.kind === "own" && profile.profile) return profile;
  if (named) return pick(named);
  const chosen = pick(selected);
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
  if (route === "classroom" || route === "school") {
    const orgId =
      frame?.kind === "class" || frame?.kind === "school" ? frame.org : null;
    if (orgId) {
      const org = resources.org?.id === orgId ? resources.org : undefined;
      const missing = resources.org === null;
      const family =
        familyAt(me, orgId) ??
        (org?.kind === "family" ? ("co-teacher" as const) : null);
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
    const profile = text(match.search?.profile);
    const named = text(match.search?.learner);
    const chosen =
      route === "me"
        ? null
        : chosenLearner(
            me,
            match.learner ?? null,
            profile,
            session.learnerId,
            named,
          );
    // The address named someone this account doesn't read: unavailable,
    // never whoever was chosen before.
    const validProfile = !!me?.practiceProfiles?.some(
      (entry) => entry.id === profile,
    );
    const foreign =
      route === "learner" &&
      !chosen &&
      (!!match.learner || (!validProfile && !!named));
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
      foreign
        ? null
        : (chosen ?? chosenLearner(me, null, profile, session.learnerId)),
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
  const mismatch =
    frame?.kind === "class" &&
    ((!!family && family.classId !== frame.classId) ||
      (!!orgId && !boundTo(resources.year, orgId)));
  const klass = (resources.classes ?? []).find((entry) => entry.id === classId);
  const status: Resolution = learnerOnly
    ? "ready"
    : mismatch || resources.org === null || resources.year === null
      ? "unavailable"
      : !family && !org
        ? "loading"
        : frame?.kind === "class" && resources.year === undefined
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
  const home =
    status !== "unavailable" && orgId && classId
      ? `school/${orgId}/classes/${classId}/today`
      : null;
  const practices =
    !!learner &&
    relation === "holder" &&
    me?.family.learners.find((entry) => entry.id === learner.id)
      ?.learningAllowed !== false;
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
            // A second parent's children practice from the family's Today
            // ("Let … practice here"), never as hers.
            ...(practices
              ? [
                  {
                    // Never "Practice": that is the adult's own, in My
                    // practice. This is the child's, as on Today.
                    id: "practice",
                    label: `Let ${learner!.name} practice`,
                    path: "practice",
                    icon: "learn" as const,
                    search: { learner: learner!.id },
                    current: frame?.kind === "practice",
                  },
                ]
              : []),
            ...(learner
              ? [
                  {
                    id: "progress",
                    label: `${learner.name}’s progress`,
                    path: "overview",
                    icon: "level" as const,
                    search: { learner: learner.id },
                    current: frame?.kind === "progress",
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
  const status: Resolution =
    resources.org === null ||
    (onClass && (year === null || !boundTo(year, orgId)))
      ? "unavailable"
      : !org || (onClass && year === undefined)
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
    (!year?.can || year.can.includes("signin.read")) &&
    (demo || (resources.covered ?? 0) > 0);
  const tabs =
    status !== "ready" || !org
      ? []
      : onClass
        ? classroomTabs(org.id, frame.classId, { past })
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
