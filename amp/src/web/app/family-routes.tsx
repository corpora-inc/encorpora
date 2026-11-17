import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import { meOptions, queryClient } from "../lib/query";
import { preload } from "../features/school/core-api";
import {
  childProgressOptions,
  familyOptions,
  familyPlacesOptions,
  isFamilyId,
} from "../features/family/api";
import {
  familyPath,
  landingFamily,
  sheetHop,
} from "../features/family/redirects";
import { sheetState } from "../nav/sheet";
import { staffScreen } from "./school-routes";
import { ownClassOf } from "../features/spaces/resolve";
import { groupAddress } from "./family-redirect";
import { OPEN_KEY, readStack } from "../nav/entities";
import { payOverlays } from "./pay-routes";
import { accountOverlays } from "./account-overlays";

/*
 * A family's own screens (docs/architecture/spaces.md, P2): `/family/<family>`
 * is its Today, a child's page is `/family/<family>/kids/<learner>`, and its
 * tabs are leaves under it. `/family` alone opens the account's own family,
 * or a chooser when several are theirs. The account's older `/family/<section>`
 * addresses open the account's own screens, at their neutral addresses.
 */

async function ownFamily(session: AuthSession) {
  const places = await queryClient
    .fetchQuery(familyPlacesOptions(session))
    .catch(() => null);
  return { places, family: landingFamily(places) };
}

export function familyRoutes(root: AnyRoute) {
  const screens = () => import("../features/family/screens");
  const payHosts = () => import("../features/pay/hosts");
  const screen = (name: string) =>
    lazyRouteComponent(screens as never, name as never);
  /** The account's learners, from before families had a place: the family's
   * Settings (its children), adding a child there (`sheet`). */
  const learners = (path: string, sheet?: string) =>
    createRoute({
      getParentRoute: () => root,
      path,
      staticData: { space: "family" },
      beforeLoad: async (context) => {
        const { session } = await staffScreen(context);
        const { family } = await ownFamily(session);
        throw redirect({
          to: family ? familyPath(family, "settings") : "/family",
          ...(family && sheet ? { state: sheetState(sheet) } : {}),
          replace: true,
        } as never);
      },
    });
  const landing = createRoute({
    getParentRoute: () => root,
    path: "/family",
    staticData: { space: "family" },
    beforeLoad: async (context) => {
      const { session } = await staffScreen(context);
      const { places, family } = await ownFamily(session);
      const me = await queryClient
        .ensureQueryData(meOptions(session))
        .catch(() => null);
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
        if (group) throw redirect({ href: group, replace: true });
      }
      if (family)
        throw redirect({
          to: familyPath(family),
          search: context.location.search as never,
          replace: true,
        } as never);
      const parents = (places?.families ?? []).filter(
        (entry) => entry.role !== "co-teacher",
      );
      // No family yet: the starter makes one.
      if (places && parents.length === 0)
        throw redirect({ to: "/start/parent", replace: true } as never);
      return { session };
    },
    component: screen("FamilyChooserScreen"),
  });
  const family = createRoute({
    getParentRoute: () => root,
    path: "/family/$family",
    staticData: { space: "family" },
    beforeLoad: async (context) => {
      const id = (context.params as { family: string }).family;
      // Not a family's id: an address this app never made.
      if (!isFamilyId(id))
        throw redirect({ to: "/family", replace: true } as never);
      // An older address that opened a sheet with a key (`?devices=1`,
      // `?add=1`): the same screen, the sheet from history state.
      const hop = sheetHop(
        context.location.pathname,
        context.location.search as Record<string, unknown>,
      );
      if (hop) throw redirect({ ...hop, replace: true } as never);
      return staffScreen(context);
    },
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
  /** An older family leaf that is part of Settings now: one hop there,
   * opening its sheet (`sheet`) from history state. */
  const settingsHop = (path: string, sheet?: string) =>
    createRoute({
      getParentRoute: () => family,
      path,
      beforeLoad: ({ params }) => {
        throw redirect({
          to: familyPath((params as { family: string }).family, "settings"),
          ...(sheet ? { state: sheetState(sheet) } : {}),
          replace: true,
        } as never);
      },
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
      .catch(() => null);
    const child = data?.children.find((entry) => entry.id === learner);
    if (!child) return;
    // Its workbooks and report card arrive with it too, so no part
    // lands late and pushes the page down.
    const me = child.capabilities.readGrades
      ? await queryClient.ensureQueryData(meOptions(session)).catch(() => null)
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

  /** The family's old record pages (Progress, practice time, report cards,
   * workbooks), now parts of each child's page and of Today: one hop, for a
   * one-child family, to that child's page at the part (`anchor`); for
   * several, or with no part (Progress), to Today, where each child's card
   * opens their page. Progress's linked curriculum layers go with it. The
   * workbook print for several (`?several`, `?kids`) stays at its address. */
  const childAlias = (
    path: string,
    anchor: string | null,
    stays?: {
      when: (search: Record<string, unknown>) => boolean;
      component: string;
    },
  ) =>
    createRoute({
      getParentRoute: () => family,
      path,
      beforeLoad: async ({ context, params, location }) => {
        const search = location.search as Record<string, unknown>;
        if (stays?.when(search)) return;
        const id = (params as { family: string }).family;
        let only: string | null = null;
        if (anchor) {
          const { session } = context as unknown as { session: AuthSession };
          const data = await queryClient.ensureQueryData(
            familyOptions(session, id),
          );
          only = data.children.length === 1 ? data.children[0]!.id : null;
        }
        throw redirect({
          to: familyPath(id, only ? `kids/${only}` : ""),
          search: (only ? {} : search) as never,
          hash: only ? anchor! : location.hash,
          replace: true,
        } as never);
      },
      ...(stays ? { component: screen(stays.component) } : {}),
    });
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
          .catch(() => null);
        const child = data?.children.find((entry) => entry.id === learner);
        if (!child?.capabilities.readProgress) return;
        const view = await import("../lib/learning-view");
        const ready = view.preloadLearningView({
          pathname: location.pathname,
          search: location.search as Record<string, unknown>,
        });
        // A problem type's short lesson (a layer, `?open=lesson:<type>`)
        // needs neither the curriculum nor the record: it opens at once over
        // the map, which fills in under it, as on the learner's own Pathways
        // (router.tsx).
        const open = new URLSearchParams(location.searchStr).get(OPEN_KEY);
        if (!readStack(open).some((layer) => layer.kind === "lesson"))
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
          .catch(() => null),
        queryClient.ensureQueryData(meOptions(session)).catch(() => null),
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
        .catch(() => null);
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
    component: lazyRouteComponent(payHosts, "TodayPayHost"),
  });
  return [
    landing,
    // `/family/security(/…)` and `/family/access(/…)` are the account's
    // older addresses (router.tsx, features/account/legacy.ts).
    learners("/family/learners"),
    learners("/family/learners/new", "add-children"),
    family.addChildren([
      // Today, with the pay overlay its "Continue with AMP" opens over it
      // (`pay/<learner>`, features/pay): Today stays mounted behind.
      today.addChildren([...payOverlays(today, "pay/$learner")]),
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
        loader: childLoader,
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
      childAlias("map", null),
      childAlias("workbooks", "child-workbooks", {
        when: (search) =>
          search.several !== undefined || search.kids !== undefined,
        component: "FamilyWorkbooksScreen",
      }),
      leaf("workbooks/$date", "FamilyMarkingScreen"),
      childAlias("time", "child-time"),
      childAlias("reports", "child-reports"),
      leaf("reports/grades", "FamilyGradesScreen"),
      // People are Settings' People now.
      settingsHop("people"),
      // Settings, and the overlays its rows open over it (billing, privacy,
      // sign-in, deleting the account, Pay): Settings stays mounted behind.
      settings.addChildren([...accountOverlays(settings)]),
      // The sign-in cards print from their own devices, over Settings.
      settingsHop("cards", "devices"),
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
          if (group) throw redirect({ href: group, replace: true });
        },
        component: screen("TutoringGroupScreen"),
      }),
      leaf("$", "FamilyMissingScreen"),
    ]),
  ];
}
