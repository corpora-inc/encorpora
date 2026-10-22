import {
  createRootRoute,
  createRoute,
  createRouter,
  createBrowserHistory,
  createMemoryHistory,
  lazyRouteComponent,
  Outlet,
  redirect,
  retainSearchParams,
  useRouter,
} from "@tanstack/react-router";
import { z } from "zod";
import { nativeRuntime } from "../native-runtime";
import {
  authConfigOptions,
  queryClient,
  sessionOptions,
  meOptions,
} from "../lib/query";
import { LoadingScreen, RouteError } from "../ui/LoadingScreen";
import {
  startDestination,
  startNavigation,
} from "../features/onboarding/guard";
import {
  campaignSearch,
  continuationSearch,
  type CampaignSearch,
} from "../lib/funded-entry";
import { chosenPlan } from "../lib/pending-trial";
const searchSchema = z
  .object({
    return: z.enum(["security", "arkansas-efa"]).optional().catch(undefined),
    program: z.literal("ar-efa").optional().catch(undefined),
    token: z.string().max(2048).optional(),
    error: z.string().max(200).optional(),
    topic: z.string().max(100).optional(),
    strand: z.string().max(100).optional(),
    filter: z.string().max(100).optional(),
    skill: z.string().max(100).optional(),
    page: z.coerce.number().int().nonnegative().optional(),
    state: z.string().max(200).optional(),
    purchase: z.string().max(200).optional(),
    billing: z.string().max(40).optional(),
    interval: z.enum(["year", "month"]).optional().catch(undefined),
    reason: z.enum(["limit", "choice"]).optional().catch(undefined),
    "sign-in": z.string().optional(),
    method: z.enum(["password"]).optional().catch(undefined),
    "reset-password": z.string().optional(),
  })
  .passthrough();
function RouterError({ error }: { error: unknown }) {
  const router = useRouter();
  return <RouteError error={error} reset={() => void router.invalidate()} />;
}
const root = createRootRoute({
  component: Outlet,
  validateSearch: (search): z.infer<typeof searchSchema> & CampaignSearch => {
    const parsed = searchSchema.parse(search);
    const { utm_source, utm_medium, utm_campaign, utm_content, ...rest } =
      parsed;
    return {
      ...rest,
      utm_source: undefined,
      utm_medium: undefined,
      utm_campaign: undefined,
      utm_content: undefined,
      ...campaignSearch({ utm_source, utm_medium, utm_campaign, utm_content }),
    };
  },
  search: {
    middlewares: [
      ({ search, next }) => {
        const result = retainSearchParams<typeof search>([
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "program",
        ])({ search, next });
        // Validation merges into raw router search. Explicitly erase rejected
        // values after retention; omission alone would preserve them.
        return {
          ...result,
          utm_source: undefined,
          utm_medium: undefined,
          utm_campaign: undefined,
          utm_content: undefined,
          ...campaignSearch(result),
          program:
            result.program === "ar-efa" ? ("ar-efa" as const) : undefined,
        };
      },
    ],
  },
  errorComponent: RouterError,
});
const legacy = lazyRouteComponent(() => import("./LegacyApp"), "LegacyApp");
const auth = lazyRouteComponent(
  () => import("../features/auth/SignInScreen"),
  "SignInScreen",
);
/** Sign-in methods load with the route: the screen renders complete. */
const loadAuthConfig = () => queryClient.ensureQueryData(authConfigOptions);
const start = lazyRouteComponent(
  () => import("../features/onboarding/StartScreen"),
  "StartScreen",
);
/** Every /start step runs the one first-run guard against `/me`. */
async function beforeStart({
  location,
}: {
  location: { pathname: string; search: Record<string, unknown> };
}) {
  const search = continuationSearch(location.search);
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in", search });
  if (nativeRuntime) return;
  const me = await queryClient.ensureQueryData({
    ...meOptions(session),
    revalidateIfStale: true,
  });
  const target = startDestination(
    me,
    location.pathname,
    !!chosenPlan(),
    search.return === "arkansas-efa",
  );
  if (target)
    throw redirect({ ...startNavigation(target), search, replace: true });
}
const trial = (name: "TryStart" | "TrialPractice" | "TrialMap" | "Paywall") =>
  lazyRouteComponent(() => import("../features/trial"), name);
/** The free trial: anonymous, resumable on this device, every step a URL. */
const tryStart = createRoute({
  getParentRoute: () => root,
  path: "/try",
  component: trial("TryStart"),
});
const tryPractice = createRoute({
  getParentRoute: () => root,
  path: "/try/practice",
  component: trial("TrialPractice"),
});
const tryMap = createRoute({
  getParentRoute: () => root,
  path: "/try/map",
  component: trial("TrialMap"),
});
const tryPlans = createRoute({
  getParentRoute: () => root,
  path: "/try/plans",
  component: trial("Paywall"),
});
const home = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: legacy,
  beforeLoad: ({ search: rawSearch }) => {
    const search = searchSchema.parse(rawSearch);
    if ("sign-in" in search)
      throw redirect({
        to: search["sign-in"] === "create" ? "/sign-up" : "/sign-in",
        search: { return: search.return, error: search.error },
      });
    if ("reset-password" in search)
      throw redirect({
        to: "/reset-password",
        search: { token: search.token, error: search.error },
      });
  },
});
const signIn = createRoute({
  getParentRoute: () => root,
  path: "/sign-in",
  loader: loadAuthConfig,
  component: auth,
});
const signUp = createRoute({
  getParentRoute: () => root,
  path: "/sign-up",
  loader: loadAuthConfig,
  component: auth,
});
const signInStep = createRoute({
  getParentRoute: () => root,
  path: "/sign-in/$step",
  loader: loadAuthConfig,
  component: auth,
  params: {
    parse: (p) => ({
      step: z.enum(["forgot", "check-email", "two-factor"]).parse(p.step),
    }),
  },
});
const reset = createRoute({
  getParentRoute: () => root,
  path: "/reset-password",
  loader: loadAuthConfig,
  component: auth,
});
const startIndex = createRoute({
  getParentRoute: () => root,
  path: "/start",
  beforeLoad: beforeStart,
  component: start,
});
const startPlan = createRoute({
  getParentRoute: () => root,
  path: "/start/plan",
  beforeLoad: beforeStart,
  component: start,
});
/** Stripe Checkout's success and cancel URL for parent enrollment. */
const startPurchase = createRoute({
  getParentRoute: () => root,
  path: "/start/purchase",
  beforeLoad: beforeStart,
  component: start,
});
const startName = createRoute({
  getParentRoute: () => root,
  path: "/start/name",
  beforeLoad: beforeStart,
  component: start,
});
const startYear = createRoute({
  getParentRoute: () => root,
  path: "/start/birth-year",
  beforeLoad: beforeStart,
  component: start,
});
const startConsent = createRoute({
  getParentRoute: () => root,
  path: "/start/consent",
  beforeLoad: beforeStart,
  component: start,
});
const startVerify = createRoute({
  getParentRoute: () => root,
  path: "/start/verify-email",
  beforeLoad: beforeStart,
  component: start,
});
const pathways = createRoute({
  getParentRoute: () => root,
  path: "/pathways",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/pathways/PathwaysScreen"),
    "PathwaysScreen",
  ),
});
const funded = createRoute({
  getParentRoute: () => root,
  path: "/purchase/arkansas-efa",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/funding/FundedEntry"),
    "FundedEntry",
  ),
});
const fallback = createRoute({
  getParentRoute: () => root,
  path: "/$",
  component: legacy,
});
export const router = createRouter({
  routeTree: root.addChildren([
    home,
    signIn,
    signUp,
    signInStep,
    reset,
    startIndex,
    startPlan,
    startPurchase,
    startName,
    startYear,
    startConsent,
    startVerify,
    tryStart,
    tryPractice,
    tryMap,
    tryPlans,
    pathways,
    funded,
    fallback,
  ]),
  history: nativeRuntime
    ? createMemoryHistory({ initialEntries: ["/"] })
    : createBrowserHistory(),
  defaultPendingComponent: LoadingScreen,
  defaultPendingMs: 250,
  defaultPendingMinMs: 0,
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
