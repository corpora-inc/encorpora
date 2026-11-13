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
import { lazy, Suspense, useEffect, useRef } from "react";
import { readContinuation } from "../features/continue/memory";
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
import { practicingAsAdult, practicingAsProfile } from "../lib/adult-learner";
import { LoadingScreen, RouteError } from "../ui/LoadingScreen";
import { closeAllPopovers } from "../ui/popover-owner";
import {
  familyClassPath,
  homePlace,
  isStarterChoice,
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
import { orgsOptions, preload } from "../features/school/api";
import { prepareBuyerHandoff } from "../features/school/pilots/buyer-session";
import { prepareSchoolAdoption } from "../features/school/adoption-session";
import { SMALL_CLASS } from "../features/navigation/shell-frame";
import { approvalsOptions } from "../features/family-approval/api";
import { secondParentOptions } from "../features/second-parent/api";
import { classYearOptions } from "../features/school/org/org-api";
import { frameData, schoolRoutes, staffScreen } from "./school-routes";
import { loadCurriculum, loadScope } from "../features/schools/api";
import {
  marksSearchSchema,
  stackSearchSchema,
  standingsSearchSchema,
} from "../features/school/classroom/search";
import { designAllowed, designSearchSchema } from "../features/design/search";
import { stampPrevious, VIEW_KEYS } from "../lib/return-to";
import {
  MAX_LAYERS,
  OPEN_KEY,
  pushLayer,
  readStack,
  work,
  writeStack,
} from "../nav/entities";
import {
  adoptPracticeMode,
  isLearningPath,
  MODE_KEYS,
} from "../features/profiles/practice-mode";
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
/** "Add Child 2's name", once "Continue with AMP" has made access active. Its
 * chunk loads only on the screen the purchase returned to. */
const AfterPurchase = lazy(() =>
  import("../features/continue/AfterPurchase").then((module) => ({
    default: module.AfterPurchase,
  })),
);
function AfterPurchaseGate() {
  const session = useQuery(sessionOptions).data;
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const waiting =
    !!session &&
    readContinuation(session.accountId)?.stage === "naming" &&
    !!pathname;
  return waiting ? (
    <Suspense fallback={null}>
      <AfterPurchase />
    </Suspense>
  ) : null;
}
const root = createRootRoute({
  component: () => (
    <CurriculumDetailsProvider>
      <AppShell>
        <Outlet />
      </AppShell>
      <AfterPurchaseGate />
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
  const watchingFilm = useMatch({
    from: "/app/lessons/$templateId/watch",
    shouldThrow: false,
  });
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
      {pending ? (
        <Outlet />
      ) : (
        <>
          <div style={{ display: watchingFilm ? "none" : "contents" }}>
            <Screen />
          </div>
          {watchingFilm && <Outlet />}
        </>
      )}
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
/** A school sets its students up; setup and paper self-marking are for
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
/** The separate free trial is retired: one product, one way in. Links to
 * `/try` from ads and email still work: signed out, they sign up (and the
 * starter follows); signed in, `/` opens their place or the starter. */
async function retiredTrial({ search }: { search: Record<string, unknown> }) {
  notForStudents();
  const session = await queryClient
    .ensureQueryData(sessionOptions)
    .catch(() => null);
  if (!session) {
    // An old free-practice link signs up as one, keeping a funded program's
    // context (the funding pages link here); an explicit return stays.
    const carry = continuationSearch(search);
    throw redirect({
      to: "/sign-up",
      search: { ...carry, return: carry.return ?? "free-practice" },
      replace: true,
    });
  }
  // A follow-up email's way back, now signed in: the follow-up is done.
  if (search.return === "free-practice")
    void fetch("/api/v1/parent-followup/complete", {
      signal: AbortSignal.timeout(10000),
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
  throw redirect({ to: "/", replace: true });
}
const tryStart = createRoute({
  getParentRoute: () => root,
  path: "/try",
  beforeLoad: retiredTrial,
});
const tryAnything = createRoute({
  getParentRoute: () => root,
  path: "/try/$",
  beforeLoad: retiredTrial,
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
      // The lazy screen's own chunk too: rendering it before it has loaded
      // suspends inside TanStack's Lazy with `use()`, which React then
      // reports as a conditional use() once it resolves.
      const [{ loadPitch }] = await Promise.all([
        import("../features/pitch/PitchScreen"),
        pitch.preload?.(),
      ]);
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
          .fetchQuery({ ...meOptions(session), staleTime: 0 })
          .catch(() => queryClient.getQueryData(meOptions(session).queryKey));
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
        // their family side. Back and Forward reopen what `/` showed then,
        // and for a place that is the place again: `/` never shows a
        // place's account its first run (docs/design/ia.md, Navigation).
        const place = me?.signedIn
          ? homePlace(me, rememberedPlace(me.account.id))
          : null;
        if (me?.signedIn && place && (!traversing() || place !== "home")) {
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
        // Resolve first-run routing before mounting the app shell, so a new
        // account never sees home before the starter.
        if (
          me?.signedIn &&
          me.next !== "practice" &&
          me.next !== "accept-gift"
        ) {
          const target = startDestination(me, "/", !!chosenPlan());
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
/** Account → Sign-in → Delete my account (features/account/DeleteAccount):
 * what goes, then a typed confirmation; and the page after it. */
const deleteAccountScreens = () => import("../features/account/DeleteAccount");
const deleteAccount = createRoute({
  getParentRoute: () => root,
  path: "/family/security/delete",
  beforeLoad: async () => {
    notForStudents();
    const session = await queryClient.ensureQueryData(sessionOptions);
    if (!session) throw redirect({ to: "/sign-in" });
    return { session };
  },
  // What the account holds arrives with the screen, so the list paints whole.
  loader: async ({ context: { session } }) => {
    const { deletionPreviewOptions } =
      await import("../features/account/delete-api");
    await queryClient
      .ensureQueryData(deletionPreviewOptions(session))
      .catch((error) =>
        console.warn("What the account holds didn’t load ahead", error),
      );
  },
  component: lazyRouteComponent(deleteAccountScreens, "DeleteAccountScreen"),
});
const accountDeleted = createRoute({
  getParentRoute: () => root,
  path: "/account/deleted",
  component: lazyRouteComponent(deleteAccountScreens, "AccountDeletedScreen"),
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
/** "What brings you to AMP?", at `/start` and `/start/<choice>`, the same
 * screen. Any signed-in adult may open it to add a place; an unknown choice
 * opens the question itself. */
async function beforeStarter({ params }: { params: { choice?: string } }) {
  notForStudents();
  if (nativeRuntime) throw redirect({ to: "/", replace: true });
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) throw redirect({ to: "/sign-in" });
  if (params.choice !== undefined && !isStarterChoice(params.choice))
    throw redirect({ to: "/start", replace: true });
}
const starter = lazyRouteComponent(
  () => import("../features/onboarding/Starter"),
  "Starter",
);
const starterIndex = createRoute({
  getParentRoute: () => root,
  path: "/start",
  beforeLoad: beforeStarter,
  component: starter,
});
const starterChoice = createRoute({
  getParentRoute: () => root,
  path: "/start/$choice",
  beforeLoad: beforeStarter,
  component: starter,
});
/** A parent's or a tutor's setup after its first step:
 * `/start/parent/practice`, `/start/parent/second-parent`, `/start/parent/ready`,
 * `/start/tutor/join` and `/start/tutor/ready`. */
const starterStep = createRoute({
  getParentRoute: () => root,
  path: "/start/$choice/$step",
  beforeLoad: beforeStarter,
  component: lazyRouteComponent(
    () => import("../features/onboarding/Starter"),
    "StarterStep",
  ),
});
/** The plan before any learner, for a parent approving another family's
 * child: their payment is the consent the approval needs. Anyone else who
 * opens a saved link to it goes where the first-run guard says. */
const startPlan = createRoute({
  getParentRoute: () => root,
  path: "/start/plan",
  beforeLoad: beforeStart,
  component: start,
});
/** "Continue with AMP" for one learner: the plan, then Stripe, then back to
 * the screen it was opened from. */
const continueWithAmp = createRoute({
  getParentRoute: () => root,
  path: "/continue/$learnerId",
  validateSearch: (search: Record<string, unknown>) =>
    search.interval === "year" || search.interval === "month"
      ? { interval: search.interval as "year" | "month" }
      : {},
  beforeLoad: async () => {
    notForStudents();
    if (nativeRuntime) throw redirect({ to: "/", replace: true });
    const session = await queryClient.ensureQueryData(sessionOptions);
    if (!session) throw redirect({ to: "/sign-in" });
  },
  component: lazyRouteComponent(
    () => import("../features/continue/ContinueScreen"),
    "ContinueScreen",
  ),
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
/** A learning screen's data before it renders (lib/learning-view), its code
 * loaded only when one is visited. */
async function preloadLearning() {
  const { preloadLearningView } = await import("../lib/learning-view");
  await preloadLearningView();
}
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
    await adoptPracticeMode(location);
    if (!queryClient.getQueryData(sessionOptions.queryKey))
      throw redirect({
        to: "/sign-in",
        search: continuationSearch(location.search),
      });
  },
  // Its record and level arrive with it: one paint, whole.
  loader: preloadLearning,
  component: lazyRouteComponent(
    () => import("../features/inventory/InventoryScreen"),
    "InventoryScreen",
  ),
});
/** A screen's address from before lesson layers (`?lesson=<type>`): the
 * same screen with the lesson as a layer over it (nav/entities.ts). */
function lessonAsLayer(location: {
  pathname: string;
  search: Record<string, unknown>;
}) {
  const { lesson, ...search } = location.search;
  if (lesson === undefined) return;
  const open =
    typeof lesson === "string"
      ? pushLayer(search[OPEN_KEY], { kind: "lesson", id: lesson })
      : (search[OPEN_KEY] as string | undefined);
  throw redirect({
    href: router.buildLocation({
      to: location.pathname,
      search: { ...search, ...(open ? { [OPEN_KEY]: open } : {}) } as never,
    }).href,
    replace: true,
  });
}
/** Pathways' skill from before skill layers (`/pathways/<skill>`, or
 * `?skill=<skill>`): the map with the skill as a layer over it, under any
 * layers the address already holds (a lesson). */
function skillAsLayer(
  location: { search: Record<string, unknown> },
  skill: unknown,
) {
  const { skill: _legacy, ...search } = location.search;
  const below = readStack(search[OPEN_KEY]);
  const open =
    typeof skill === "string"
      ? writeStack(
          [{ kind: "skill" as const, id: skill }, ...below].slice(
            0,
            MAX_LAYERS,
          ),
        )
      : writeStack(below);
  throw redirect({
    href: router.buildLocation({
      to: "/pathways",
      search: { ...search, [OPEN_KEY]: open } as never,
    }).href,
    replace: true,
  });
}
/** One map for the whole curriculum: a skill opens over it as a layer
 * (`?open=skill:<id>`), so choosing or closing one changes the address,
 * never the map (its camera, full screen and orbit stay as they were). */
const pathways = createRoute({
  getParentRoute: () => root,
  path: "/pathways",
  beforeLoad: async ({ location }) => {
    lessonAsLayer(location);
    const { skill } = location.search as { skill?: unknown };
    if (skill !== undefined && location.pathname === "/pathways")
      skillAsLayer(location, skill);
    await framedScreen();
    await adoptPracticeMode(location);
  },
  // The curriculum and the learner's record arrive with it: one paint. A
  // problem type's short lesson (a layer, `?open=lesson:<type>`) needs
  // neither: it opens at once over the map, which fills in under it.
  loader: ({ location }) => {
    const open = new URLSearchParams(location.searchStr).get(OPEN_KEY);
    if (!readStack(open).some((layer) => layer.kind === "lesson"))
      return preloadLearning();
    void preloadLearning().catch((error: unknown) =>
      console.error("The map did not preload", error),
    );
  },
  component: lazyRouteComponent(
    () => import("../features/pathways/PathwaysScreen"),
    "PathwaysScreen",
  ),
});
const pathwaysIndex = createRoute({
  getParentRoute: () => pathways,
  path: "/",
});
/** The lessons library is no destination of its own (docs/design/ia.md):
 * `/lessons` opens Pathways, its search carrying any query. A lesson's own
 * address (`/lessons/<id>`) still opens its reader. */
const lessonsHome = createRoute({
  getParentRoute: () => root,
  path: "/lessons",
  beforeLoad: ({ location }) => {
    const params = new URLSearchParams(location.searchStr);
    const query = params.get("q")?.trim();
    // `?topic=` named a problem type's short lesson: Pathways opens it.
    const lesson = params.get("topic")?.trim();
    throw redirect({
      to: "/pathways",
      search: {
        ...(query ? { topic: query } : {}),
        ...(lesson
          ? { [OPEN_KEY]: pushLayer(undefined, { kind: "lesson", id: lesson }) }
          : {}),
      } as never,
      replace: true,
    });
  },
});
const pathwaySkill = createRoute({
  getParentRoute: () => pathways,
  path: "$skillId",
  beforeLoad: ({ location, params }) => skillAsLayer(location, params.skillId),
});
/** A learner's workbooks are a tab of their Progress: arriving chooses
 * that learner (the account's own, never a practice profile), so the
 * group's other tabs and Practice are theirs too. The server still decides
 * what the account may open. */
async function beforeWorkbooks<Params extends { learnerId: string }>({
  params,
}: {
  params: Params;
}) {
  const { learnerId } = params;
  if (nativeRuntime) throw redirect({ to: "/" });
  notForStudents();
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) return;
  const me = await queryClient
    .ensureQueryData(meOptions(session))
    .catch(() => null);
  if (
    me?.signedIn &&
    me.family.learners.some(
      (learner) =>
        learner.id === learnerId && !learner.deletedAt && !learner.simulation,
    )
  )
    useLearnerStore.getState().select(learnerId);
}
/** Daily paper workbooks for one learner (features/workbooks). */
const workbookHistory = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks",
  beforeLoad: beforeWorkbooks,
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookHistoryScreen"),
    "WorkbookHistoryScreen",
  ),
});
const workbookDay = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks/$date",
  validateSearch: (search) => workbookSearchSchema.parse(search),
  beforeLoad: beforeWorkbooks,
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookDayScreen"),
    "WorkbookDayScreen",
  ),
});
const workbookResults = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks/$workbookId/results",
  beforeLoad: beforeWorkbooks,
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
      import("../features/school/pilots/api").then(({ preloadClassPilot }) =>
        preloadClassPilot(
          (context as { session: AuthSession }).session,
          params.org,
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
  // Today's lesson from before layers (`?lesson=`): a layer over Today.
  beforeLoad: ({ location }) => lessonAsLayer(location),
  // A family's own class lists children from other families: there before
  // the screen paints.
  loader: async ({ context, params }) => {
    const session = (context as { session: AuthSession }).session;
    const me = await queryClient
      .ensureQueryData(meOptions(session))
      .catch(() => null);
    if (me?.signedIn && me.familyClass?.classId === params.class)
      await Promise.all([
        preload(approvalsOptions(session)),
        preload(secondParentOptions(session)),
      ]);
  },
  component: lazyRouteComponent(classScreens, "TodayScreen"),
});
/** The map with everything its first paint shows: a small class's map
 * (six or fewer, ClassMap.tsx) carries each learner's grade line, so its
 * gradebook loads with it rather than pushing the page down after. */
async function mapLoader({
  context,
  params,
}: {
  context: unknown;
  params: { org: string; class: string };
}) {
  const session = (context as { session: AuthSession }).session;
  const { mapOptions, gradebookOptions } =
    await import("../features/school/classes/teacher-api");
  const place = { org: params.org, class: params.class };
  const map = (await preload(mapOptions(session, place))) as
    { students?: unknown[] } | undefined;
  if (map && (map.students?.length ?? Infinity) <= SMALL_CLASS)
    await preload(gradebookOptions(session, place, undefined));
}
const schoolClassMap = createRoute({
  getParentRoute: () => schoolClass,
  path: "map",
  loader: mapLoader,
  component: lazyRouteComponent(classScreens, "MapScreen"),
});
/** The class map's student and answer addresses from before layers
 * (`map/<student>`, `map/<student>/work/<answer>`): a link or a history
 * entry still opens them, as layers over the map (nav/entities.ts). */
const schoolClassMapStudent = createRoute({
  getParentRoute: () => schoolClassMap,
  path: "$student",
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/school/$org/classes/$class/map",
      params,
      search: {
        ...(search as Record<string, unknown>),
        [OPEN_KEY]: pushLayer(undefined, {
          kind: "student",
          id: params.student,
        }),
      } as never,
      replace: true,
    });
  },
});
const schoolClassMapWork = createRoute({
  getParentRoute: () => schoolClassMapStudent,
  path: "work/$work",
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/school/$org/classes/$class/map",
      params,
      search: {
        ...(search as Record<string, unknown>),
        [OPEN_KEY]: writeStack([
          { kind: "student", id: params.student },
          work(params.student, params.work),
        ]),
      } as never,
      replace: true,
    });
  },
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
  // Every section's data before the page renders, so it paints once, whole
  // (docs/design/ia.md, "Smoothness"): a small class's year and grades, and
  // what its children see.
  loader: async ({ context, params }) => {
    const session = (context as { session: AuthSession }).session;
    const [school, { experienceOptions }, { gradebookOptions }] =
      await Promise.all([
        import("../features/school/api"),
        import("../features/school/classroom/api"),
        import("../features/school/classes/teacher-api"),
      ]);
    const org = (await preload(school.orgOptions(session, params.org))) as
      { kind?: string; solo?: boolean } | undefined;
    const small = org?.kind === "family" || org?.solo === true;
    await Promise.all([
      preload(experienceOptions(session, { kind: "class", id: params.class })),
      small && preload(school.calendarOptions(session, params.org)),
      org?.kind === "family" &&
        preload(gradebookOptions(session, params, undefined)),
      // The class's students, first page (the roster pages on from there).
      queryClient
        .ensureInfiniteQueryData({
          queryKey: school.studentsKey(session, params.org, ""),
          initialPageParam: 0,
          queryFn: ({
            pageParam,
            signal,
          }: {
            pageParam: number;
            signal: AbortSignal;
          }) =>
            school.fetchStudents(session, params.org, "", pageParam, signal),
          getNextPageParam: (last: { nextOffset?: number | null }) =>
            last.nextOffset,
        } as never)
        .catch(() => undefined),
    ]);
  },
  component: lazyRouteComponent(
    () => import("../features/school/ClassesScreen"),
    "ClassScreen",
  ),
});
const schoolClassImport = createRoute({
  getParentRoute: () => schoolClass,
  path: "import",
  component: lazyRouteComponent(
    () => import("../features/school/ImportScreen"),
    "ImportScreen",
  ),
});
/** A teacher sets up a class (one short form). `org` preselects a school. */
const schoolStart = createRoute({
  getParentRoute: () => root,
  path: "/school/start",
  beforeLoad: staffScreen,
  validateSearch: (search: Record<string, unknown>): { org?: string } =>
    z.uuid().safeParse(search.org).success ? { org: String(search.org) } : {},
  loader: async ({ context }) => {
    const { session } = context as unknown as { session: AuthSession };
    await Promise.all([
      preload(meOptions(session)),
      preload(orgsOptions(session)),
    ]);
  },
  component: lazyRouteComponent(
    () => import("../features/school/pilots/SchoolStartScreen"),
    "SchoolStartScreen",
  ),
});
/** Clever. Without Clever enabled there is nothing to connect here, so the
 * address opens class setup instead (no page that can only fail). */
let pendingCleverDeviceCompletion = false;
const schoolConnect = createRoute({
  getParentRoute: () => root,
  path: "/school/connect",
  validateSearch: (search: Record<string, unknown>): { error?: string } =>
    ["clever_identity_already_linked", "clever_link_expired"].includes(
      String(search.error),
    )
      ? { error: String(search.error) }
      : {},
  beforeLoad: async () => {
    if (nativeRuntime) throw redirect({ to: "/", replace: true });
    const config = await queryClient.ensureQueryData(authConfigOptions);
    if (config.mode === "accounts" && !config.clever)
      throw redirect({ to: "/school/start", replace: true });
    if (studentSession()) {
      pendingCleverDeviceCompletion ||= new URLSearchParams(
        window.location.hash.slice(1),
      ).has("clever-onboarding");
      if (pendingCleverDeviceCompletion) {
        const { cleverOnboardingSession } =
          await import("../features/school/clever/onboarding-session");
        // Keep only the intent to retry in memory. The helper validates the
        // setup proof before the previous student can be cleared.
        const proof = await cleverOnboardingSession();
        pendingCleverDeviceCompletion = false;
        if (proof) {
          clearStudentDevice();
          window.dispatchEvent(new Event("amp-account-session-changed"));
        }
      }
    }
    if (studentSession()) throw redirect({ to: "/", replace: true });
  },
  component: lazyRouteComponent(
    () => import("../features/school/clever/ConnectionScreen"),
    "ConnectionScreen",
  ),
});
/** An existing school joins a district (`docs/schools.md`). */
const schoolAdopt = createRoute({
  getParentRoute: () => root,
  path: "/school/adopt",
  validateSearch: (
    search: Record<string, unknown>,
  ): { district?: string; manage?: 1 } => ({
    ...(z.uuid().safeParse(search.district).success
      ? { district: String(search.district) }
      : {}),
    ...(search.manage === 1 || search.manage === "1"
      ? { manage: 1 as const }
      : {}),
  }),
  beforeLoad: (context) => {
    prepareSchoolAdoption();
    return staffScreen(context);
  },
  component: lazyRouteComponent(
    () => import("../features/school/AdoptionScreen"),
    "AdoptionScreen",
  ),
});
/** The page a teacher sends their school's buyer. */
const schoolsContinue = createRoute({
  getParentRoute: () => root,
  path: "/schools/continue",
  beforeLoad: () => {
    prepareBuyerHandoff();
  },
  component: lazyRouteComponent(
    () => import("../features/school/pilots/BuyerHandoffScreen"),
    "BuyerHandoffScreen",
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
/** Any other address inside a class: not found, in the class's frame. */
const schoolClassMissing = createRoute({
  getParentRoute: () => schoolClass,
  path: "$",
  component: lazyRouteComponent(
    () => import("../features/school/MissingScreen"),
    "SchoolMissingScreen",
  ),
});
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
    return { session, learnerId: own.id };
  },
  loader: ({ context }) => {
    const { session, learnerId } = context as {
      session: AuthSession;
      learnerId: string;
    };
    return loadOwnPractice(session, learnerId);
  },
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
/** Practicing as someone else (features/profiles): "Try a level…" and one
 * saved profile's levels. Any adult account; one chunk. */
const profileScreens = () => import("../features/profiles");
const profiles = createRoute({
  getParentRoute: () => root,
  path: "/me/profiles",
  beforeLoad: async () => {
    await ownPractice();
  },
  component: lazyRouteComponent(profileScreens, "ProfilesScreen"),
});
const newProfile = createRoute({
  getParentRoute: () => root,
  path: "/me/profiles/new",
  beforeLoad: async () => {
    await ownPractice();
  },
  component: lazyRouteComponent(profileScreens, "NewProfileScreen"),
});
const editProfile = createRoute({
  getParentRoute: () => root,
  path: "/me/profiles/$profileId",
  beforeLoad: async () => {
    await ownPractice();
  },
  component: lazyRouteComponent(profileScreens, "EditProfileScreen"),
});
/** The record, the level and its path arrive together, so `/me` paints
 * whole: nothing below the level moves when it lands. A failure is the
 * screen's to show. */
async function loadOwnPractice(session: AuthSession, learnerId: string) {
  const [
    { ownPracticeOptions },
    { levelTrendOptions },
    { learnerFrontierOptions },
  ] = await Promise.all([
    import("../features/me/api"),
    import("../features/level/api"),
    import("../lib/learning-view"),
  ]);
  await Promise.all([
    queryClient.ensureQueryData(ownPracticeOptions(session)),
    queryClient
      .ensureQueryData(learnerFrontierOptions(session, learnerId))
      .then((frontier) =>
        frontier.overall.answered > 0
          ? queryClient.ensureQueryData(levelTrendOptions(session, learnerId))
          : undefined,
      ),
  ]).catch((error) => console.warn("Your progress didn’t load ahead", error));
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
/** Every shared component in its states, from fixtures (features/design): an
 * internal tool for development and staff browsers, unlinked and unindexed. */
const design = createRoute({
  getParentRoute: () => root,
  path: "/design",
  validateSearch: (search) => designSearchSchema.parse(search),
  beforeLoad: () => {
    if (!designAllowed()) throw redirect({ to: "/", replace: true });
  },
  component: lazyRouteComponent(
    () => import("../features/design/DesignScreen"),
    "DesignScreen",
  ),
});
const fallback = createRoute({
  getParentRoute: () => appScreen,
  path: "/$",
  // The address says who practices (features/profiles/practice-mode.ts).
  beforeLoad: ({ location }) => adoptPracticeMode(location),
  // The app screen is rendered by the layout, so load its chunk here, as the
  // route's own component would have been. The Overview's level too, so it
  // paints in its final layout (a learner's first day has its own).
  loader: async ({ location }) => {
    await Promise.all([
      legacy.preload?.(),
      location.pathname === "/overview" &&
        import("../lib/learning-view").then((view) =>
          view.preloadOverviewLevel(),
        ),
    ]);
  },
});
const lessonFilm = createRoute({
  getParentRoute: () => appScreen,
  path: "/lessons/$templateId/watch",
  validateSearch: (search): { from: string | undefined; problem?: string } => {
    /** The problem the film was opened from, so watching it is help for it. */
    const problem = z
      .string()
      .max(160)
      .optional()
      .catch(undefined)
      .parse(search.problem);
    return {
      from: z.string().max(2048).optional().catch(undefined).parse(search.from),
      ...(problem ? { problem } : {}),
    };
  },
  component: lazyRouteComponent(
    () => import("../features/films/FilmScreen"),
    "FilmScreen",
  ),
  loader: async () => {
    await legacy.preload?.();
  },
});
/** Development only: the design preview's persona switcher
 * (`scripts/design-preview.sh`). `import.meta.env.DEV` is false in a build,
 * so neither the route nor its chunk is in production. */
const devPersonas = import.meta.env.DEV
  ? createRoute({
      getParentRoute: () => root,
      path: "/dev/personas",
      component: lazyRouteComponent(
        () => import("../features/dev/PersonaSwitcher"),
        "PersonaSwitcher",
      ),
    })
  : null;
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
    appScreen.addChildren([home, fallback, lessonFilm]),
    join,
    joinContinue,
    joinClass,
    joinPictures,
    signInCard,
    schoolClass.addChildren([
      schoolClassHome,
      schoolClassToday,
      schoolClassMap.addChildren([
        schoolClassMapStudent.addChildren([schoolClassMapWork]),
      ]),
      schoolClassGradebook,
      schoolClassTime,
      schoolClassReportCards,
      schoolClassSettings,
      schoolClassRoster,
      schoolClassImport,
      schoolClassStart,
      schoolClassCards,
      schoolClassExperience,
      schoolClassWorkbooks,
      schoolClassMarks,
      schoolClassMissing,
    ]),
    standings,
    ownRecord,
    ownStart,
    profiles,
    newProfile,
    editProfile,
    schoolsHome,
    schoolsScope,
    schoolsTrust,
    schoolsContinue,
    schoolStart,
    schoolConnect,
    schoolAdopt,
    familyLink,
    familyApprove,
    familyApproval,
    design,
    signIn,
    signUp,
    accountReady,
    deleteAccount,
    accountDeleted,
    accessGift,
    signInStep,
    reset,
    starterIndex,
    starterChoice,
    starterStep,
    startPlan,
    continueWithAmp,
    startPurchase,
    startName,
    startYear,
    startConsent,
    startVerify,
    tryStart,
    tryAnything,
    inventory,
    pathways.addChildren([pathwaysIndex, pathwaySkill]),
    lessonsHome,
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
    ...((devPersonas ? [devPersonas] : []) as unknown as []),
  ]),
  history,
  // One change per navigation (docs/design/ia.md, "Smoothness"): a link
  // preloads its screen's code and data on intent (hover, focus, touch), and
  // the screen on show stays until the next one can render whole. Only a
  // wait longer than a second shows the wave, so a short one never flashes
  // the page to a loader and back.
  defaultPreload: "intent",
  defaultPreloadDelay: 0,
  defaultPendingComponent: LoadingScreen,
  defaultPendingMs: 1000,
  defaultPendingMinMs: 0,
});
// Development only: the route table, as the navigation crawler reads it
// (scripts/verify-layer-crawl-ui.ts), so a new screen is crawled without
// anyone editing the crawler. A layout's own address is its index child's;
// a leaf without a screen of its own (an old address) is an `address`.
if (import.meta.env.DEV) {
  type Entry = {
    isRoot?: boolean;
    fullPath: string;
    children?: unknown;
    parentRoute?: Entry;
    options: { path?: string; component?: unknown };
  };
  Object.assign(window, {
    ampRouteTable: () =>
      (Object.values(router.routesById) as unknown as Entry[])
        .filter(
          (route) =>
            !route.isRoot &&
            !(route.children as Entry[] | undefined)?.some(
              (child) => child.options.path === "/",
            ),
        )
        .map((route) => ({
          path: route.fullPath,
          page:
            !!route.options.component ||
            (route.options.path === "/" &&
              !!route.parentRoute?.options.component),
        })),
  });
}
// A control that only changes the address's search (a toggle, a segmented
// control, a sort, a filter, a year) keeps the page where it is: the reader
// stays on what they were looking at. Going to another screen starts at its
// top, as before, and a navigation that says otherwise still wins. One rule
// for every link and navigate(), at the one place they all commit.
//
// Each entry also records the address of the entry it was pushed from, so a
// close (lib/return-to.ts) can tell when Back is the way to its target.
{
  const commit = router.commitLocation;
  router.commitLocation = (next) =>
    commit({
      ...next,
      state: stampPrevious(next, router.history.location) as typeof next.state,
      resetScroll:
        next.resetScroll ??
        (next.pathname === router.state.location.pathname ||
        overList(router.state.location.pathname, next.pathname)
          ? false
          : undefined),
    });
}
// A detail over a list (a class map's student, a class's standing drill, a
// student from the list) keeps the list's view: its sort, its area, its year,
// its chart. Opening carries them into the detail's address, closing carries
// them back, and Back finds them in history. Only the view keys move, only
// between a list and a detail one step below it, and only where the
// destination does not set them itself.
{
  const build = router.buildLocation;
  router.buildLocation = ((options: Parameters<typeof build>[0]) => {
    const next = build(options);
    const here = router.state.location;
    // A practice mode (practicing as a profile) goes with the reader
    // between learning screens: Overview, Pathways, a lesson. An explicit
    // profile key also allows a caller to clear the mode when leaving it.
    const mode = here.search as Record<string, unknown>;
    const explicitMode =
      typeof options.search === "object" &&
      options.search !== null &&
      "profile" in options.search;
    if (
      !explicitMode &&
      typeof mode.profile === "string" &&
      isLearningPath(here.pathname) &&
      isLearningPath(next.pathname) &&
      (next.search as Record<string, unknown>).profile === undefined
    )
      return build({
        ...options,
        search: {
          ...next.search,
          ...Object.fromEntries(
            MODE_KEYS.filter(
              (key) =>
                mode[key] !== undefined &&
                (next.search as Record<string, unknown>)[key] === undefined,
            ).map((key) => [key, mode[key]]),
          ),
        },
      } as never);
    if (!overList(here.pathname, next.pathname)) return next;
    const from = here.search as Record<string, unknown>;
    const to = next.search as Record<string, unknown>;
    const carried = Object.fromEntries(
      VIEW_KEYS.filter(
        (key) => from[key] !== undefined && to[key] === undefined,
      ).map((key) => [key, from[key]]),
    );
    return Object.keys(carried).length
      ? build({ ...options, search: { ...to, ...carried } } as never)
      : next;
  }) as typeof build;
}
/** A detail over a list (a route marked `staticData.overList`: a student's
 * sheet, an answer replayed over it, a class's standing drill, a student
 * from the list) and the list it opened from, at an ancestor address. Only
 * those carry a list's view; a move between tabs never does. */
function overList(a: string, b: string) {
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  const trimmed = short.replace(/\/+$/, "");
  if (!long.startsWith(`${trimmed}/`)) return false;
  const leaf = router.getMatchedRoutes(long)[2] as
    { options?: { staticData?: { overList?: boolean } } } | undefined;
  return leaf?.options?.staticData?.overList === true;
}

/** Learning screens, which a practice profile never makes a place. */
const PROFILE_PRACTICE_PATHS = [
  "/practice",
  "/lessons",
  "/books",
  "/pathways",
  "/inventory",
];
// A new screen closes any open tip, menu or picker (ui/popover-owner).
router.subscribe("onBeforeNavigate", ({ pathChanged }) => {
  if (pathChanged) closeAllPopovers("navigate");
});
// Each screen a signed-in person settles on records its place, so `/` can
// return to it next time.
router.subscribe("onResolved", ({ toLocation }) => {
  const session = queryClient.getQueryData(sessionOptions.queryKey);
  if (!session || studentSession()) return;
  const me = queryClient.getQueryData<Me>(meKey(session.accountId));
  const chosen = useLearnerStore.getState().learnerId;
  // Practicing as a profile is a step away from a place, never one `/`
  // returns to.
  if (
    me?.signedIn &&
    practicingAsProfile(me, chosen) &&
    PROFILE_PRACTICE_PATHS.some(
      (path) =>
        toLocation.pathname === path ||
        toLocation.pathname.startsWith(`${path}/`),
    )
  )
    return;
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
          if (!ended || studentSession()?.token !== student.token) return;
          leavingStudent = true;
          clearStudentDevice();
          try {
            await router.navigate({ to: "/join", replace: true });
          } finally {
            queryClient.setQueryData(sessionOptions.queryKey, null);
            queryClient.removeQueries({ queryKey: ["account"] });
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
  };
  const target = { to: "/sign-in", search: carry } as const;
  void router
    .preloadRoute(target)
    .catch(() => undefined)
    .then(() => router.navigate({ ...target, replace: true }))
    .finally(clear);
  return true;
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
