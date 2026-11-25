import type { AuthSession } from "../auth";
import type { OrgResource } from "../../schools/contracts";
import {
  classesOptions,
  orgOptions,
  orgsOptions,
  preload,
} from "../features/school/core-api";
import {
  orgHome,
  setupPath,
  setupSteps,
  type SetupStep,
} from "../features/school/paths";
import { meOptions, queryClient } from "../lib/query";
import { OPEN_KEY } from "../nav/entities";
import {
  admit,
  elsewhere,
  elsewhereOnce,
  requireSignedIn,
} from "./sign-in-gate";

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
const staffSession = (location: { pathname: string; searchStr: string }) =>
  requireSignedIn(location, { web: true, adults: true, back: "here" });

/** A read whose failure leaves the guard on its fallback, logged. */
const logged =
  <T>(what: string, fallback: T) =>
  (error: unknown): T => {
    console.warn(`${what} didn’t load`, error);
    return fallback;
  };
export const staffScreen = async ({
  location,
}: {
  location: { pathname: string; searchStr: string };
}) => ({ session: await staffSession(location) });

/** A school-level page a family org (a family's or a tutor's) doesn't have
 * (docs/design/ia.md: a family never lands on one). It opens the family's
 * own equivalent instead, in its one class: Students is its People, Standing
 * its Map, Staff its People and Settings its Settings. Pages with no class
 * equivalent open Today. Student layers come along. (A parent's own family
 * org's pages are app/legacy-aliases.ts rows, to the family's address.) */
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
    const org = await queryClient
      .ensureQueryData(orgOptions(session, orgId))
      .catch(logged("The school", null));
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
    const path = `/school/${orgId}/classes/${klass.id}/${leaf}`;
    return elsewhere(
      typeof open === "string"
        ? `${path}?${new URLSearchParams({ [OPEN_KEY]: open })}`
        : path,
    );
  };

/** `/school/<org>/calendar`: a school's year is its Calendar tab; a
 * family's, or a one-class school's, is its class's Settings (the school's
 * own Settings while it has no class yet). */
export const calendar = async (context: {
  location: { pathname: string; searchStr: string; search: unknown };
  params: unknown;
}) => {
  const result = await familyEquivalent("settings")(context);
  const orgId = (context.params as { org: string }).org;
  const org = await queryClient
    .ensureQueryData(orgOptions(result.session, orgId))
    .catch(logged("The school", null));
  if (org?.solo !== true) return result;
  const classes = await queryClient
    .ensureQueryData(classesOptions(result.session, orgId))
    .catch(logged("The school's classes", []));
  return elsewhere(
    classes[0]
      ? `/school/${orgId}/classes/${classes[0].id}/settings`
      : `/school/${orgId}/settings`,
  );
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

/** Where an org opens for this person, decided once: its setup until it
 * is finished; a teacher's, or a lone teacher's one-class school, its
 * classes (one class, its Today, never a list of one); else the overview. */
async function orgLanding(session: AuthSession, org: OrgResource) {
  if (org.setupPending) return orgHome(org).to;
  const classes = await queryClient
    .ensureQueryData(classesOptions(session, org.id))
    .catch(logged("The school's classes", []));
  if (
    !org.can?.includes("overview.read") ||
    (org.solo === true && classes.length <= 1)
  )
    return classes.length === 1
      ? `/school/${org.id}/classes/${classes[0]!.id}/today`
      : `/school/${org.id}/classes`;
  return `/school/${org.id}`;
}

/** `/school`: one school opens it; more choose; none offers setup in place. */
export const chooser = async ({ location }: { location: Location }) => {
  const session = await staffSession(location);
  const orgs = await queryClient.fetchQuery(orgsOptions(session));
  // None yet: the chooser offers class setup in place (no hop). One: where
  // it opens, in this one hop (a family's org as the family).
  if (orgs.length === 1)
    await elsewhereOnce(await orgLanding(session, orgs[0]!));
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
  if (!requested) elsewhere("/start/school");
  // Setup finished: where the school opens, in this one hop.
  if (!requested.setupPending)
    await elsewhereOnce(await orgLanding(session, requested));
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
  if (!allowed) elsewhere(`/${setupPath(orgId, open)}`);
  return { session };
};

/** `/school/invite`: anyone on the web; never a student's device. */
// A student's home is their practice.
export const invite = () => admit({ web: true, adults: true });

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
  // (A parent's own family org is an app/legacy-aliases.ts row.) A school
  // this account can't read: the chooser.
  const org = await queryClient
    .fetchQuery(orgOptions(session, orgId))
    .catch(logged("The school", null));
  if (!org) elsewhere("/school");
  const landing = await orgLanding(session, org);
  if (landing !== `/school/${orgId}`) elsewhere(landing);
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
