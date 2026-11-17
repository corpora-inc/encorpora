import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRoute,
} from "@tanstack/react-router";
import type { AuthSession } from "../auth";
import { meOptions, queryClient } from "../lib/query";
import { preload } from "../features/school/api";
import {
  childProgressOptions,
  familyOptions,
  familyPlacesOptions,
  isFamilyId,
} from "../features/family/api";
import { familyPath, landingFamily } from "../features/family/redirects";
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
  /** An older account address: the same screen at its neutral address,
   * with the rest of the path (`from` alone, or `from/…`). */
  const accountAlias = (from: string, to: string) =>
    [from, `${from}/$`].map((path) =>
      createRoute({
        getParentRoute: () => root,
        path,
        staticData: { space: "account" },
        beforeLoad: ({ location }) => {
          const rest = location.pathname.slice(from.length);
          throw redirect({
            href: `${to}${rest}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
            replace: true,
          });
        },
      }),
    );
  /** The account's learners, from before families had a place: the family's
   * Settings (its children), or adding a child on its Today. */
  const learners = (path: string, leaf: string, search: object) =>
    createRoute({
      getParentRoute: () => root,
      path,
      staticData: { space: "family" },
      beforeLoad: async (context) => {
        const { session } = await staffScreen(context);
        const { family } = await ownFamily(session);
        throw redirect({
          to: family ? familyPath(family, leaf) : "/family",
          search: family ? search : {},
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

  /** Progress and the family's old record pages (practice time, report
   * cards, workbooks), now parts of each child's page: one hop, for a
   * one-child family, to that child's page at the part (`anchor`); for
   * several, the old record pages open Progress. Progress itself shows the
   * several, and keeps its linked curriculum layers on the way to one. The
   * workbook print for several (`?several`, `?kids`) stays at its address. */
  const childAlias = (
    path: string,
    anchor: string | null,
    name: string,
    stays: (search: Record<string, unknown>) => boolean = () => false,
  ) =>
    createRoute({
      getParentRoute: () => family,
      path,
      beforeLoad: async ({ context, params, location }) => {
        const search = location.search as Record<string, unknown>;
        if (stays(search)) return;
        const { session } = context as unknown as { session: AuthSession };
        const id = (params as { family: string }).family;
        const data = await queryClient
          .ensureQueryData(familyOptions(session, id))
          .catch(() => null);
        const only = data?.children.length === 1 ? data.children[0]! : null;
        if (!only && !anchor) return;
        throw redirect({
          to: familyPath(id, only ? `kids/${only.id}` : "map"),
          search: (anchor ? {} : search) as never,
          hash: anchor ?? location.hash,
          replace: true,
        } as never);
      },
      component: screen(name),
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
        { orgOptions, calendarOptions },
        { presenceOptions },
        { experienceOptions },
      ] = await Promise.all([
        import("../features/school/api"),
        import("../features/school/classes/api"),
        import("../features/school/classroom/api"),
      ]);
      const org = await queryClient
        .ensureQueryData(orgOptions(session, own.org))
        .catch(() => null);
      await Promise.all([
        org?.can?.includes("calendar.read")
          ? preload(calendarOptions(session, own.org))
          : null,
        preload(presenceOptions(session, { org: own.org, class: own.id })),
        preload(experienceOptions(session, { kind: "class", id: own.id })),
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
    ...accountAlias("/family/security", "/account/security"),
    ...accountAlias("/family/access", "/account/billing"),
    learners("/family/learners", "settings", {}),
    learners("/family/learners/new", "", { add: 1 }),
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
      childAlias("map", null, "FamilyMapScreen"),
      childAlias(
        "workbooks",
        "child-workbooks",
        "FamilyWorkbooksScreen",
        (search) => search.several !== undefined || search.kids !== undefined,
      ),
      leaf("workbooks/$date", "FamilyMarkingScreen"),
      childAlias("time", "child-time", "FamilyMapScreen"),
      childAlias("reports", "child-reports", "FamilyMapScreen"),
      leaf("reports/grades", "FamilyGradesScreen"),
      leaf("people", "FamilyPeopleScreen"),
      // Settings, and the overlays its rows open over it (billing, privacy,
      // sign-in, deleting the account, Pay): Settings stays mounted behind.
      settings.addChildren([...accountOverlays(settings)]),
      leaf("cards", "FamilyCardsScreen"),
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
