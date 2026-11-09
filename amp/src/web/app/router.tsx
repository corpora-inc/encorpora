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
  useMatch,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useRef } from "react";
import type { AuthSession } from "../auth";
import { setPitchShown } from "../lib/analytics";
import { CurriculumDetailsProvider } from "../features/curriculum/CurriculumDetails";
import { AppShell } from "./AppShell";
import { nativeRuntime } from "../native-runtime";
import { hasAccountContext } from "../lib/account-page";
import {
  authConfigOptions,
  MOUNT_REFETCH_AFTER_MS,
  queryClient,
  sessionOptions,
  meKey,
  meOptions,
} from "../lib/query";
import type { Me } from "../../account/contracts";
import { useLearnerStore } from "../learner-store";
import { practicingAsAdult } from "../lib/adult-learner";
import { LoadingScreen, RouteError } from "../ui/LoadingScreen";
import {
  familyClassPath,
  homePlace,
  placeOfPath,
  startDestination,
  startNavigation,
} from "../features/onboarding/guard";
import {
  rememberPlace,
  rememberedPlace,
} from "../features/onboarding/place-memory";
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
import {
  clearStudentDevice,
  studentSession,
  studentSignInEnded,
} from "../lib/student-device";
import { workbookSearchSchema } from "../features/workbooks/model";
import { preload } from "../features/school/api";
import { approvalsOptions } from "../features/family-approval/api";
import { classYearOptions } from "../features/school/org/org-api";
import { frameData, schoolRoutes, staffScreen } from "./school-routes";
import { loadCurriculum, loadScope } from "../features/schools/api";
import {
  marksSearchSchema,
  stackSearchSchema,
  standingsSearchSchema,
} from "../features/school/classroom/search";
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
        "school",
        "school-invite",
        "family-approval",
      ])
      .optional()
      .catch(undefined),
    /** Where a school sign-in continues; `continuationSearch` checks it. */
    next: z.string().max(300).optional().catch(undefined),
    entry: signupEntrySchema.optional().catch(undefined),
    program: z.enum(["ar-efa", "az-esa", "nh-efa"]).optional().catch(undefined),
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
  component: () => (
    <CurriculumDetailsProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CurriculumDetailsProvider>
  ),
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
            result.program === "ar-efa" ||
            result.program === "az-esa" ||
            result.program === "nh-efa"
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
  beforeLoad: async ({ location, preload }) => {
    if (nativeRuntime) return;
    if (knownStale()) {
      window.location.assign(location.href);
      return new Promise<never>(() => {});
    }
    // One refresh belongs to a new screen, shared by the frame, route
    // guards and late chunks. Filters and cards on that screen reuse it.
    // Cached screens stay visible while the refresh runs.
    // Auth and public school pages load without the account whose session
    // ended. Private child routes enforce their own session requirements.
    if (
      preload ||
      !hasAccountContext(location.pathname) ||
      router.state.resolvedLocation?.pathname === location.pathname
    )
      return;
    const session = await queryClient
      .ensureQueryData(sessionOptions)
      .catch(() => undefined);
    if (session)
      void queryClient
        .fetchQuery({ ...meOptions(session), staleTime: 0 })
        .catch(() => undefined); // The resource's observer owns its error UI.
  },
  pendingMs: 600_000,
});
const legacy = lazyRouteComponent(() => import("./LegacyApp"), "LegacyApp");
const pitch = lazyRouteComponent(
  () => import("../features/pitch/PitchScreen"),
  "PitchScreen",
);
/** A signed-out web visitor at `/` meets the parent pitch. A consent email
 * or a payment return opened signed out keeps the app's sign-in prompt,
 * which resumes it. */
function showsPitch(session: AuthSession | null | undefined) {
  return (
    !nativeRuntime &&
    session === null &&
    !hasInitialConsentChallenge() &&
    !hasPurchaseReturn(window.location.search)
  );
}
/** The pitch or the app. Home (`/`) and every other app path render here, in
 * one layout route, so going between them keeps the same app screen mounted:
 * the current problem, the learner and each tab's place survive a visit to
 * home. At `/` the pitch is what the route resolved; elsewhere it is the app.
 * When the session changes at `/`, the route runs again (redirecting as
 * needed) before the screen changes, so a remount never shows the other
 * screen half-loaded. */
function AppScreen() {
  const session = useQuery(sessionOptions);
  const router = useRouter();
  const atHome = useMatch({
    from: home.id,
    shouldThrow: false,
    select: (match) => ({
      pitch: match.loaderData?.pitch,
      settled: match.status === "success",
    }),
  });
  const shown = !!atHome && showsPitch(session.data);
  useEffect(() => {
    if (atHome?.pitch !== undefined && shown !== atHome.pitch)
      void router.invalidate();
  }, [atHome?.pitch, shown]);
  // A screen is rendered only once its route has loaded (its chunk with it),
  // so on first load, and when changing between the pitch and the app, the
  // route's own pending and error screens show. Moving between app paths
  // keeps the app screen up, so its state survives.
  const settled = useRouterState({
    select: (state) => state.matches.at(-1)?.status === "success",
  });
  const kind = atHome?.pitch ? "pitch" : "app";
  const shownKind = useRef<string | null>(null);
  const deciding = !settled || (!!atHome && atHome.pitch === undefined);
  const pending = deciding && shownKind.current !== kind;
  if (!pending) shownKind.current = kind;
  const Screen = kind === "pitch" ? pitch : legacy;
  // Keyed, so the route's pending screen is replaced, not left hidden behind
  // the screen's own wait.
  return (
    <Suspense key={pending ? "deciding" : kind} fallback={<LoadingScreen />}>
      {pending ? <Outlet /> : <Screen />}
    </Suspense>
  );
}
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
/** A school sets its students up; setup, trials and paper self-marking are for
 * families, so a student's URL goes back to practice. */
function notForStudents() {
  if (studentSession()) throw redirect({ to: "/", replace: true });
}
/** Every /start step runs the one first-run guard against `/me`. */
async function beforeStart({
  location,
}: {
  location: { pathname: string; search: Record<string, unknown> };
}) {
  notForStudents();
  const search = continuationSearch(location.search);
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in", search });
  if (nativeRuntime) return;
  const me = await queryClient.ensureQueryData(meOptions(session));
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
  notForStudents();
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
/** Trial screens show Buy from their first paint: its prices load first. */
async function loadTrialBuy({ location }: { location: { search: unknown } }) {
  if (nativeRuntime) return;
  const { loadBuyData } = await import("../features/pitch/BuyOptions");
  await loadBuyData(location.search as Record<string, unknown>);
}
const tryPractice = createRoute({
  getParentRoute: () => root,
  path: "/try/practice",
  beforeLoad: beforeTrial,
  loader: loadTrialBuy,
  component: trial("TrialPractice"),
});
const tryMap = createRoute({
  getParentRoute: () => root,
  path: "/try/map",
  beforeLoad: beforeTrial,
  loader: async (args) => {
    const { progressOptions, trialSessionOptions } =
      await import("../features/trial/api");
    await Promise.all([
      loadTrialBuy(args),
      queryClient
        .ensureQueryData(trialSessionOptions)
        .then((session) =>
          session
            ? queryClient.fetchQuery({
                ...progressOptions(session),
                // Answers mark this resource stale. Await the new count before
                // deciding whether an empty assessment should return to practice.
                // A just-loaded checkpoint is shared with its destination.
                staleTime: MOUNT_REFETCH_AFTER_MS,
              })
            : null,
        )
        .catch(() => {
          // The destination owns retry and expired-assessment recovery through
          // these query errors; the route only waits for the read to settle.
        }),
    ]);
  },
  component: trial("TrialMap"),
});
const tryPlans = createRoute({
  getParentRoute: () => root,
  path: "/try/plans",
  beforeLoad: beforeTrial,
  component: trial("Paywall"),
});
const appScreen = createRoute({
  getParentRoute: () => root,
  id: "app",
  component: AppScreen,
});
const home = createRoute({
  getParentRoute: () => appScreen,
  path: "/",
  loaderDeps: ({ search }) => ({ program: search.program }),
  loader: async ({ deps }) => {
    const shown = showsPitch(queryClient.getQueryData(sessionOptions.queryKey));
    setPitchShown(shown);
    if (!shown) await legacy.preload?.();
    else {
      const { loadPitch } = await import("../features/pitch/PitchScreen");
      await loadPitch(deps);
    }
    return { pitch: shown };
  },
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
          .ensureQueryData(meOptions(session))
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
        // Arriving at `/` opens where this person last worked: a school, or
        // their family side. Back and Forward reopen what `/` showed then.
        if (me?.signedIn && !traversing()) {
          const place = homePlace(me, rememberedPlace(me.account.id));
          if (place === "me")
            throw redirect({ to: "/me", replace: true } as never);
          // A family's side is its class, once a child can practice; until
          // then first-run routing below guides the parent there.
          if (place === "home" && me.familyClass && me.next === "practice")
            throw redirect({
              to: "/$",
              params: { _splat: familyClassPath(me.familyClass) },
              replace: true,
            });
          if (place !== "home")
            throw redirect({
              to: "/$",
              params: {
                _splat:
                  place === "schools" ? "school" : `school/${place.slice(7)}`,
              },
              replace: true,
            });
        }
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
/** The pitch/app screen reads what `/` resolved; so does the document head.
 * A route's id exists once the router is built, so this reads it on demand. */
export const homeRouteId = () => home.id;
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
/** Screens on the app frame know who is signed in before they paint, so
 * the frame's bar is there from their first frame and nothing moves under it. */
async function framedScreen() {
  if (nativeRuntime) throw redirect({ to: "/" });
  await queryClient.ensureQueryData(sessionOptions).catch(() => undefined);
}
const inventory = createRoute({
  getParentRoute: () => root,
  path: "/inventory",
  // A learning record belongs to an account: signed out, sign in first.
  beforeLoad: async ({ location }) => {
    await framedScreen();
    if (!queryClient.getQueryData(sessionOptions.queryKey))
      throw redirect({
        to: "/sign-in",
        search: continuationSearch(location.search),
      });
  },
  component: lazyRouteComponent(
    () => import("../features/inventory/InventoryScreen"),
    "InventoryScreen",
  ),
});
const pathways = createRoute({
  getParentRoute: () => root,
  path: "/pathways",
  beforeLoad: framedScreen,
  component: lazyRouteComponent(
    () => import("../features/pathways/PathwaysScreen"),
    "PathwaysScreen",
  ),
});
const pathwaySkill = createRoute({
  getParentRoute: () => root,
  path: "/pathways/$skillId",
  beforeLoad: framedScreen,
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
    notForStudents();
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
    notForStudents();
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
    notForStudents();
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
/** Where a student signs in, and where an ended sign-in lands. */
/** One chunk for all of student sign-in, so each next step is already here. */
const joinScreens = () => import("../features/school/join");
const join = createRoute({
  getParentRoute: () => root,
  path: "/join",
  component: lazyRouteComponent(joinScreens, "JoinScreen"),
});
/** Back from a school account's sign-in. The session is in the fragment, which
 * `card-entry` has already taken out of the address bar. */
const joinContinue = createRoute({
  getParentRoute: () => root,
  path: "/join/continue",
  component: lazyRouteComponent(joinScreens, "ContinueScreen"),
});
const joinClass = createRoute({
  getParentRoute: () => root,
  path: "/join/$code",
  component: lazyRouteComponent(joinScreens, "ClassScreen"),
});
const joinPictures = createRoute({
  getParentRoute: () => root,
  path: "/join/$code/$person",
  component: lazyRouteComponent(joinScreens, "PicturesScreen"),
});
/** A printed card's link. Its secret is in the fragment, which `card-entry`
 * has already taken out of the address bar. */
const signInCard = createRoute({
  getParentRoute: () => root,
  path: "/c",
  component: lazyRouteComponent(joinScreens, "CardScreen"),
});
/** A class's staff screens. Each is its own child, and the API decides who
 * reaches which class. */
const classScreens = () => import("../features/school/classes");
const schoolClass = createRoute({
  getParentRoute: () => root,
  path: "/school/$org/classes/$class",
  beforeLoad: staffScreen,
  loader: ({ context, params }) =>
    Promise.all([
      frameData((context as { session: AuthSession }).session, params.org),
      preload(
        classYearOptions(
          (context as { session: AuthSession }).session,
          params.class,
        ),
      ),
    ]),
});
const schoolClassHome = createRoute({
  getParentRoute: () => schoolClass,
  path: "/",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/school/$org/classes/$class/today",
      params,
      replace: true,
    });
  },
});
const schoolClassToday = createRoute({
  getParentRoute: () => schoolClass,
  path: "today",
  // A family's own class lists children from other families: there before
  // the screen paints.
  loader: async ({ context, params }) => {
    const session = (context as { session: AuthSession }).session;
    const me = await queryClient
      .ensureQueryData(meOptions(session))
      .catch(() => null);
    if (me?.signedIn && me.familyClass?.classId === params.class)
      await preload(approvalsOptions(session));
  },
  component: lazyRouteComponent(classScreens, "TodayScreen"),
});
const schoolClassMap = createRoute({
  getParentRoute: () => schoolClass,
  path: "map",
  component: lazyRouteComponent(classScreens, "MapScreen"),
});
const schoolClassGradebook = createRoute({
  getParentRoute: () => schoolClass,
  path: "gradebook",
  component: lazyRouteComponent(classScreens, "GradebookScreen"),
});
const schoolClassTime = createRoute({
  getParentRoute: () => schoolClass,
  path: "time",
  component: lazyRouteComponent(classScreens, "TimeScreen"),
});
const schoolClassReportCards = createRoute({
  getParentRoute: () => schoolClass,
  path: "report-cards",
  component: lazyRouteComponent(classScreens, "ReportCardScreen"),
});
const schoolClassSettings = createRoute({
  getParentRoute: () => schoolClass,
  path: "settings",
  component: lazyRouteComponent(
    () => import("../features/school/ClassesScreen"),
    "ClassScreen",
  ),
});
const schoolClassRoster = createRoute({
  getParentRoute: () => schoolClass,
  path: "roster",
  component: lazyRouteComponent(classScreens, "RosterScreen"),
});
const schoolClassStart = createRoute({
  getParentRoute: () => schoolClass,
  path: "start",
  component: lazyRouteComponent(classScreens, "StartClassScreen"),
});
const schoolClassCards = createRoute({
  getParentRoute: () => schoolClass,
  path: "cards",
  validateSearch: z.object({
    student: z.uuid().optional().catch(undefined),
  }),
  component: lazyRouteComponent(classScreens, "CardsScreen"),
});
const classroomScreens = () => import("../features/school/classroom");
const schoolClassExperience = createRoute({
  getParentRoute: () => schoolClass,
  path: "experience",
  component: lazyRouteComponent(classroomScreens, "ClassExperienceScreen"),
});
const schoolClassWorkbooks = createRoute({
  getParentRoute: () => schoolClass,
  path: "workbooks",
  validateSearch: stackSearchSchema,
  component: lazyRouteComponent(classroomScreens, "WorkbookStackScreen"),
});
const schoolClassMarks = createRoute({
  getParentRoute: () => schoolClass,
  path: "workbooks/$date",
  validateSearch: marksSearchSchema,
  component: lazyRouteComponent(classroomScreens, "MarkingScreen"),
});
/** A student's board, in its own chunk: a student's device never loads a staff
 * screen. Anyone else, or a class with it off, goes back to the app. */
const standings = createRoute({
  getParentRoute: () => root,
  path: "/standings",
  validateSearch: standingsSearchSchema,
  beforeLoad: () => {
    if (!studentSession()) throw redirect({ to: "/", replace: true });
  },
  // Which boards this student has is known before the screen paints, so a
  // class picker is there from the first frame and never pushes the board
  // down. A failure is the screen's to show.
  loader: async () => {
    const { standingsBoardsOptions } =
      await import("../features/school/classroom/api");
    const session = await queryClient.ensureQueryData(sessionOptions);
    await queryClient
      .ensureQueryData(standingsBoardsOptions(session ?? null))
      .catch((error) => console.warn("Standings didn’t load ahead", error));
  },
  component: lazyRouteComponent(
    () => import("../features/school/classroom/StandingsScreen"),
    "StandingsScreen",
  ),
});
/** The adult's own practice: their record, and where they begin. One chunk.
 * Arriving chooses their own learner, so practice and the drawer follow. */
const ownScreens = () => import("../features/me");
async function ownPractice() {
  notForStudents();
  if (nativeRuntime) throw redirect({ to: "/", replace: true });
  // Signed out: sign in, and `/` brings them back to their own practice.
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
  const me = await queryClient.ensureQueryData(meOptions(session));
  if (!me.signedIn) throw redirect({ to: "/sign-in" });
  return { me, session };
}
const ownRecord = createRoute({
  getParentRoute: () => root,
  path: "/me",
  beforeLoad: async () => {
    const { me, session } = await ownPractice();
    const own = me.adultPractice?.learner;
    // Nothing to read yet: start, when they may; otherwise there's no place.
    if (!own)
      throw redirect({
        to: me.adultPractice?.eligible ? "/me/start" : "/",
        replace: true,
      } as never);
    useLearnerStore.getState().select(own.id);
    return { session };
  },
  loader: ({ context }) =>
    loadOwnPractice((context as { session: AuthSession }).session),
  component: lazyRouteComponent(ownScreens, "OwnRecordScreen"),
});
const ownStart = createRoute({
  getParentRoute: () => root,
  path: "/me/start",
  beforeLoad: async () => {
    const { me } = await ownPractice();
    if (me.adultPractice?.learner)
      throw redirect({ to: "/me", replace: true } as never);
    if (!me.adultPractice?.eligible) throw redirect({ to: "/", replace: true });
  },
  component: lazyRouteComponent(ownScreens, "OwnStartScreen"),
});
async function loadOwnPractice(session: AuthSession) {
  const { ownPracticeOptions } = await import("../features/me/api");
  await queryClient
    .ensureQueryData(ownPracticeOptions(session))
    .catch(() => undefined);
}
/** The public school pages, one chunk between them. */
const schoolsPublic = () => import("../features/schools");
const notInTheApp = () => {
  if (nativeRuntime) throw redirect({ to: "/", replace: true });
};
const schoolsHome = createRoute({
  getParentRoute: () => root,
  path: "/schools",
  beforeLoad: notInTheApp,
  loader: loadCurriculum,
  component: lazyRouteComponent(schoolsPublic, "SchoolsScreen"),
});
const schoolsScope = createRoute({
  getParentRoute: () => root,
  path: "/schools/scope-and-sequence",
  beforeLoad: notInTheApp,
  loader: loadScope,
  component: lazyRouteComponent(schoolsPublic, "ScopeScreen"),
});
const schoolsTrust = createRoute({
  getParentRoute: () => root,
  path: "/schools/trust",
  beforeLoad: notInTheApp,
  component: lazyRouteComponent(schoolsPublic, "TrustScreen"),
});
/** A family's progress link. Its secret is in the fragment, which `share-entry`
 * has already taken out of the address bar. */
const familyLink = createRoute({
  getParentRoute: () => root,
  path: "/p",
  component: lazyRouteComponent(
    () => import("../features/schools/ParentScreen"),
    "ParentScreen",
  ),
});
/** Another family's teacher asked for this parent's child (step 5): the
 * link from mail or a copy, then this parent's own page about the child. */
const familyApprove = createRoute({
  getParentRoute: () => root,
  path: "/family/approve",
  beforeLoad: () => {
    if (nativeRuntime || studentSession())
      throw redirect({ to: "/", replace: true });
  },
  component: lazyRouteComponent(
    () => import("../features/family-approval/ApproveLinkScreen"),
    "ApproveLinkScreen",
  ),
});
const familyApproval = createRoute({
  getParentRoute: () => root,
  path: "/family/approvals/$approvalId",
  beforeLoad: async () => {
    notForStudents();
    if (nativeRuntime) throw redirect({ to: "/", replace: true });
    const session = await queryClient.ensureQueryData(sessionOptions);
    if (!session) throw redirect({ to: "/sign-in", replace: true });
  },
  component: lazyRouteComponent(
    () => import("../features/family-approval/ApprovalScreen"),
    "ApprovalScreen",
  ),
});
const fallback = createRoute({
  getParentRoute: () => appScreen,
  path: "/$",
  // The app screen is rendered by the layout, so load its chunk here, as the
  // route's own component would have been.
  loader: async () => {
    await legacy.preload?.();
  },
});
const history = nativeRuntime
  ? createMemoryHistory({ initialEntries: ["/"] })
  : createBrowserHistory();
// Subscribed before the router, so a route's `beforeLoad` knows how it came.
let lastAction: string | null = null;
history.subscribe(({ action }) => {
  lastAction = action.type;
});
/** A Back, Forward or jump through history rather than an arrival. */
function traversing() {
  return (
    lastAction === "BACK" || lastAction === "FORWARD" || lastAction === "GO"
  );
}
export const router = createRouter({
  routeTree: root.addChildren([
    appScreen.addChildren([home, fallback]),
    join,
    joinContinue,
    joinClass,
    joinPictures,
    signInCard,
    schoolClass.addChildren([
      schoolClassHome,
      schoolClassToday,
      schoolClassMap,
      schoolClassGradebook,
      schoolClassTime,
      schoolClassReportCards,
      schoolClassSettings,
      schoolClassRoster,
      schoolClassStart,
      schoolClassCards,
      schoolClassExperience,
      schoolClassWorkbooks,
      schoolClassMarks,
    ]),
    standings,
    ownRecord,
    ownStart,
    schoolsHome,
    schoolsScope,
    schoolsTrust,
    familyLink,
    familyApprove,
    familyApproval,
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
    // Linked to through the splat route, as every staff screen is, so their
    // URLs stay out of the typed route table.
    ...(schoolRoutes(root) as unknown as []),
  ]),
  history,
  defaultPendingComponent: LoadingScreen,
  defaultPendingMs: 250,
  defaultPendingMinMs: 0,
});
// Each screen a signed-in person settles on records its place, so `/` can
// return to it next time.
router.subscribe("onResolved", ({ toLocation }) => {
  const session = queryClient.getQueryData(sessionOptions.queryKey);
  if (!session || studentSession()) return;
  const me = queryClient.getQueryData<Me>(meKey(session.accountId));
  const chosen = useLearnerStore.getState().learnerId;
  const place = placeOfPath(
    toLocation.pathname,
    toLocation.search as Record<string, unknown>,
    me?.signedIn && practicingAsAdult(me, chosen) ? chosen : null,
  );
  if (place) rememberPlace(session.accountId, place);
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
let checkingStudent = false;
/** A student's sign-in has ended and /join is loading. Requests that still
 * carry it wait for the screen to be replaced, as a parent's do; none of them
 * is a parent's ended sign-in. */
let leavingStudent = false;
onSignedOut(() => {
  if (leavingStudent) return true;
  const student = studentSession();
  if (student) {
    // A student's ended sign-in goes to /join. Any other route that refuses a
    // student fails where it stands, without signing the class out.
    if (!checkingStudent) {
      checkingStudent = true;
      void studentSignInEnded(student)
        .then(async (ended) => {
          if (!ended) return;
          leavingStudent = true;
          clearStudentDevice();
          try {
            await router.navigate({ to: "/join", replace: true });
          } finally {
            queryClient.setQueryData(sessionOptions.queryKey, null);
            queryClient.removeQueries({ queryKey: ["account"] });
            queryClient.removeQueries({ queryKey: ["trial"] });
            leavingStudent = false;
          }
        })
        .catch((error) =>
          console.warn("Student sign-in could not be checked", error),
        )
        .finally(() => {
          checkingStudent = false;
        });
    }
    return false;
  }
  // Several requests from one screen can fail together: one redirect, and the
  // rest wait silently for the screen to be replaced.
  if (leaving) return true;
  const { pathname, search } = router.state.location;
  // Sign-in screens, a student's included, have no sign-in to leave.
  if (/^\/(sign-in|sign-up|reset-password|join|c)(\/|$)/.test(pathname))
    return false;
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
