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
  isFundedReturn,
  campaignSearch,
  continuationSearch,
  type CampaignSearch,
} from "../lib/funded-entry";
import { chosenPlan } from "../lib/pending-trial";
import { hasInitialConsentChallenge } from "../consent-entry";
import { hasPurchaseReturn } from "../purchase-return";
const searchSchema = z
  .object({
    return: z
      .enum([
        "security",
        "access",
        "arkansas-efa",
        "new-hampshire-efa",
        "arizona-esa",
      ])
      .optional()
      .catch(undefined),
    program: z.enum(["ar-efa", "az-esa"]).optional().catch(undefined),
    token: z.string().max(2048).optional(),
    error: z.string().max(200).optional(),
    topic: z.string().max(100).optional().catch(undefined),
    strand: z.string().max(100).optional(),
    filter: z.string().max(100).optional(),
    skill: z.string().max(100).optional(),
    template: z.string().max(100).optional(),
    context: z.enum(["trial"]).optional().catch(undefined),
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
            result.program === "ar-efa" || result.program === "az-esa"
              ? result.program
              : undefined,
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
    isFundedReturn(search.return) ? search.return : false,
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
  beforeLoad: async ({ search: rawSearch, location }) => {
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
    if (!nativeRuntime) {
      const session = await queryClient.ensureQueryData(sessionOptions);
      if (session) {
        const me = await queryClient
          .fetchQuery(meOptions(session))
          .catch(() => undefined);
        // Explicit handoffs select their screen before mounting home. Merely
        // skipping the default redirect would let home's setup effect race them.
        if (hasInitialConsentChallenge())
          throw redirect({
            to: "/$",
            params: { _splat: "consent" },
            replace: true,
          });
        if (hasPurchaseReturn(location.searchStr))
          throw redirect({
            to: "/$",
            params: { _splat: "purchase/annual" },
            search,
            replace: true,
          });
        if ("security" in search)
          throw redirect({
            to: "/$",
            params: { _splat: "family/security" },
            replace: true,
          });
        if (
          me?.signedIn &&
          me.next === "accept-gift" &&
          !me.learners.some((learner) => learner.entitlement.active)
        )
          throw redirect({ to: "/access" });
        // Resolve first-run routing before mounting the app shell. Otherwise
        // returning trial users briefly see home and setup before practice.
        if (
          me?.signedIn &&
          me.next !== "practice" &&
          me.next !== "accept-gift"
        ) {
          const target = startDestination(me, "/", !!chosenPlan());
          if (target === "/try") {
            const { trialSessionOptions } =
              await import("../features/trial/api");
            const trial =
              await queryClient.ensureQueryData(trialSessionOptions);
            throw redirect({
              to: trial ? "/try/practice" : "/try",
              replace: true,
            });
          }
          if (target)
            throw redirect({ ...startNavigation(target), replace: true });
        }
      }
    }
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
const accessGift = createRoute({
  getParentRoute: () => root,
  path: "/access",
  component: lazyRouteComponent(
    () => import("../features/access/AccessScreen"),
    "AccessScreen",
  ),
});
const accountReady = createRoute({
  getParentRoute: () => root,
  path: "/account/ready",
  loader: async () => {
    const session = await queryClient.ensureQueryData(sessionOptions);
    // Leave a failed lookup to the screen's inline retry instead of replacing
    // the successful-registration page with a route error.
    if (session)
      await queryClient
        .ensureQueryData(meOptions(session))
        .catch(() => undefined);
  },
  component: lazyRouteComponent(
    () => import("../features/account/AccountReady"),
    "AccountReady",
  ),
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
const inventory = createRoute({
  getParentRoute: () => root,
  path: "/inventory",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/inventory/InventoryScreen"),
    "InventoryScreen",
  ),
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
const pathwaySkill = createRoute({
  getParentRoute: () => root,
  path: "/pathways/$skillId",
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
const fundedNewHampshire = createRoute({
  getParentRoute: () => root,
  path: "/purchase/new-hampshire-efa",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/funding/FundedEntry"),
    "FundedEntry",
  ),
});
const fundedArizona = createRoute({
  getParentRoute: () => root,
  path: "/purchase/arizona-esa",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/funding/FundedEntry"),
    "FundedEntry",
  ),
});
const invoiceForm = lazyRouteComponent(
  () => import("../features/funding/InvoiceForm"),
  "InvoiceForm",
);
const invoiceArkansas = createRoute({
  getParentRoute: () => root,
  path: "/invoice/arkansas-efa",
  component: invoiceForm,
});
const invoiceArizona = createRoute({
  getParentRoute: () => root,
  path: "/invoice/arizona-esa",
  component: invoiceForm,
});
const invoiceNewHampshire = createRoute({
  getParentRoute: () => root,
  path: "/invoice/new-hampshire-efa",
  component: invoiceForm,
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
    accountReady,
    accessGift,
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
    inventory,
    pathways,
    pathwaySkill,
    funded,
    fundedNewHampshire,
    fundedArizona,
    invoiceArkansas,
    invoiceArizona,
    invoiceNewHampshire,
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
