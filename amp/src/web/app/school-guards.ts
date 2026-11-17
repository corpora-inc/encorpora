import { redirect } from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import {
  classesOptions,
  orgOptions,
  orgsOptions,
  preload,
} from "../features/school/core-api";
import {
  markSchoolSignup,
  orgHome,
  setupPath,
  setupSteps,
  type SetupStep,
} from "../features/school/paths";
import { meOptions, queryClient, sessionOptions } from "../lib/query";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import { OPEN_KEY, work, writeStack } from "../nav/entities";
import { toFamilyChild, toFamilyPage } from "./family-redirect";

/* What the school's routes decide before a screen paints: who may open it,
   where an old or a family's address opens instead, and what loads with it.
   Loaded only when a school address is opened (app/school-routes.tsx keeps
   the route table, in the app's entry, to paths and lazy screens). */

const api = () => import("../features/school/api");
const orgApi = () => import("../features/school/org/org-api");
const standingApi = () => import("../features/school/standing/standing-api");

type Location = { pathname: string; searchStr: string; search: unknown };

/** Staff screens: signed in, on the web, and not a student's device. A signed-out
 * visitor goes through the usual sign-in and comes straight back here. */
async function staffSession(location: {
  pathname: string;
  searchStr: string;
}): Promise<AuthSession> {
  if (nativeRuntime) throw redirect({ to: "/", replace: true });
  if (studentSession())
    throw redirect({ to: "/$", params: { _splat: "practice" }, replace: true });
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) {
    markSchoolSignup("1");
    throw redirect({
      to: "/sign-in",
      search: {
        return: "school",
        next: `${location.pathname}${location.searchStr}`,
      } as never,
      replace: true,
    });
  }
  return session;
}
export const staffScreen = async ({
  location,
}: {
  location: { pathname: string; searchStr: string };
}) => ({ session: await staffSession(location) });

/** A school-level page a family org (a family's or a tutor's) doesn't have
 * (docs/design/ia.md: a family never lands on one). An old link opens the
 * family's own equivalent instead, in its one class: Students is its People,
 * Standing its Map, Staff its People and Settings its Settings. Pages with
 * no class equivalent open Today. Student layers come along. */
export const familyEquivalent =
  (leaf: "roster" | "map" | "settings" | "today") =>
  async ({
    location,
    params,
  }: {
    location: { pathname: string; searchStr: string; search: unknown };
    params: unknown;
  }) => {
    const session = await staffSession(location);
    const { org: orgId, class: classId } = params as {
      org: string;
      class?: string;
    };
    // A parent's own family: its own screen, by the one return contract.
    await toFamilyPage(session, orgId, leaf, location as never, classId);
    const org = await queryClient
      .ensureQueryData(orgOptions(session, orgId))
      .catch(() => null);
    if (org?.kind !== "family") return { session };
    const classes = await queryClient.ensureQueryData(
      classesOptions(session, orgId),
    );
    // The class the address names, or the family's one class; never the
    // first of several.
    const klass = classId
      ? classes.find((entry) => entry.id === classId)
      : classes.length === 1
        ? classes[0]
        : undefined;
    // A failed or empty class lookup must not redirect back to /classes,
    // which uses this same guard. Let the route's error view offer a retry.
    if (!klass)
      throw new Error("The class is unavailable. Reload to try again.");
    const open = (location.search as Record<string, unknown>)[OPEN_KEY];
    throw redirect({
      to: `/school/${orgId}/classes/${klass.id}/${leaf}`,
      search: typeof open === "string" ? { [OPEN_KEY]: open } : {},
      replace: true,
    } as never);
  };

/** The frame's data, loaded with the screen so its navigation is whole. */
export async function frameData(session: AuthSession, orgId: string) {
  await Promise.all([
    preload(orgOptions(session, orgId)),
    preload(classesOptions(session, orgId)),
    preload(orgsOptions(session)),
    // The place switcher's list, so the rail is whole on its first paint.
    preload(meOptions(session)),
  ]);
}

/** `/school`: one school opens it; more choose; none offers setup in place. */
export const chooser = async ({ location }: { location: Location }) => {
  const session = await staffSession(location);
  const orgs = await queryClient.fetchQuery(orgsOptions(session));
  // None yet: the chooser offers class setup in place (no hop).
  if (orgs.length === 1)
    throw redirect({ ...orgHome(orgs[0]!), replace: true } as never);
};

/** `/school/new`: guided setup, for the admin of a school we issued. */
export const setup = async ({ location }: { location: Location }) => {
  const search = location.search as { org?: unknown; step?: unknown };
  const signedIn = await queryClient.ensureQueryData(sessionOptions);
  // A setup link from earlier: sign in, then carry on with it.
  if (!signedIn && typeof search.org !== "string")
    throw redirect({ to: "/schools", replace: true });
  const session = await staffSession(location);
  const orgId =
    typeof search.org === "string"
      ? search.org
      : (await queryClient.fetchQuery(orgsOptions(session))).find(
          (org) => org.setupPending && org.roles.includes("admin"),
        )?.id;
  // Signed in with nothing to set up: the school first run, which knows
  // what this account has and offers its next step.
  if (!orgId)
    throw redirect({
      to: "/start/$choice",
      params: { choice: "school" },
      replace: true,
    } as never);
  // The step's own address, in one hop (setupStep checks it).
  const step = setupSteps.find((entry) => entry === search.step);
  throw redirect({ to: `/${setupPath(orgId, step)}`, replace: true } as never);
};

/** `/school/<org>/setup[/<step>[/names]]`: guided setup, one step an
 * address, for the admin of a school we issued. A step not yet reachable
 * opens the first one not answered; a finished setup opens the school. */
export const setupStep = async ({
  location,
  params,
}: {
  location: Location;
  params: unknown;
}) => {
  const session = await staffSession(location);
  const {
    org: orgId,
    step,
    method,
  } = params as { org: string; step?: string; method?: string };
  const orgs = await queryClient.fetchQuery(orgsOptions(session));
  // Setup is its admin's: anyone else's address for it is their first run,
  // never a setup they can't make.
  const requested = orgs.find(
    (org) =>
      org.id === orgId && (!org.setupPending || org.roles.includes("admin")),
  );
  if (!requested)
    throw redirect({
      to: "/start/$choice",
      params: { choice: "school" },
      replace: true,
    } as never);
  if (!requested.setupPending)
    throw redirect({ ...orgHome(requested), replace: true } as never);
  const [state] = await Promise.all([
    api().then((m) =>
      queryClient.fetchQuery(m.setupOptions(session, requested.id)),
    ),
    preload(meOptions(session)),
  ]);
  // The first thing not yet answered; a later step waits for it.
  const open: SetupStep = !state.calendar
    ? "calendar"
    : !state.experience
      ? "experience"
      : !state.agreement
        ? "agreement"
        : "students";
  const asked = setupSteps.find((entry) => entry === (step ?? "school"));
  const allowed =
    !!asked &&
    setupSteps.indexOf(asked) <= setupSteps.indexOf(open) &&
    (method === undefined || (asked === "students" && method === "names"));
  if (!allowed)
    throw redirect({
      to: `/${setupPath(orgId, open)}`,
      replace: true,
    } as never);
  return { session };
};

/** `/school/invite`: anyone on the web; never a student's device. */
export const invite = () => {
  if (nativeRuntime) throw redirect({ to: "/", replace: true });
  // A student's home is their practice.
  if (studentSession())
    throw redirect({
      to: "/$",
      params: { _splat: "practice" },
      replace: true,
    });
};

/** `/school/<org>`: a head or district reads the overview; a teacher, and a
 * lone teacher's one-class school, go straight to their classes. */
export const orgIndex = async ({
  location,
  params,
}: {
  location: Location;
  params: unknown;
}) => {
  const session = await staffSession(location);
  const orgId = (params as unknown as { org: string }).org;
  // A parent's own family org: the family's Today.
  await toFamilyPage(session, orgId, "today", location as never);
  const org = await queryClient
    .fetchQuery(orgOptions(session, orgId))
    .catch(() => null);
  if (!org) throw redirect({ to: "/school", replace: true } as never);
  if (org.setupPending)
    throw redirect({ ...orgHome(org), replace: true } as never);
  const classes = await queryClient
    .ensureQueryData(classesOptions(session, orgId))
    .catch(() => []);
  if (
    !org.can?.includes("overview.read") ||
    (org.solo === true && classes.length <= 1)
  )
    throw redirect({
      // One class opens on its Today, never on a list of one.
      to:
        classes.length === 1
          ? `/school/${orgId}/classes/${classes[0]!.id}/today`
          : `/school/${orgId}/classes`,
      replace: true,
    } as never);
  return { session };
};
export const orgIndexData = async ({
  context,
  params,
}: {
  context: unknown;
  params: unknown;
}) => {
  const { session } = context as unknown as { session: AuthSession };
  const orgId = (params as unknown as { org: string }).org;
  await Promise.all([
    frameData(session, orgId),
    orgApi().then((m) => preload(m.overviewOptions(session, orgId))),
    standingApi().then((m) => preload(m.orgStandingOptions(session, orgId))),
  ]);
};

/** A school-level student page from before layers: a student layer over the
 * school's Students (a family's child: their own page). */
export const student = async ({
  params,
  search,
  location,
}: {
  params: unknown;
  search: unknown;
  location: Location;
}) => {
  const { org, student } = params as unknown as {
    org: string;
    student: string;
  };
  // A family's child: their own page.
  await toFamilyChild(
    await staffSession(location),
    org,
    student,
    null,
    location as never,
  );
  throw redirect({
    to: `/school/${org}/students`,
    search: {
      ...(search as Record<string, unknown>),
      [OPEN_KEY]: writeStack([{ kind: "student", id: student }]),
    },
    replace: true,
  } as never);
};
export const studentWork = async ({
  params,
  search,
  location,
}: {
  params: unknown;
  search: unknown;
  location: Location;
}) => {
  const {
    org,
    student,
    work: attempt,
  } = params as unknown as {
    org: string;
    student: string;
    work: string;
  };
  await toFamilyChild(
    await staffSession(location),
    org,
    student,
    attempt,
    location as never,
  );
  throw redirect({
    to: `/school/${org}/students`,
    search: {
      ...(search as Record<string, unknown>),
      [OPEN_KEY]: writeStack([
        { kind: "student", id: student },
        work(student, attempt),
      ]),
    },
    replace: true,
  } as never);
};
