import { useQueries, useQuery } from "@tanstack/react-query";
import { sessionOptions } from "../../lib/query";
import { classesOptions, orgOptions, orgsOptions } from "../school/api";
import { schoolsOptions } from "../school/org/org-api";
import { useNavigate } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import { useLearnerStore } from "../../learner-store";
import { Menu, MenuItem, MenuLabel } from "../../ui/Menu";
import { familyClassPath, placesFor, type PlaceId } from "../onboarding/guard";
import { rememberPlace } from "../onboarding/place-memory";
import { DemoMark } from "../school/demo/DemoMark";
import { levelsRange } from "../../../learning/practice-profiles";
import styles from "./PlaceSwitcher.module.css";

const roleNames = {
  admin: "Admin",
  teacher: "Teacher",
  aide: "Aide",
  viewer: "Viewer",
} as const;

export type PlaceEntry = {
  id:
    | PlaceId
    | `class:${string}:${string}`
    | `learner:${string}`
    | `profile:${string}`
    | "try-level";
  name: string;
  /** The role here, or what's next. */
  detail: string;
  /** Its URL path, without the leading slash: `/` decides the family side. */
  path: string;
  /** A demo place: made-up students, there to explore. */
  demo?: true;
};

/** Every place this account can open, named for the switcher. Under "My
 * practice" come the adult's practice profiles and "Try a level…"
 * (features/profiles). */
export function placeEntries(me: SignedInMe): PlaceEntry[] {
  return placesFor(me).flatMap((id): PlaceEntry[] =>
    id === "me" ? [place(me, id), ...profileEntries(me)] : [place(me, id)],
  );
}

/** Practicing as someone else: each saved profile, then a new one. */
function profileEntries(me: SignedInMe): PlaceEntry[] {
  return [
    ...(me.practiceProfiles ?? []).map((profile) => ({
      id: `profile:${profile.id}` as const,
      name: profile.label,
      detail: `Practice as · ${levelsRange(profile.levels)}`,
      path: "practice",
    })),
    {
      id: "try-level" as const,
      name: "Try a level…",
      detail: "Practice at any grade and pace",
      path: "me/profiles/new",
    },
  ];
}

function place(me: SignedInMe, id: PlaceId): PlaceEntry {
  // A family's side is its class, which the parent teaches.
  if (id === "home" && me.familyClass)
    return {
      id,
      name: me.familyClass.className,
      detail:
        me.learners.length === 1
          ? me.learners[0]!.name
          : `${me.learners.length} students`,
      path: familyClassPath(me.familyClass).replace(/^\//, ""),
    };
  if (id === "home")
    return {
      id,
      name: "Family and practice",
      detail:
        me.learners.length === 1
          ? me.learners[0]!.name
          : me.learners.length > 1
            ? `${me.learners.length} learners`
            : "Getting started",
      path: "",
    };
  if (id === "me") {
    // Their own learner, by their name; or the way to start one.
    const own = me.adultPractice?.learner;
    return own
      ? {
          id,
          name: "My practice",
          detail: own.name,
          path: "me",
        }
      : {
          id,
          name: "Start my own practice",
          detail: "Free for you",
          path: "me/start",
        };
  }
  const org = me.staffOf!.find((entry) => `school:${entry.orgId}` === id)!;
  return {
    id,
    name: org.orgName,
    detail: org.setupPending ? "Finish setting up" : roleNames[org.role],
    path: `school/${org.orgId}`,
    ...(org.demo ? { demo: true as const } : {}),
  };
}

/** The same switcher also lists the classes returned by each permitted org. */
export function usePlaceEntries(me: SignedInMe | null, currentOrg?: string) {
  const session = useQuery(sessionOptions).data;
  const auth = session ?? { accountId: "", token: "" };
  const orgsQuery = useQuery({
    ...orgsOptions(auth),
    enabled:
      !!session && !!me?.staffOf?.length && me.account.kind !== "student",
    refetchOnMount: false,
  });
  const schools = orgsQuery.data ?? [];
  const currentQuery = useQuery({
    ...orgOptions(auth, currentOrg ?? ""),
    enabled: !!session && !!currentOrg,
    refetchOnMount: false,
  });
  const current = currentQuery.data;
  const districts = schools.filter(
    (org) => org.kind === "district" || org.kind === "network",
  );
  const permissions = useQueries({
    queries: districts.map((org) => ({
      ...orgOptions(auth, org.id),
      refetchOnMount: false,
    })),
  });
  const descendantQueries = useQueries({
    queries: districts.map((org, index) => ({
      ...schoolsOptions(auth, org.id),
      enabled:
        permissions[index]?.data?.can?.includes("overview.read") === true,
      refetchOnMount: false,
    })),
  });
  const descendants = descendantQueries.flatMap(
    (result) => result.data?.schools ?? [],
  );
  const namedSchools = [
    ...schools.filter((org) => org.kind !== "family"),
    ...(current && current.kind !== "family" ? [current] : []),
    ...descendants,
  ];
  const classOrgs =
    current && !schools.some((org) => org.id === current.id)
      ? [current, ...schools]
      : schools;
  const lists = useQueries({
    queries: classOrgs.map((org) => ({
      ...classesOptions(auth, org.id),
      enabled: !!session,
      refetchOnMount: false,
    })),
  });
  const entries =
    me && me.account.kind !== "student"
      ? placeEntries(me).filter(
          (entry) =>
            !schools.some(
              (org) => org.kind === "family" && entry.id === `school:${org.id}`,
            ),
        )
      : [];
  for (const org of namedSchools) {
    if (!entries.some((entry) => entry.id === `school:${org.id}`))
      entries.push({
        id: `school:${org.id}`,
        name: org.name,
        detail: "School",
        path: `school/${org.id}`,
        ...("demo" in org && org.demo ? { demo: true as const } : {}),
      });
  }
  for (const [index, org] of classOrgs.entries()) {
    for (const klass of lists[index]?.data ?? []) {
      const id = `class:${klass.orgId}:${klass.id}` as const;
      if (
        klass.id === me?.familyClass?.classId ||
        entries.some((entry) => entry.id === id)
      )
        continue;
      entries.push({
        id,
        name: klass.name,
        detail:
          namedSchools.find((school) => school.id === klass.orgId)?.name ??
          org.name,
        path: `school/${klass.orgId}/classes/${klass.id}/today`,
        ...(org.demo ? { demo: true as const } : {}),
      });
    }
  }
  for (const learner of me?.account.kind !== "student"
    ? (me?.learners ?? [])
    : [])
    entries.push({
      id: `learner:${learner.id}`,
      name: learner.name,
      detail: "Learner",
      path: "overview",
    });
  // The children of a family this account is the second parent of: their
  // progress, by their family's class.
  for (const family of me?.account.kind !== "student"
    ? (me?.secondParentOf ?? [])
    : [])
    for (const learner of family.learners)
      entries.push({
        id: `learner:${learner.id}`,
        name: learner.name,
        detail: family.className,
        path: "overview",
      });
  return {
    entries,
    currentOrg: current,
    loading:
      orgsQuery.isLoading ||
      currentQuery.isLoading ||
      [...permissions, ...descendantQueries, ...lists].some(
        (query) => query.isLoading,
      ),
  };
}

/** Choosing a place chooses its learner: the adult's own for their practice,
 * and the family's first for the family side, unless one of theirs already is. */
export function choosePlaceLearner(me: SignedInMe, place: PlaceId) {
  const store = useLearnerStore.getState();
  const own = me.adultPractice?.learner?.id ?? null;
  if (place === "me" && own) store.select(own);
  else if (
    place === "home" &&
    !me.learners.some((learner) => learner.id === store.learnerId)
  )
    store.select(me.learners[0]?.id ?? null);
}

/**
 * The one way between the places a person works: their family and practice
 * side, their own practice, and each school with their role there. It lists
 * only places this account can open, then "Add a place" (the starter).
 * Choosing a place remembers it, so `/` opens there next time.
 */
export function PlaceSwitcher({
  me,
  current,
  label,
  onNavigate,
  entries,
}: {
  me: SignedInMe;
  /** The place on screen now. */
  current: PlaceEntry["id"] | null;
  entries?: PlaceEntry[];
  /** The trigger's text, when the screen names its place more exactly (a
   * school within the district this person works for, say). */
  label?: string;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const places = entries ?? placeEntries(me);
  // One place still shows the menu: it is where another place is added.
  if (!places.length) return null;
  const here = places.find((place) => place.id === current);
  const name = label ?? here?.name ?? "Your places";
  return (
    <Menu
      align="start"
      aria-label={`${name}: switch place`}
      triggerClassName={styles.trigger}
      label={
        <span className={styles.triggerLabel}>
          <span className={styles.triggerText} title={name}>
            {name}
          </span>
          {here?.demo && <DemoMark />}
        </span>
      }
    >
      <MenuLabel>Your places</MenuLabel>
      {places.map((place) => {
        const isHere = place.id === current;
        return (
          <MenuItem
            key={place.id}
            onSelect={() => {
              if (isHere) return;
              if (place.id.startsWith("learner:"))
                useLearnerStore.getState().select(place.id.slice(8));
              // A profile is practiced as; trying a level is a step on the
              // way to one. Neither is a place `/` returns to.
              else if (place.id.startsWith("profile:"))
                useLearnerStore.getState().select(place.id.slice(8));
              else if (
                place.id !== "try-level" &&
                !place.id.startsWith("class:")
              )
                choosePlaceLearner(me, place.id as PlaceId);
              // Starting is a step on the way there; the place is theirs once
              // they have it.
              if (
                place.path !== "me/start" &&
                place.id !== "try-level" &&
                !place.id.startsWith("profile:") &&
                !place.id.startsWith("learner:") &&
                !place.id.startsWith("class:")
              )
                rememberPlace(me.account.id, place.id as PlaceId);
              onNavigate?.();
              void navigate(
                place.path
                  ? { to: "/$", params: { _splat: place.path } }
                  : { to: "/" },
              );
            }}
          >
            <span className={styles.item} data-place={place.id}>
              <span className={styles.nameLine}>
                <span className={styles.name}>{place.name}</span>
                {place.demo && <DemoMark />}
              </span>
              <span className={styles.detail}>
                {place.detail}
                {isHere && <span className={styles.hidden}>, open now</span>}
              </span>
            </span>
            <svg
              className={styles.check}
              viewBox="0 0 16 16"
              aria-hidden="true"
              data-here={isHere || undefined}
            >
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          </MenuItem>
        );
      })}
      <MenuItem
        onSelect={() => {
          onNavigate?.();
          void navigate({ to: "/start" });
        }}
      >
        <span className={styles.item} data-place="add">
          <span className={styles.name}>Add a place</span>
          <span className={styles.detail}>
            Your own practice, a family or a class
          </span>
        </span>
      </MenuItem>
    </Menu>
  );
}
