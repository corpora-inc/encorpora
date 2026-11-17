import { createRoute, redirect, type AnyRoute } from "@tanstack/react-router";
import { lazyRouteComponent } from "../lib/lazy-route-component";
import type { AuthSession } from "../auth";
import { orgOptions, preload } from "../features/school/core-api";

/* A screen's own reads come from the school's API chunks, loaded with the
   screen: the route table, in the app's entry, carries only the shell's
   (core-api.ts; scripts/check-bundle-budget.ts). */
const api = () => import("../features/school/api");
const orgApi = () => import("../features/school/org/org-api");
const standingApi = () => import("../features/school/standing/standing-api");

/** A guard or loader, from school-guards.ts: loaded when a school address
 * opens, so the route table in the app's entry carries none of it. */
const guards = () => import("./school-guards");
type Guards = Awaited<ReturnType<typeof guards>>;
const guard =
  <K extends Exclude<keyof Guards, "familyEquivalent" | "frameData">>(
    name: K,
  ) =>
  (context: unknown) =>
    guards().then((m) =>
      (m[name] as (context: never) => unknown)(context as never),
    );
const familyEquivalent =
  (leaf: "roster" | "map" | "settings" | "today") => (context: unknown) =>
    guards().then((m) => m.familyEquivalent(leaf)(context as never));

/** Staff screens: signed in, on the web, and not a student's device. */
export const staffScreen = (context: {
  location: { pathname: string; searchStr: string };
}) => guards().then((m) => m.staffScreen(context));
/** The frame's data, loaded with the screen so its navigation is whole. */
export const frameData = (session: AuthSession, orgId: string) =>
  guards().then((m) => m.frameData(session, orgId));

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
      staticData: { space: "school" },
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
    staticData: { space: "school" },
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
    license: screen(
      () => import("../features/school/LicenseScreen"),
      "LicenseScreen",
    ),
  };
  /** An address from before Settings: it opens that section of Settings. */
  const toSettings = (path: string, hash: string) =>
    createRoute({
      getParentRoute: () => root,
      path: `/school/$org${path}`,
      staticData: { space: "school" },
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
      path: "/school",
      staticData: { space: "account" },
      beforeLoad: guard("chooser"),
      component: screen(
        () => import("../features/school/ChooserScreen"),
        "ChooserScreen",
      ),
    }),
    // Guided setup, for the admin of a school we issued. Their invitation is
    // how they arrive; without one there's nothing to set up, so a visitor
    // goes to `/schools`, which says how a school starts, and someone signed
    // in to their school first run.
    createRoute({
      getParentRoute: () => root,
      path: "/school/new",
      staticData: { space: "account" },
      beforeLoad: guard("setup"),
      component: setup,
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/invite",
      staticData: { space: "public" },
      beforeLoad: guard("invite"),
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
        beforeLoad: guard("orgIndex"),
        loader: guard("orgIndexData"),
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
      (session, orgId) => [
        standingApi().then((m) =>
          preload(m.orgStandingOptions(session, orgId)),
        ),
      ],
      "map",
    ),
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/standing/$class",
      staticData: {
        space: "school",
        // A class's drill over the school's curves: it keeps their view.
        overList: true,
      },
      beforeLoad: familyEquivalent("map"),
      loader: async ({ context, params }) => {
        const { session } = context as unknown as { session: AuthSession };
        const { org: orgId, class: classId } = params as unknown as {
          org: string;
          class: string;
        };
        await Promise.all([
          frameData(session, orgId),
          standingApi().then((m) =>
            preload(m.classStandingOptions(session, classId)),
          ),
        ]);
      },
      component: screens.classStanding,
    }),
    orgScreen("/schools", screens.schools, (session, orgId) => [
      orgApi().then((m) => preload(m.schoolsOptions(session, orgId))),
    ]),
    // The new year's steps, each at its own address: `/year` (dates), then
    // `/year/classes`, `/year/grades` and `/year/review`.
    orgScreen("/year", screens.rollover, (session, orgId) => [
      orgApi().then((m) => preload(m.rolloverOptions(session, orgId))),
    ]),
    orgScreen("/year/$step", screens.rollover, (session, orgId) => [
      orgApi().then((m) => preload(m.rolloverOptions(session, orgId))),
    ]),
    orgScreen("/integrations", screens.integrations, (session, orgId) => [
      orgApi().then((m) => preload(m.integrationsOptions(session, orgId))),
    ]),
    orgScreen("/privacy", screens.privacy, (session, orgId) => [
      orgApi().then((m) => preload(m.privacyOptions(session, orgId))),
    ]),
    orgScreen("/activity", screens.activity),
    orgScreen("/classes", screens.classes, (session, orgId) => [
      orgApi().then((m) => preload(m.yearsOptions(session, orgId))),
    ]),
    orgScreen("/students", screens.students, undefined, "roster"),
    // The school-level student page from before layers, and one of their
    // answers on it: a student layer over the school's Students, as the
    // class map's old addresses redirect (nav/entities.ts).
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/students/$student",
      staticData: { space: "school" },
      beforeLoad: guard("student"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org/students/$student/work/$work",
      staticData: { space: "school" },
      beforeLoad: guard("studentWork"),
    }),
    orgScreen(
      "/staff",
      screens.staff,
      (session, orgId) => [
        api().then((m) => preload(m.staffOptions(session, orgId))),
      ],
      "roster",
    ),
    orgScreen("/sign-in-help", screens.help, (session, orgId) => [
      api().then((m) => preload(m.signInHelpOptions(session, orgId))),
    ]),
    orgScreen(
      "/calendar",
      screens.calendar,
      (session, orgId) => [
        api().then((m) => preload(m.calendarOptions(session, orgId))),
      ],
      "settings",
    ),
    // Every section before the page paints, so a section never arrives
    // late and pushes the ones below it (the license, opened by its hash).
    orgScreen(
      "/settings",
      screens.settings,
      (session, orgId) => [
        import("../features/school/classroom/api").then(
          ({ experienceOptions, weeklyTargetOptions }) =>
            Promise.all([
              preload(experienceOptions(session, { kind: "org", id: orgId })),
              // The first section: arriving late, it pushed every one below.
              preload(weeklyTargetOptions(session, orgId)),
            ]),
        ),
      ],
      "settings",
    ),
    // Only a license this person can read: a teacher's own pilot school has
    // none to show, and asking would only be refused.
    orgScreen("/license", screens.license, (session, orgId) => [
      preload(orgOptions(session, orgId)).then((org) =>
        (org as { can?: string[] } | undefined)?.can?.includes("license.read")
          ? api().then((m) => preload(m.licenseOptions(session, orgId)))
          : undefined,
      ),
    ]),
    orgScreen("/import", screens.importer),
    orgScreen("/import/$step", screens.importer),
    toSettings("/experience", "student-experience"),
  ];
}
