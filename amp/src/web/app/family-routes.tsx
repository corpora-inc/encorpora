import {
  createRoute,
  lazyRouteComponent,
  type AnyRoute,
} from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import { meOptions, queryClient } from "../lib/query";
import { classYearOptions, preload } from "../features/school/core-api";
import {
  childProgressOptions,
  familyDashboardOptions,
  familyOptions,
  familyPlacesOptions,
} from "../features/family/api";
import { familyPath, landingFamily } from "../features/family/redirects";
import { staffScreen } from "./school-routes";
import { elsewhere } from "./sign-in-gate";
import { ownClassOf } from "../features/spaces/resolve";
import { groupAddress } from "./family-redirect";
import { OPEN_KEY, readStack } from "../nav/entities";
import { layerScope, useLayerStore } from "../nav/layer-store";
import { payOverlays } from "./pay-routes";
import { accountOverlays } from "./account-overlays";

/*
 * A family's own screens (docs/architecture/spaces.md, P2): `/family/<family>`
 * is its Today, a child's page is `/family/<family>/kids/<learner>`, and its
 * tabs are leaves under it. `/family` alone opens the account's own family,
 * or a chooser when several are theirs. The account's older `/family/<section>`
 * addresses open the account's own screens, at their neutral addresses.
 * Every older family address is an app/legacy-aliases.ts row.
 */

/** A read a screen can paint without: logged, and the screen shows what
 * it has (its own query reports the failure). */
const orNull =
  (what: string) =>
  (error: unknown): null => {
    console.warn(`${what} didn’t load ahead`, error);
    return null;
  };

async function ownFamily(session: AuthSession) {
  const places = await queryClient
    .fetchQuery(familyPlacesOptions(session))
    .catch(orNull("Your families"));
  return { places, family: landingFamily(places) };
}

/**
 * A family's practice sessions, with the Today that shows them: the class's
 * `can`, the live snapshot (a session already running paints with the
 * cockpit in place, its chunk loaded with it) and the first page of past
 * sessions, for a parent who may watch them. Nothing is asked of a family
 * that may not (a co-teacher, say), and a family with nothing running loads
 * none of the cockpit's code.
 */
async function familySessions(session: AuthSession, familyId: string) {
  const [data, me] = await Promise.all([
    queryClient
      .ensureQueryData(familyOptions(session, familyId))
      .catch(orNull("The family")),
    queryClient
      .ensureQueryData(meOptions(session))
      .catch(orNull("Your account")),
  ]);
  const own = ownClassOf(me?.signedIn ? me : null, familyId, data);
  if (!own) return null;
  const [year, { liveOptions, sessionsOptions }] = await Promise.all([
    preload(classYearOptions(session, own.id)) as Promise<
      { can?: readonly string[] } | undefined
    >,
    import("../features/live/api"),
  ]);
  if (!year?.can?.includes("session.read")) return null;
  const place = { org: own.org, class: own.id };
  const [snapshot] = await Promise.all([
    preload(liveOptions(session, place)) as Promise<
      { session: unknown; signals: unknown[] } | undefined
    >,
    preload(sessionsOptions(session, place)),
  ]);
  // Running, or a child asking: the cockpit is there on first paint.
  if (snapshot && (snapshot.session || snapshot.signals.length > 0))
    await import("../features/family/cockpit-chunk").then(
      ({ loadFamilyCockpit }) => loadFamilyCockpit(),
    );
  return own;
}

export function familyRoutes(root: AnyRoute) {
  const screens = () => import("../features/family/screens");
  const payHosts = () => import("../features/pay/hosts");
  const screen = (name: string) =>
    lazyRouteComponent(screens as never, name as never);
  const landing = createRoute({
    getParentRoute: () => root,
    path: "/family",
    staticData: { space: "family" },
    beforeLoad: async (context) => {
      const { session } = await staffScreen(context);
      const { places, family } = await ownFamily(session);
      const me = await queryClient
        .ensureQueryData(meOptions(session))
        .catch(orNull("Your account"));
      const own = places?.families.find((entry) => entry.familyId === family);
      // A tutor whose class holds only other families' children: their
      // tutoring group's classroom, never an empty family.
      if (
        own?.role === "holder" &&
        own.teachingPlace &&
        me?.signedIn &&
        me.learners.length === 0
      ) {
        const group = await groupAddress(session, own.familyId);
        if (group) elsewhere(group);
      }
      // Their one family: its own address, at once.
      if (family)
        elsewhere(`${familyPath(family)}${context.location.searchStr}`);
      const parents = (places?.families ?? []).filter(
        (entry) => entry.role !== "co-teacher",
      );
      // No family yet: the starter makes one.
      if (places && parents.length === 0) elsewhere("/start/parent");
      return { session };
    },
    component: screen("FamilyChooserScreen"),
  });
  const family = createRoute({
    getParentRoute: () => root,
    path: "/family/$family",
    staticData: { space: "family" },
    // (An id that isn't a family's, and a sheet in the query, are
    // app/legacy-aliases.ts rows.)
    beforeLoad: staffScreen,
    loader: async ({ context, params }) => {
      const { session } = context as unknown as { session: AuthSession };
      const id = (params as { family: string }).family;
      await Promise.all([
        preload(familyOptions(session, id)),
        preload(meOptions(session)),
      ]);
    },
  });
  const leaf = (path: string, name: string) =>
    createRoute({
      getParentRoute: () => family,
      path,
      component: screen(name),
    });
  /** A child's page paints whole: its record (levels, and whether there
   * is anything to report yet), its workbooks and its report card's term
   * arrive with it, once the family's own projection says this reader may
   * read them. Its overlays (a workbook day, results) load the same. */
  const childLoader = async ({
    context,
    params,
  }: {
    context: unknown;
    params: unknown;
  }) => {
    const { session } = context as unknown as { session: AuthSession };
    const { family: id, learner } = params as {
      family: string;
      learner: string;
    };
    const data = await queryClient
      .ensureQueryData(familyOptions(session, id))
      .catch(orNull("The family"));
    const child = data?.children.find((entry) => entry.id === learner);
    if (!child) return;
    // Its workbooks and report card arrive with it too, so no part
    // lands late and pushes the page down.
    const me = child.capabilities.readGrades
      ? await queryClient
          .ensureQueryData(meOptions(session))
          .catch(orNull("Your account"))
      : null;
    const own = ownClassOf(me?.signedIn ? me : null, id, data);
    const [{ workbookHistoryOptions }, { gradebookOptions }] =
      await Promise.all([
        import("../features/workbooks/api"),
        import("../features/school/classes/teacher-api"),
      ]);
    await Promise.all([
      child.capabilities.readProgress
        ? preload(childProgressOptions(session, id, learner))
        : null,
      child.capabilities.readWorkbooks
        ? preload(workbookHistoryOptions(session, learner))
        : null,
      own
        ? preload(
            gradebookOptions(
              session,
              { org: own.org, class: own.id },
              undefined,
            ),
          )
        : null,
    ]);
  };

  /** A child's learning screen at the child's own address
   * (`kids/<learner>/pathways`): the shared screen, for that child. The
   * address names them (features/spaces/identity.ts): a child who isn't the
   * family's is unavailable (the space's content guard), never another
   * learner, and nothing of theirs is asked. Its record and level arrive
   * with it. */
  const childScreen = (
    path: string,
    load: () => Promise<Record<string, unknown>>,
    name: string,
  ) =>
    createRoute({
      getParentRoute: () => family,
      path,
      // The family's own projection decides first, as the screen does:
      // nothing of a child's is asked unless this family holds them and
      // this reader may read their progress (CP-5 #6). Loaders of a parent
      // and a child run side by side, so this one waits on it itself.
      loader: async ({ context, params, location }) => {
        const { session } = context as unknown as { session: AuthSession };
        const { family: id, learner } = params as {
          family: string;
          learner: string;
        };
        const data = await queryClient
          .ensureQueryData(familyOptions(session, id))
          .catch(orNull("The family"));
        const child = data?.children.find((entry) => entry.id === learner);
        if (!child?.capabilities.readProgress) return;
        const view = await import("../lib/learning-view");
        const ready = view.preloadLearningView({
          pathname: location.pathname,
          search: location.search as Record<string, unknown>,
        });
        // A problem type's short lesson open over the map (its layers,
        // nav/layer-store.ts) needs neither the curriculum nor the record: it
        // opens at once over the map, which fills in under it, as on the
        // learner's own Pathways (router.tsx).
        const stack = [
          ...(useLayerStore.getState().stacks[
            layerScope(location.pathname, session.accountId)
          ] ?? []),
          ...readStack(new URLSearchParams(location.searchStr).get(OPEN_KEY)),
        ];
        if (!stack.some((layer) => layer.kind === "lesson"))
          return void (await ready);
        void ready.catch((error: unknown) =>
          console.error("The map did not preload", error),
        );
      },
      component: lazyRouteComponent(load as never, name as never),
    });
  // A child's page paints whole: its record (levels, and whether there is
  // anything to report yet) arrives with it, once the family's own
  // projection says this reader may read it. Its host keeps the page
  // mounted under the pay overlay its "Continue with AMP" opens (`pay`).
  const childPage = createRoute({
    getParentRoute: () => family,
    path: "kids/$learner",
    loader: childLoader,
    component: lazyRouteComponent(payHosts, "ChildPayHost"),
  });
  // Settings paints whole: the school year, the family code and the
  // practice defaults read the family's own class before the screen
  // shows, so no section arrives late and pushes the others down. Its host
  // keeps it mounted under the overlays its rows open.
  const settings = createRoute({
    getParentRoute: () => family,
    path: "settings",
    loader: async ({ context, params }) => {
      const { session } = context as unknown as { session: AuthSession };
      const id = (params as { family: string }).family;
      const [data, me] = await Promise.all([
        queryClient
          .ensureQueryData(familyOptions(session, id))
          .catch(orNull("The family")),
        queryClient
          .ensureQueryData(meOptions(session))
          .catch(orNull("Your account")),
      ]);
      const own = ownClassOf(me?.signedIn ? me : null, id, data);
      if (!own) return;
      const [
        { orgOptions, calendarOptions, classesOptions },
        { presenceOptions },
        { experienceOptions },
        { secondParentOptions },
      ] = await Promise.all([
        import("../features/school/api"),
        import("../features/school/classes/api"),
        import("../features/school/classroom/api"),
        import("../features/second-parent/api"),
      ]);
      const org = await queryClient
        .ensureQueryData(orgOptions(session, own.org))
        .catch(orNull("The family"));
      // Every section's data, so the page paints whole (no section arrives
      // late and pushes the next down): the school year, the devices, the
      // second parent.
      await Promise.all([
        org?.can?.includes("calendar.read")
          ? preload(calendarOptions(session, own.org))
          : null,
        org?.can?.includes("calendar.read")
          ? preload(classesOptions(session, own.org))
          : null,
        preload(presenceOptions(session, { org: own.org, class: own.id })),
        preload(experienceOptions(session, { kind: "class", id: own.id })),
        data?.capabilities.manageSecondParent
          ? preload(secondParentOptions(session))
          : null,
      ]);
    },
    component: lazyRouteComponent(payHosts, "SettingsHost"),
  });
  /** Today's host: Today itself, and the pay overlay over it. */
  const today = createRoute({
    getParentRoute: () => family,
    id: "today",
    // The dashboard (each child's week, areas and focus) paints with the
    // children, never after them.
    loader: async ({ context, params }) => {
      const { session } = context as unknown as { session: AuthSession };
      const id = (params as { family: string }).family;
      await Promise.all([
        preload(familyDashboardOptions(session, id)),
        familySessions(session, id),
      ]);
    },
    component: lazyRouteComponent(payHosts, "TodayPayHost"),
  });
  /** A stopped session's stored report, under Today (a family has no Time
   * tab). Its read comes with it, with the dashboard's per-child settings;
   * a session still running answers 409, which the screen shows as the way
   * back to the live view. Its own chunk: the report's code is never part
   * of Today's. */
  const sessionReport = createRoute({
    getParentRoute: () => family,
    path: "sessions/$session",
    loader: async ({ context, params }) => {
      const { session } = context as unknown as { session: AuthSession };
      const { family: id, session: sessionId } = params as {
        family: string;
        session: string;
      };
      const [own, { sessionReportOptions }] = await Promise.all([
        familySessions(session, id),
        import("../features/live/api"),
        preload(familyDashboardOptions(session, id)),
      ]);
      if (own)
        await queryClient
          .ensureQueryData(
            sessionReportOptions(
              session,
              { org: own.org, class: own.id },
              sessionId,
            ),
          )
          .catch((error: unknown) =>
            console.warn("The session's report didn’t load ahead", error),
          );
    },
    component: lazyRouteComponent(
      () => import("../features/family/FamilyReport"),
      "FamilyReportScreen",
    ),
  });
  return [
    landing,
    // `/family/learners(/new)`, `/family/security(/…)` and
    // `/family/access(/…)` are app/legacy-aliases.ts rows.
    family.addChildren([
      // Today, with the pay overlay its "Continue with AMP" opens over it
      // (`pay/<learner>`, features/pay): Today stays mounted behind.
      today.addChildren([...payOverlays(today, "pay/$learner")]),
      sessionReport,
      childPage.addChildren([...payOverlays(childPage, "pay")]),
      // A child's workbook day and results: overlays over their page, at
      // their own addresses, closing (✕) back to it. Over the page, never a
      // page of their own: the page keeps its scroll (router.tsx overList).
      createRoute({
        getParentRoute: () => family,
        path: "kids/$learner/workbooks/$date",
        staticData: { overList: true },
        loader: childLoader,
        component: screen("ChildScreen"),
      }),
      createRoute({
        getParentRoute: () => family,
        path: "kids/$learner/workbooks/$workbookId/results",
        staticData: { overList: true },
        // The page under it, and the results themselves: the sheet opens
        // whole, its title the workbook's own.
        loader: async (input) => {
          const { session } = input.context as unknown as {
            session: AuthSession;
          };
          const {
            family: id,
            learner,
            workbookId,
          } = input.params as {
            family: string;
            learner: string;
            workbookId: string;
          };
          const [data, { workbookResultsOptions }] = await Promise.all([
            queryClient
              .ensureQueryData(familyOptions(session, id))
              .catch(orNull("The family")),
            import("../features/workbooks/api"),
            childLoader(input),
          ]);
          const child = data?.children.find((entry) => entry.id === learner);
          if (child?.capabilities.readWorkbooks)
            await preload(workbookResultsOptions(session, learner, workbookId));
        },
        component: screen("ChildScreen"),
      }),
      childScreen(
        "kids/$learner/pathways",
        () => import("../features/pathways/PathwaysScreen"),
        "PathwaysScreen",
      ),
      childScreen(
        "kids/$learner/inventory",
        () => import("../features/inventory/InventoryScreen"),
        "InventoryScreen",
      ),
      // The old record pages (`map`, `time`, `reports`, `workbooks`) are
      // app/legacy-aliases.ts rows, all but the workbook print for several
      // children (`?several`, `?kids`), which stays here.
      leaf("workbooks", "FamilyWorkbooksScreen"),
      leaf("workbooks/$date", "FamilyMarkingScreen"),
      leaf("reports/grades", "FamilyGradesScreen"),
      // Settings, and the overlays its rows open over it (billing, privacy,
      // sign-in, deleting the account, Pay): Settings stays mounted behind.
      settings.addChildren([...accountOverlays(settings)]),
      // The tutoring group is its class's classroom: this address opens it.
      createRoute({
        getParentRoute: () => family,
        path: "group",
        beforeLoad: async ({ context, params, location }) => {
          const { session } = context as unknown as { session: AuthSession };
          const group = await groupAddress(
            session,
            (params as { family: string }).family,
            location.search as Record<string, unknown>,
          );
          if (group) elsewhere(group);
        },
        component: screen("TutoringGroupScreen"),
      }),
      leaf("$", "FamilyMissingScreen"),
    ]),
  ];
}
