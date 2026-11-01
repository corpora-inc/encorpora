import { signupEntrySchema } from "../../parent-followup/contracts";
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
import { knownStale, onSignedOut } from "../lib/app-recovery";
import { workbookSearchSchema } from "../features/workbooks/model";
const searchSchema = z
  .object({
    return: z
      .enum([
        "free-practice",
        "security",
        "access",
        "arkansas-efa",
        "new-hampshire-efa",
        "arizona-esa",
      ])
      .optional()
      .catch(undefined),
    entry: signupEntrySchema.optional().catch(undefined),
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
          "entry",
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
  // A tab already found to run an older release turns its next navigation
  // into a full page load of the same URL. The current screen stays painted
  // until the new page paints, so no loading screen shows in between.
  beforeLoad: ({ location }) => {
    if (nativeRuntime || !knownStale()) return;
    window.location.assign(location.href);
    return new Promise<never>(() => {});
  },
  pendingMs: 600_000,
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
/** A parent signs in before the account-owned free assessment. */
async function beforeTrial({ search }: { search: Record<string, unknown> }) {
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session)
    throw redirect({
      to: "/sign-up",
      search: { ...continuationSearch(search), return: "free-practice" },
    });
  if (search.return === "free-practice")
    void fetch("/api/v1/parent-followup/complete", {
      signal: AbortSignal.timeout(10000),
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
}
const tryStart = createRoute({
  getParentRoute: () => root,
  path: "/try",
  beforeLoad: beforeTrial,
  component: trial("TryStart"),
});
const tryPractice = createRoute({
  getParentRoute: () => root,
  path: "/try/practice",
  beforeLoad: beforeTrial,
  component: trial("TrialPractice"),
});
const tryMap = createRoute({
  getParentRoute: () => root,
  path: "/try/map",
  beforeLoad: beforeTrial,
  component: trial("TrialMap"),
});
const tryPlans = createRoute({
  getParentRoute: () => root,
  path: "/try/plans",
  beforeLoad: beforeTrial,
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
/** Daily paper workbooks for one learner (features/workbooks). */
const workbookHistory = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookHistoryScreen"),
    "WorkbookHistoryScreen",
  ),
});
const workbookDay = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks/$date",
  validateSearch: (search) => workbookSearchSchema.parse(search),
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookDayScreen"),
    "WorkbookDayScreen",
  ),
});
const workbookResults = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks/$workbookId/results",
  beforeLoad: () => {
    if (nativeRuntime) throw redirect({ to: "/" });
  },
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookResultsScreen"),
    "WorkbookResultsScreen",
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
    workbookHistory,
    workbookDay,
    workbookResults,
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
const SIGNED_OUT_KEY = "amp.signed-out-redirect";
/** True when this tab was sent to sign-in moments ago: a second 401 then is
 * not an ended session, and redirecting again would loop. */
function redirectedRecently() {
  try {
    const at = Number(sessionStorage.getItem(SIGNED_OUT_KEY));
    sessionStorage.setItem(SIGNED_OUT_KEY, String(Date.now()));
    return Date.now() - at < 30_000;
  } catch {
    return false;
  }
}
// The server ended this parent's sign-in (expired, or signed out elsewhere).
// Free practice returns to the free-account signup, everything else to
// sign-in, with campaign, program and return context kept. The destination is loaded before the switch,
// so the current screen stays until it is replaced in one step; the session
// is cleared only after, so no mounted screen renders without one.
let leaving = false;
onSignedOut(() => {
  // Several requests from one screen can fail together: one redirect, and the
  // rest wait silently for the screen to be replaced.
  if (leaving) return true;
  const { pathname, search } = router.state.location;
  if (/^\/(sign-in|sign-up|reset-password)(\/|$)/.test(pathname)) return false;
  if (redirectedRecently()) return false;
  leaving = true;
  const carry = continuationSearch(search);
  const clear = () => {
    leaving = false;
    queryClient.setQueryData(sessionOptions.queryKey, null);
    queryClient.removeQueries({ queryKey: ["account"] });
    void queryClient.cancelQueries({ queryKey: ["trial"] });
    queryClient.removeQueries({ queryKey: ["trial"] });
  };
  if (pathname === "/try" || pathname.startsWith("/try/")) {
    const target = {
      to: "/sign-up",
      search: { ...carry, return: "free-practice" },
    } as const;
    void router
      .preloadRoute(target)
      .catch(() => undefined)
      .then(() => router.navigate({ ...target, replace: true }))
      .finally(clear);
  } else {
    const target = { to: "/sign-in", search: carry } as const;
    void router
      .preloadRoute(target)
      .catch(() => undefined)
      .then(() => router.navigate({ ...target, replace: true }))
      .finally(clear);
  }
  return true;
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
