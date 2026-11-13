import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import { meOptions, queryClient, sessionOptions } from "../lib/query";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import { OPEN_KEY, work, writeStack } from "../nav/entities";
import type { AuthSession } from "../auth";
import { z } from "zod";
import { prepareBuyerHandoff } from "../features/school/pilots/buyer-session";
import { prepareSchoolAdoption } from "../features/school/adoption-session";
import {
  calendarOptions,
  classesOptions,
  licenseOptions,
  orgOptions,
  orgsOptions,
  preload,
  setupOptions,
  signInHelpOptions,
  staffOptions,
} from "../features/school/api";
import {
  integrationsOptions,
  overviewOptions,
  privacyOptions,
  rolloverOptions,
  schoolsOptions,
  yearsOptions,
} from "../features/school/org/org-api";
import {
  classStandingOptions,
  orgStandingOptions,
} from "../features/school/standing/standing-api";
import {
  markSchoolSignup,
  orgHome,
  setupSteps,
  type SetupStep,
} from "../features/school/paths";

/** Staff screens: signed in, on the web, and not a student's device. A signed-out
 * visitor goes through the usual sign-in and comes straight back here. */
async function staffSession(location: {
  pathname: string;
  searchStr: string;
}): Promise<AuthSession> {
  if (nativeRuntime || studentSession())
    throw redirect({ to: "/", replace: true });
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
const familyEquivalent =
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
      .catch(() => null);
    if (org?.kind !== "family") return { session };
    const classes = await queryClient.ensureQueryData(
      classesOptions(session, orgId),
    );
    const klass =
      classes.find((entry) => entry.id === classId) ?? classes.at(0);
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

export function schoolRoutes(root: AnyRoute) {
  const screen = (
    module: () => Promise<Record<string, never> | object>,
    name: string,
  ) => lazyRouteComponent(module as never, name as never);
  const orgScreen = (
    path: string,
    component: ReturnType<typeof screen>,
    load?: (session: AuthSession, orgId: string) => unknown[],
    /** A family org's own page in place of this school-level one. */
    family: "roster" | "map" | "settings" | "today" = "today",
  ) =>
    createRoute({
      getParentRoute: () => root,
      path: `/school/$org${path}`,
      beforeLoad: familyEquivalent(family),
      loader: async ({ context, params }) => {
        const { session } = context as unknown as { session: AuthSession };
        const orgId = (params as unknown as { org: string }).org;
        await Promise.all([
          frameData(session, orgId),
          ...(load?.(session, orgId) ?? []),
        ]);
      },
      component,
    });
  const orgPlace = createRoute({
    getParentRoute: () => root,
    path: "/school/$org",
  });
  // Any other address in a school: not found, in the school's frame.
  const missing = screen(
    () => import("../features/school/MissingScreen"),
    "SchoolMissingScreen",
  );
  const setup = screen(
    () => import("../features/school/SetupScreen"),
    "SetupScreen",
  );
  const org = () => import("../features/school/org");
  const standing = () => import("../features/school/standing");
  const screens = {
    standing: screen(standing, "StandingScreen"),
    classStanding: screen(standing, "ClassStandingScreen"),
    overview: screen(org, "OverviewScreen"),
    schools: screen(org, "SchoolsScreen"),
    rollover: screen(org, "RolloverScreen"),
    integrations: screen(org, "IntegrationsScreen"),
    privacy: screen(org, "PrivacyScreen"),
    activity: screen(org, "ActivityScreen"),
    classes: screen(
      () => import("../features/school/ClassesScreen"),
      "ClassesScreen",
    ),
    students: screen(
      () => import("../features/school/StudentsScreen"),
      "StudentsScreen",
    ),
    staff: screen(
      () => import("../features/school/StaffScreen"),
      "StaffScreen",
    ),
    help: screen(
      () => import("../features/school/StaffScreen"),
      "SignInHelpScreen",
    ),
    calendar: screen(
      () => import("../features/school/CalendarScreen"),
      "CalendarScreen",
    ),
    importer: screen(
      () => import("../features/school/ImportScreen"),
      "ImportScreen",
    ),
    settings: screen(
      () => import("../features/school/SettingsScreen"),
      "OrgSettingsScreen",
    ),
  };
  /** An address from before Settings: it opens that section of Settings. */
  const toSettings = (path: string, hash: string) =>
    createRoute({
      getParentRoute: () => root,
      path: `/school/$org${path}`,
      beforeLoad: ({ params }) => {
        throw redirect({
          to: `/school/${(params as unknown as { org: string }).org}/settings`,
          hash,
          replace: true,
        } as never);
      },
    });
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/school/start",
      beforeLoad: staffScreen,
      validateSearch: (search) => ({
        org: z.uuid().safeParse(search.org).success
          ? String(search.org)
          : undefined,
        return: "school" as const,
        next: "/school/start",
      }),
      loader: async ({ context }) => {
        const { session } = context as unknown as { session: AuthSession };
        await Promise.all([
          preload(meOptions(session)),
          preload(orgsOptions(session)),
        ]);
      },
      component: screen(
        () => import("../features/school/pilots/SchoolStartScreen"),
        "SchoolStartScreen",
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/connect",
      validateSearch: (search) => ({
        error: [
          "clever_identity_already_linked",
          "clever_link_expired",
        ].includes(String(search.error))
          ? search.error
          : undefined,
      }),
      beforeLoad: () => {
        if (nativeRuntime || studentSession())
          throw redirect({ to: "/", replace: true });
      },
      component: screen(
        () => import("../features/school/clever/ConnectionScreen"),
        "ConnectionScreen",
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/adopt",
      validateSearch: (search) => ({
        district: z.uuid().safeParse(search.district).success
          ? String(search.district)
          : undefined,
        manage: search.manage === 1 || search.manage === "1" ? 1 : undefined,
      }),
      beforeLoad: (context) => {
        prepareSchoolAdoption();
        return staffScreen(context);
      },
      component: screen(
        () => import("../features/school/AdoptionScreen"),
        "AdoptionScreen",
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/schools/continue",
      beforeLoad: () => {
        prepareBuyerHandoff();
      },
      component: screen(
        () => import("../features/school/pilots/BuyerHandoffScreen"),
        "BuyerHandoffScreen",
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/classes/$class/import",
      beforeLoad: staffScreen,
      loader: async ({ context, params }) => {
        const { session } = context as unknown as { session: AuthSession };
        await frameData(session, (params as unknown as { org: string }).org);
      },
      component: screens.importer,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school",
      beforeLoad: async ({ location }) => {
        const session = await staffSession(location);
        const orgs = await queryClient.fetchQuery(orgsOptions(session));
        if (orgs.length === 0)
          throw redirect({ to: "/school/start", replace: true } as never);
        if (orgs.length === 1)
          throw redirect({ ...orgHome(orgs[0]!), replace: true } as never);
      },
      component: screen(
        () => import("../features/school/ChooserScreen"),
        "ChooserScreen",
      ),
    }),
    // Guided setup, for the admin of a school we issued. Their invitation is
    // how they arrive; without one there's nothing to set up, so a visitor
    // goes to `/schools`, which says how a school starts.
    createRoute({
      getParentRoute: () => root,
      path: "/school/new",
      beforeLoad: async ({ location }) => {
        const search = location.search as unknown as {
          org?: unknown;
          step?: unknown;
        };
        if (nativeRuntime || studentSession())
          throw redirect({ to: "/", replace: true });
        const signedIn = await queryClient.ensureQueryData(sessionOptions);
        // A setup link from earlier: sign in, then carry on with it.
        if (!signedIn && typeof search.org !== "string")
          throw redirect({ to: "/schools", replace: true });
        const session = await staffSession(location);
        const orgs = await queryClient.fetchQuery(orgsOptions(session));
        const requested =
          typeof search.org === "string"
            ? orgs.find((org) => org.id === search.org)
            : orgs.find(
                (org) => org.setupPending && org.roles.includes("admin"),
              );
        if (!requested) throw redirect({ to: "/schools", replace: true });
        if (!requested.setupPending)
          throw redirect({ ...orgHome(requested), replace: true } as never);
        const [state] = await Promise.all([
          queryClient.fetchQuery(setupOptions(session, requested.id)),
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
        const asked = setupSteps.find((step) => step === search.step);
        const allowed =
          asked && setupSteps.indexOf(asked) <= setupSteps.indexOf(open);
        if (!allowed || search.org !== requested.id)
          throw redirect({
            to: "/school/new",
            search: {
              org: requested.id,
              step: allowed ? asked : open,
            },
            replace: true,
          } as never);
      },
      component: setup,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/invite",
      beforeLoad: () => {
        if (nativeRuntime || studentSession())
          throw redirect({ to: "/", replace: true });
      },
      component: screen(
        () => import("../features/school/InviteScreen"),
        "InviteScreen",
      ),
    }),
    // A school's own address, /school/<org>: the overview at its index, and
    // the in-frame not found for any other single unknown segment. The
    // catch-all is a child, so it never matches the bare address itself.
    orgPlace.addChildren([
      createRoute({
        getParentRoute: () => orgPlace,
        path: "/",
        // A head or district reads the overview here. A teacher, and a lone
        // teacher's one-class school, go straight to their classes: no admin weight.
        beforeLoad: async ({ location, params }) => {
          const session = await staffSession(location);
          const orgId = (params as unknown as { org: string }).org;
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
        },
        loader: async ({ context, params }) => {
          const { session } = context as unknown as { session: AuthSession };
          const orgId = (params as unknown as { org: string }).org;
          await Promise.all([
            frameData(session, orgId),
            preload(overviewOptions(session, orgId)),
            preload(orgStandingOptions(session, orgId)),
          ]);
        },
        component: screens.overview,
      }),
      createRoute({
        getParentRoute: () => orgPlace,
        path: "$",
        beforeLoad: staffScreen,
        loader: async ({ context, params }) => {
          const { session } = context as unknown as { session: AuthSession };
          await frameData(session, (params as unknown as { org: string }).org);
        },
        component: missing,
      }),
    ]),
    // Where students stand: the school's curves, then one class's students.
    orgScreen(
      "/standing",
      screens.standing,
      (session, orgId) => [preload(orgStandingOptions(session, orgId))],
      "map",
    ),
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/standing/$class",
      // A class's drill over the school's curves: it keeps their view.
      staticData: { overList: true },
      beforeLoad: familyEquivalent("map"),
      loader: async ({ context, params }) => {
        const { session } = context as unknown as { session: AuthSession };
        const { org: orgId, class: classId } = params as unknown as {
          org: string;
          class: string;
        };
        await Promise.all([
          frameData(session, orgId),
          preload(classStandingOptions(session, classId)),
        ]);
      },
      component: screens.classStanding,
    }),
    orgScreen("/schools", screens.schools, (session, orgId) => [
      preload(schoolsOptions(session, orgId)),
    ]),
    orgScreen("/year", screens.rollover, (session, orgId) => [
      preload(rolloverOptions(session, orgId)),
    ]),
    orgScreen("/integrations", screens.integrations, (session, orgId) => [
      preload(integrationsOptions(session, orgId)),
    ]),
    orgScreen("/privacy", screens.privacy, (session, orgId) => [
      preload(privacyOptions(session, orgId)),
    ]),
    orgScreen("/activity", screens.activity),
    orgScreen("/classes", screens.classes, (session, orgId) => [
      preload(yearsOptions(session, orgId)),
    ]),
    orgScreen("/students", screens.students, undefined, "roster"),
    // The school-level student page from before layers, and one of their
    // answers on it: a student layer over the school's Students, as the
    // class map's old addresses redirect (nav/entities.ts).
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/students/$student",
      beforeLoad: ({ params, search }) => {
        const { org, student } = params as unknown as {
          org: string;
          student: string;
        };
        throw redirect({
          to: `/school/${org}/students`,
          search: {
            ...(search as Record<string, unknown>),
            [OPEN_KEY]: writeStack([{ kind: "student", id: student }]),
          },
          replace: true,
        } as never);
      },
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/students/$student/work/$work",
      beforeLoad: ({ params, search }) => {
        const {
          org,
          student,
          work: attempt,
        } = params as unknown as {
          org: string;
          student: string;
          work: string;
        };
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
      },
    }),
    orgScreen(
      "/staff",
      screens.staff,
      (session, orgId) => [preload(staffOptions(session, orgId))],
      "roster",
    ),
    orgScreen("/sign-in-help", screens.help, (session, orgId) => [
      preload(signInHelpOptions(session, orgId)),
    ]),
    orgScreen(
      "/calendar",
      screens.calendar,
      (session, orgId) => [preload(calendarOptions(session, orgId))],
      "settings",
    ),
    // Every section before the page paints, so a section never arrives
    // late and pushes the ones below it (the license, opened by its hash).
    orgScreen(
      "/settings",
      screens.settings,
      (session, orgId) => [
        preload(calendarOptions(session, orgId)),
        preload(licenseOptions(session, orgId)),
        import("../features/school/classroom/api").then(
          ({ experienceOptions }) =>
            preload(experienceOptions(session, { kind: "org", id: orgId })),
        ),
      ],
      "settings",
    ),
    toSettings("/license", "license"),
    orgScreen("/import", screens.importer),
    toSettings("/experience", "student-experience"),
  ];
}
