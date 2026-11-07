import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import { queryClient, sessionOptions } from "../lib/query";
import { studentSession } from "../lib/student-device";
import { nativeRuntime } from "../native-runtime";
import type { AuthSession } from "../auth";
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
  markSchoolSignup,
  orgHome,
  setupSteps,
  type SetupStep,
} from "../features/school/paths";

/** Staff screens: signed in, on the web, and not a student's device. A signed-out
 * visitor goes through the usual sign-in and comes straight back here. */
async function staffSession(
  location: { pathname: string; searchStr: string },
  signUpFirst = false,
): Promise<AuthSession> {
  if (nativeRuntime || studentSession())
    throw redirect({ to: "/", replace: true });
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) {
    markSchoolSignup("1");
    throw redirect({
      to: signUpFirst ? "/sign-up" : "/sign-in",
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

/** The frame's data, loaded with the screen so its navigation is whole. */
export async function frameData(session: AuthSession, orgId: string) {
  await Promise.all([
    preload(orgOptions(session, orgId)),
    preload(classesOptions(session, orgId)),
    preload(orgsOptions(session)),
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
  ) =>
    createRoute({
      getParentRoute: () => root,
      path: `/school/$org${path}`,
      beforeLoad: staffScreen,
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
  const setup = screen(
    () => import("../features/school/SetupScreen"),
    "SetupScreen",
  );
  const screens = {
    classes: screen(
      () => import("../features/school/ClassesScreen"),
      "ClassesScreen",
    ),
    students: screen(
      () => import("../features/school/StudentsScreen"),
      "StudentsScreen",
    ),
    student: screen(
      () => import("../features/school/classes/StudentScreen"),
      "StudentScreen",
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
    license: screen(
      () => import("../features/school/LicenseScreen"),
      "LicenseScreen",
    ),
    importer: screen(
      () => import("../features/school/ImportScreen"),
      "ImportScreen",
    ),
  };
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/school",
      beforeLoad: async ({ location }) => {
        const session = await staffSession(location);
        const orgs = await queryClient.fetchQuery(orgsOptions(session));
        if (orgs.length === 0)
          throw redirect({ to: "/school/new", replace: true } as never);
        if (orgs.length === 1)
          throw redirect({ ...orgHome(orgs[0]!), replace: true } as never);
      },
      component: screen(
        () => import("../features/school/ChooserScreen"),
        "ChooserScreen",
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/school/new",
      beforeLoad: async ({ location }) => {
        const session = await staffSession(location, true);
        const search = location.search as unknown as {
          org?: unknown;
          step?: unknown;
        };
        const orgs = await queryClient.fetchQuery(orgsOptions(session));
        const requested =
          typeof search.org === "string"
            ? orgs.find((org) => org.id === search.org)
            : orgs.find((org) => org.setupPending);
        if (!requested) {
          if (search.step && search.step !== "school")
            throw redirect({ to: "/school/new", replace: true } as never);
          return;
        }
        if (!requested.setupPending)
          throw redirect({ ...orgHome(requested), replace: true } as never);
        const state = await queryClient.fetchQuery(
          setupOptions(session, requested.id),
        );
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
    createRoute({
      getParentRoute: () => root,
      path: "/school/$org",
      beforeLoad: async ({ location, params }) => {
        const session = await staffSession(location);
        const orgId = (params as unknown as { org: string }).org;
        const org = await queryClient
          .fetchQuery(orgOptions(session, orgId))
          .catch(() => null);
        throw redirect({
          ...(org ? orgHome(org) : { to: "/school" }),
          replace: true,
        } as never);
      },
    }),
    orgScreen("/classes", screens.classes),
    orgScreen("/students", screens.students),
    orgScreen("/students/$student", screens.student),
    orgScreen("/staff", screens.staff, (session, orgId) => [
      preload(staffOptions(session, orgId)),
    ]),
    orgScreen("/sign-in-help", screens.help, (session, orgId) => [
      preload(signInHelpOptions(session, orgId)),
    ]),
    orgScreen("/calendar", screens.calendar, (session, orgId) => [
      preload(calendarOptions(session, orgId)),
    ]),
    orgScreen("/license", screens.license, (session, orgId) => [
      preload(licenseOptions(session, orgId)),
    ]),
    orgScreen("/import", screens.importer),
  ];
}
