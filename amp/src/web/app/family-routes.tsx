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
  familyOptions,
  familyPlacesOptions,
  isFamilyId,
} from "../features/family/api";
import { familyPath, landingFamily } from "../features/family/redirects";
import { staffScreen } from "./school-routes";

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
  const screen = (name: string) =>
    lazyRouteComponent(screens as never, name as never);
  /** An older account address: the same screen at its neutral address. */
  const accountAlias = (from: string, to: string) => [
    createRoute({
      getParentRoute: () => root,
      path: from,
      staticData: { space: "account" },
      beforeLoad: ({ location }) => {
        throw redirect({
          href: `${to}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
          replace: true,
        });
      },
    }),
    createRoute({
      getParentRoute: () => root,
      path: `${from}/$`,
      staticData: { space: "account" },
      beforeLoad: ({ location }) => {
        const rest = location.pathname.slice(from.length);
        throw redirect({
          href: `${to}${rest}${location.searchStr}${location.hash ? `#${location.hash}` : ""}`,
          replace: true,
        });
      },
    }),
  ];
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
  return [
    landing,
    ...accountAlias("/family/security", "/account/security"),
    ...accountAlias("/family/access", "/account/billing"),
    ...accountAlias("/family/privacy", "/account/privacy"),
    learners("/family/learners", "settings", {}),
    learners("/family/learners/new", "", { add: 1 }),
    family.addChildren([
      leaf("/", "FamilyTodayScreen"),
      leaf("kids/$learner", "ChildScreen"),
      leaf("map", "FamilyMapScreen"),
      leaf("workbooks", "FamilyWorkbooksScreen"),
      leaf("workbooks/$date", "FamilyMarkingScreen"),
      leaf("time", "FamilyTimeScreen"),
      leaf("reports", "FamilyReportsScreen"),
      leaf("reports/grades", "FamilyGradesScreen"),
      leaf("people", "FamilyPeopleScreen"),
      leaf("settings", "FamilySettingsScreen"),
      leaf("cards", "FamilyCardsScreen"),
      leaf("group", "TutoringGroupScreen"),
      leaf("$", "FamilyMissingScreen"),
    ]),
  ];
}
