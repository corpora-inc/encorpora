import { queryOptions } from "@tanstack/react-query";
import type { SignedInMe } from "../../../account/contracts";
import {
  placesResource,
  type PlacesResource,
  type StaffRole,
} from "../../../schools/contracts";
import type { AuthSession } from "../../auth";
import type { FamilyPlaces } from "../../../family/projection-contracts";
import { call, keyFor } from "../school/api";
import { spaceWords } from "./words";

/** Every place this account works, in one bounded request (docs/architecture
 * /spaces.md, "Place switcher"). Keyed by the account, so another account's
 * answer is never read, and invalidated with the rest of the account. */
export const placesOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: keyFor(session, "places"),
    queryFn: ({ signal }) =>
      call("/places", placesResource, session, { signal }),
  });

export type PlaceId =
  | "home"
  | "me"
  | "level"
  | `school:${string}`
  | `family:${string}`
  | `group:${string}`
  | `class:${string}:${string}`;

export type PlaceEntry = {
  id: PlaceId;
  name: string;
  /** Their role here, or what's next. */
  detail: string;
  /** Its URL path, without the leading slash: empty lets `/` decide. */
  path: string;
  /** A demo place: made-up students, there to explore. */
  demo?: true;
};

export type PlaceGroup = {
  id: "family" | "teaching" | "practice";
  label: string;
  entries: PlaceEntry[];
};

/** How many teaching places show before "More places". */
export const FIRST_PAGE = 6;

const roleName: Record<StaffRole, string> = {
  admin: "Admin",
  teacher: "Teacher",
  aide: "Aide",
  viewer: "Viewer",
};
const roles = (list: readonly StaffRole[]) =>
  (["admin", "viewer", "teacher", "aide"] as const)
    .filter((role) => list.includes(role))
    .map((role) => roleName[role])
    .join(", ");

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Their own family's side: their children, or the way into it. */
function ownFamily(me: SignedInMe): PlaceEntry | null {
  const home =
    me.learners.length > 0 ||
    !!me.familyClass ||
    me.consent.status === "active" ||
    !!me.unassignedPurchase ||
    !!me.availableAccessGrant;
  if (!home) return null;
  const words = spaceWords("family");
  const children = me.learners;
  return {
    id: "home",
    name: me.familyClass?.className ?? "Your family",
    detail:
      children.length === 1
        ? children[0]!.name
        : children.length > 1
          ? count(children.length, words.learner, words.learners)
          : "Getting started",
    path: "family",
  };
}

/**
 * The switcher's places, grouped by space: Family (their own, the families
 * they are a second parent or co-teacher of), Teaching (each school, network
 * or district with their role, the schools below one they oversee, and each
 * class they teach or aide) and My practice. Every place the account may
 * open, with its role; nothing it may not. Without the places read (it
 * failed, or there is none), the schools `/me` names stand in.
 */
export function placeGroups(
  me: SignedInMe,
  places: PlacesResource | null,
  /** The families this account belongs to (`GET /families`), when read:
   * each named as the family is, never by its class. */
  families: FamilyPlaces | null = null,
): PlaceGroup[] {
  const family: PlaceEntry[] = [];
  const groups: PlaceEntry[] = [];
  const known = new Set<string>([
    ...(me.familyClass ? [me.familyClass.orgId] : []),
    ...(me.secondParentOf ?? []).map((shared) => shared.orgId),
  ]);
  if (families && Array.isArray(families.families)) {
    const words = spaceWords("family");
    const children = me.learners;
    for (const entry of families.families) {
      known.add(entry.familyId);
      if (entry.role === "co-teacher") {
        // Someone else's family class this account teaches: a teaching
        // place, its children never theirs.
        groups.push({
          id: `school:${entry.familyId}`,
          name:
            entry.teachingPlace?.displayName ??
            entry.displayName ??
            "Tutoring group",
          detail: "Co-teacher",
          // The class's own org, as the server names it.
          path:
            entry.teachingPlace && entry.orgId
              ? `school/${entry.orgId}/classes/${entry.teachingPlace.classId}/today`
              : `school/${entry.orgId ?? entry.familyId}`,
        });
        continue;
      }
      // A tutor with no children of their own: their group is their place,
      // never an empty family.
      const tutorOnly =
        entry.role === "holder" && !!entry.teachingPlace && !children.length;
      if (!tutorOnly)
        family.push({
          id: entry.role === "holder" ? "home" : `family:${entry.familyId}`,
          // A family without a chosen name is the reader's own: "Your
          // family"; a second parent's is named by its holder.
          name: entry.displayName ?? "Your family",
          detail:
            entry.role === "second-parent"
              ? "Second parent"
              : children.length === 1
                ? children[0]!.name
                : children.length > 1
                  ? count(children.length, words.learner, words.learners)
                  : "Getting started",
          path: `family/${entry.familyId}`,
        });
      // Other families' children in this family's class: a tutoring group,
      // a teaching place of its own, never mixed into the family.
      if (entry.teachingPlace) {
        // Its class's classroom, under the org that holds it (a family's id
        // need not be that org); the family's group address redirects there.
        const classId = entry.teachingPlace.classId;
        const org =
          entry.classId === classId
            ? entry.orgId
            : me.familyClass?.classId === classId
              ? me.familyClass.orgId
              : me.secondParentOf?.find((shared) => shared.classId === classId)
                  ?.orgId;
        groups.push({
          id: `group:${entry.familyId}`,
          name: "Tutoring group",
          detail: entry.teachingPlace.displayName,
          path: org
            ? `school/${org}/classes/${classId}/today`
            : `family/${entry.familyId}/group`,
        });
      }
    }
  } else {
    const own = ownFamily(me);
    if (own) family.push(own);
    for (const shared of me.secondParentOf ?? [])
      family.push({
        id: `family:${shared.orgId}`,
        name: shared.className,
        detail: "Second parent",
        path: `family/${shared.orgId}`,
      });
  }
  const orgs =
    places?.orgs ??
    (me.staffOf ?? []).map((org) => ({
      id: org.orgId,
      kind: "school" as const,
      name: org.orgName,
      roles: [org.role],
      lone: false,
      ...(org.setupPending ? { setupPending: true } : {}),
      ...(org.demo ? { demo: true as const } : {}),
    }));
  const teaching: PlaceEntry[] = [...groups];
  const classes = [...(places?.classes ?? [])];
  for (const org of orgs) {
    if (known.has(org.id)) continue;
    const demo = org.demo ? { demo: true as const } : {};
    if (org.kind === "family") {
      // A family's class this account teaches: the family's place, theirs to
      // teach, its children never theirs.
      family.push({
        id: `school:${org.id}`,
        name: org.name,
        detail: "Co-teacher",
        path: `school/${org.id}`,
        ...demo,
      });
      continue;
    }
    const mine = classes.filter((klass) => klass.orgId === org.id);
    for (const klass of mine) classes.splice(classes.indexOf(klass), 1);
    // A one-class school is that class (docs/design/ia.md).
    if (org.lone && mine.length === 1) {
      teaching.push({
        id: `class:${org.id}:${mine[0]!.id}`,
        name: mine[0]!.name,
        detail: roleName[mine[0]!.role],
        path: `school/${org.id}/classes/${mine[0]!.id}/today`,
        ...demo,
      });
      continue;
    }
    teaching.push({
      id: `school:${org.id}`,
      name: org.name,
      detail: org.setupPending ? "Finish setting up" : roles(org.roles),
      path: `school/${org.id}`,
      ...demo,
    });
    for (const school of places?.schools ?? [])
      if (school.parentId === org.id)
        teaching.push({
          id: `school:${school.id}`,
          name: school.name,
          detail: `${roles(org.roles)}, ${org.name}`,
          path: `school/${school.id}`,
          ...(school.demo ? { demo: true as const } : {}),
        });
    for (const klass of mine)
      teaching.push({
        id: `class:${org.id}:${klass.id}`,
        name: klass.name,
        detail: roleName[klass.role],
        path: `school/${org.id}/classes/${klass.id}/today`,
        ...demo,
      });
  }
  // Schools further down a district, and classes at a school reached
  // through a role above it.
  for (const school of places?.schools ?? [])
    if (!teaching.some((entry) => entry.id === `school:${school.id}`))
      teaching.push({
        id: `school:${school.id}`,
        name: school.name,
        detail: "School",
        path: `school/${school.id}`,
        ...(school.demo ? { demo: true as const } : {}),
      });
  for (const klass of classes)
    teaching.push({
      id: `class:${klass.orgId}:${klass.id}`,
      name: klass.name,
      detail: `${roleName[klass.role]}, ${klass.orgName}`,
      path: `school/${klass.orgId}/classes/${klass.id}/today`,
      ...(klass.demo ? { demo: true as const } : {}),
    });
  const practice: PlaceEntry[] = [
    ...(me.adultPractice?.learner
      ? [
          {
            id: "me" as const,
            name: "My practice",
            // Never their own name back to them (docs/design/ia.md).
            detail: "Your levels and practice",
            path: "me",
          },
        ]
      : me.adultPractice?.eligible
        ? [
            {
              id: "me" as const,
              name: "Start my own practice",
              detail: "Free for you",
              path: "me/start",
            },
          ]
        : []),
    {
      id: "level",
      name: "Practice at a level",
      detail: "Any grade, any pace",
      path: "me/profiles/new",
    },
  ];
  return [
    { id: "family" as const, label: "Family", entries: family },
    { id: "teaching" as const, label: "Teaching", entries: teaching },
    { id: "practice" as const, label: "My practice", entries: practice },
  ].filter((group) => group.entries.length > 0);
}

/** The place switcher's entry for where the screen is: the place itself,
 * else the school a class belongs to, else none. */
export function currentPlace(
  groups: readonly PlaceGroup[],
  place: string | null,
): PlaceEntry | null {
  if (!place) return null;
  const all = groups.flatMap((group) => group.entries);
  const exact = all.find((entry) => entry.id === place);
  if (exact) return exact;
  const klass = /^class:([^:]+):/.exec(place);
  return klass
    ? (all.find((entry) => entry.id === `school:${klass[1]}`) ?? null)
    : null;
}
