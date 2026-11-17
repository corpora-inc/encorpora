import {
  carryFamilyPractice,
  restoreFamilyPractice,
} from "../lib/family-practice-history";
import { knownDocumentPath } from "./document-routes";
import { invoiceOffersOptions } from "../features/funding/invoice-offers";
import {
  createRootRoute,
  notFound,
  createRoute,
  createRouter,
  createBrowserHistory,
  createMemoryHistory,
  Outlet,
  redirect,
  retainSearchParams,
  useMatch,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { lazyRouteComponent } from "../lib/lazy-route-component";
import { z } from "zod";
import { useSessionOrNull } from "../lib/session";
import { lazy, Suspense, useEffect, useRef } from "react";
import { usePayStore } from "../features/pay/store";
import type { AuthSession } from "../auth";
import { setPitchShown } from "../lib/analytics";
import { showsPitch } from "../features/pitch/shows-pitch";
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
import { currentLearner } from "../learner-store";
import { practicingAsAdult, practicingAsProfile } from "../lib/adult-learner";
import { LoadingScreen, RouteError } from "../ui/LoadingScreen";
import { childAddress, childPath } from "../features/spaces/identity";
import { closeAllPopovers } from "../ui/popover-owner";
import {
  placeOfPath,
  routeFor,
  startDestination,
  startNavigation,
} from "../features/onboarding/guard";
import { rememberPlace } from "../features/onboarding/place-memory";
import { useHomeHref } from "../lib/home-place";
import {
  fundedSetup,
  campaignSearch,
  continuationSearch,
  continuationUrl,
  type CampaignSearch,
} from "../lib/funded-entry";
import { chosenPlan } from "../lib/pending-trial";
import { followAlias, LEGACY_ALIASES } from "./legacy-aliases";
import { qk } from "../lib/keys";
import {
  admit,
  elsewhere,
  requireSignedIn,
  returnSearchShape,
  signInTarget,
  toOwnPlace,
  withQuery,
} from "./sign-in-gate";
import {
  cleverReturn,
  homeReturn,
  inboundSearchShape,
  resumeStripeReturn,
  signInArrivalPending,
  signInReturn,
  stripeReturn,
} from "./third-party-returns";
import { knownStale, onSignedOut } from "../lib/app-recovery";
import { autoReloadBlock } from "../lib/reload-guard";
import {
  clearStudentDevice,
  studentSession,
  studentSignInEnded,
} from "../lib/student-device";
import { prepareBuyerHandoff } from "../features/school/pilots/buyer-session";
import { prepareSchoolAdoption } from "../features/school/adoption-session";
import { finishingSignIn } from "../features/school/join/finishing";
import { SMALL_CLASS } from "../features/navigation/shell-frame";
import { approvalsOptions } from "../features/family-approval/api";
import { secondParentOptions } from "../features/second-parent/api";
import {
  classYearOptions,
  orgsOptions,
  preload,
} from "../features/school/core-api";
import { frameData, schoolRoutes, staffScreen } from "./school-routes";
import { familyRoutes } from "./family-routes";
import { accountOverlays } from "./account-overlays";
import { payAddresses } from "./pay-routes";
import { appReturn } from "../features/spaces/returns";
import { loadCurriculum, loadScope } from "../features/schools/api";
import {
  marksSearchSchema,
  stackSearchSchema,
  standingsSearchSchema,
} from "../features/school/classroom/search";
import { designAllowed, designSearchSchema } from "../features/design/search";
import { stampPrevious, VIEW_KEYS } from "../lib/return-to";
import { applyDeferredIdentity } from "../features/school/join/api";
import { settleLegacyLayers } from "../nav/links";
import { layerScope, seedLayers, useLayerStore } from "../nav/layer-store";
import {
  adoptPracticeMode,
  followResolvedLearner,
  practiceAddress,
  studentPracticeHref,
  canonicalLearnerAddress,
  carriedKeys,
  isLearningPath,
} from "../features/profiles/practice-mode";
/** Every address's query, as the root reads it: the sign-in gate's return
 * (app/sign-in-gate.ts), what arrives from outside (app/third-party-returns.ts),
 * and the screen state some screens still read from the query. That last
 * group goes key by key as its readers move to paths and stores
 * (amp/AGENTS.md, "Frontend architecture"); when it is empty, this schema
 * is the two sanctioned modules' alone. */
const searchSchema = z
  .object({
    ...returnSearchShape,
    ...inboundSearchShape,
    topic: z.string().max(100).optional().catch(undefined),
    strand: z.string().max(100).optional(),
    filter: z.string().max(100).optional(),
    /** Pathways' map: by grade, or in 3D. */
    view: z.enum(["grades", "3d"]).optional().catch(undefined),
    skill: z.string().max(100).optional(),
    template: z.string().max(100).optional(),
    page: z.coerce.number().int().nonnegative().optional(),
    interval: z.enum(["year", "month"]).optional().catch(undefined),
  })
  .passthrough();
function RouterError({ error }: { error: unknown }) {
  const router = useRouter();
  const home = useHomeHref();
  // A family's child's map fails at its own address: "Back to map" is it.
  const child = childAddress(window.location.pathname);
  return (
    <RouteError
      error={error}
      reset={() => void router.invalidate()}
      home={home}
      map={
        child?.screen === "pathways"
          ? childPath(child.family, child.learner, "pathways")
          : null
      }
    />
  );
}
/** "Add Child 2's name", once "Continue with AMP" has made access active. Its
 * chunk loads only on the screen the purchase returned to. */
const AfterPurchase = lazy(() =>
  import("../features/continue/AfterPurchase").then((module) => ({
    default: module.AfterPurchase,
  })),
);
function AfterPurchaseGate() {
  const session = useSessionOrNull();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const naming = usePayStore(
    (state) =>
      !!session &&
      state.accounts[session.accountId]?.opener?.stage === "naming",
  );
  const waiting = naming && !!pathname;
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
  notFoundComponent: lazyRouteComponent(
    () => import("../features/not-found/NotFoundScreen"),
    "NotFoundScreen",
  ),
  // A tab already found to run an older release turns its next navigation
  // into a full page load of the same URL. The current screen stays painted
  // until the new page paints, so no loading screen shows in between.
  beforeLoad: async ({ location, preload }) => {
    // An old address: one hop to its new one, before any screen's guard.
    if (!preload) await followAlias(location);
    if (nativeRuntime) return;
    // A Stripe return kept across a sign-in: its confirmation, once.
    if (!preload) await resumeStripeReturn();
    if (!preload) await restoreFamilyPractice(location);
    if (
      knownStale() &&
      !preload &&
      !autoReloadBlock({
        pathname: location.pathname,
        search: location.searchStr,
      })
    ) {
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
      .catch((error: unknown) =>
        console.warn("The session didn’t load ahead", error),
      );
    // The resource's observer shows its own error; this refresh only logs.
    if (session)
      void queryClient
        .fetchQuery({ ...meOptions(session), staleTime: 0 })
        .catch((error: unknown) =>
          console.warn("The account didn’t refresh", error),
        );
  },
  pendingMs: 600_000,
});
const legacy = lazyRouteComponent(() => import("./LegacyApp"), "LegacyApp");
const pitch = lazyRouteComponent(
  () => import("../features/pitch/PitchScreen"),
  "PitchScreen",
);
/** The pitch or the app. Home (`/`) and every other app path render here, in
 * one layout route, so going between them keeps the same app screen mounted:
 * the current problem, the learner and each tab's place survive a visit to
 * home. At `/` the pitch is what the route resolved; elsewhere it is the app.
 * When the session changes at `/`, the route runs again (redirecting as
 * needed) before the screen changes, so a remount never shows the other
 * screen half-loaded. */
function AppScreen() {
  const film = useMatch({
    from: "/app/lessons/$templateId/watch",
    shouldThrow: false,
  });
  const filmForProblem = useMatch({
    from: "/app/lessons/$templateId/watch/$problem",
    shouldThrow: false,
  });
  const watchingFilm = film ?? filmForProblem;
  const session = useSessionOrNull();
  const router = useRouter();
  const atHome = useMatch({
    from: home.id,
    shouldThrow: false,
    select: (match) => ({
      pitch: match.loaderData?.pitch,
      settled: match.status === "success",
    }),
  });
  const shown = !!atHome && showsPitch(session);
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
  // `/` signed in on the web is the launcher; every other path the app.
  const kind = atHome?.pitch
    ? "pitch"
    : atHome && !nativeRuntime && session
      ? "launcher"
      : "app";
  const shownKind = useRef<string | null>(null);
  const deciding = !settled || (!!atHome && atHome.pitch === undefined);
  const pending = deciding && shownKind.current !== kind;
  if (!pending) shownKind.current = kind;
  const Screen =
    kind === "pitch" ? pitch : kind === "launcher" ? launcher : legacy;
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
async function loadAuthConfig() {
  const config = await queryClient.ensureQueryData(authConfigOptions);
  // A deployment without its own accounts signs in with its external
  // authority: the auth screens hand straight to it.
  if (config.mode !== "accounts") {
    window.history.replaceState({}, "", "/");
    await (await import("../auth")).signIn();
  }
  return config;
}
const start = lazyRouteComponent(
  () => import("../features/onboarding/StartScreen"),
  "StartScreen",
);
/** A school sets its students up; setup and paper self-marking are for
 * families, so a student's URL goes back to practice. */
const notForStudents = () => admit({ adults: true });
/** Every /start step runs the one first-run guard against `/me`. */
async function beforeStart({
  location,
}: {
  location: { pathname: string; search: Record<string, unknown> };
}) {
  const search = continuationSearch(location.search);
  const session = await requireSignedIn(location, { adults: true });
  if (nativeRuntime) return;
  const me = await queryClient.ensureQueryData(meOptions(session));
  const target = startDestination(
    me,
    location.pathname,
    !!chosenPlan(),
    // The funded program these steps are for: the address's on arrival,
    // kept for the account; the next steps are plain paths.
    fundedSetup(session.accountId, location.search),
  );
  if (target) elsewhere(withQuery(target, search));
}
const appScreen = createRoute({
  getParentRoute: () => root,
  id: "app",
  // The session is known before an app screen renders (LegacyApp reads it
  // from the cache); a failed read is the route's error screen.
  beforeLoad: async () => {
    await queryClient.ensureQueryData(sessionOptions);
  },
  component: AppScreen,
});
const home = createRoute({
  getParentRoute: () => appScreen,
  path: "/",
  staticData: { space: "learner" },
  loaderDeps: ({ search }) => ({ program: search.program }),
  loader: async ({ deps }) => {
    const session = queryClient.getQueryData(sessionOptions.queryKey);
    const shown = showsPitch(session);
    setPitchShown(shown);
    if (!shown) {
      // Signed in, `/` is the launcher: its places arrive with it, so it
      // paints whole (the native app keeps its own screen here).
      if (nativeRuntime || !session) await legacy.preload?.();
      else
        await Promise.all([
          launcher.preload?.(),
          preloadLauncher(session).catch((error) =>
            console.warn("Your places didn’t load ahead", error),
          ),
        ]);
    } else {
      // Preload the route component alongside its data before showing the pitch.
      const [{ loadPitch }] = await Promise.all([
        import("../features/pitch/PitchScreen"),
        pitch.preload?.(),
      ]);
      await loadPitch(deps);
    }
    return { pitch: shown };
  },
  // `/` never decides for anyone: signed out it is the pitch, signed in the
  // launcher, a real screen whether reached by a link or by Back. Only an
  // address that carries a handoff (an auth link, a payment's return, a
  // consent challenge) goes on, once, to the screen that handles it.
  // (Old `/?sign-in`, `/?reset-password` and a consent email's link are
  // app/legacy-aliases.ts rows.)
  beforeLoad: async ({ location }) => {
    if (nativeRuntime) return;
    await homeReturn(location);
  },
});
/** The launcher's account and places, read before it paints. */
async function preloadLauncher(session: AuthSession) {
  const me = await queryClient.fetchQuery({
    ...meOptions(session),
    staleTime: 0,
  });
  if (!me.signedIn) return;
  const { loadPlaceGroups } = await import("../features/home/destination");
  await loadPlaceGroups(session, me);
}
const launcher = lazyRouteComponent(
  () => import("../features/home/Launcher"),
  "Launcher",
);
/** The pitch/app screen reads what `/` resolved; so does the document head.
 * A route's id exists once the router is built, so this reads it on demand. */
export const homeRouteId = () => home.id;
/** An existing session needs no second sign-in or signup. Both entry buttons
 * resume the account; `/` chooses its place or its first-run question. */
async function beforeAuthEntry({
  search,
  location,
}: {
  search: Record<string, unknown>;
  location: { pathname: string; searchStr: string; search: unknown };
}) {
  if (nativeRuntime) return;
  notForStudents();
  // A sign-in that failed comes back with its code: kept, then one hop to
  // the clean address.
  signInReturn(location);
  // Security, school connections and invitation handoffs can require a
  // fresh sign-in or another identity even with a valid session. A failed
  // sign-in must also stay visible on the authentication screen.
  if (
    signInArrivalPending() ||
    (search.return && search.return !== "free-practice")
  )
    return;
  const session = await queryClient.ensureQueryData(sessionOptions);
  if (!session) return;
  // Signed in already: the sign-in gate's way back, once.
  const next = continuationUrl(search);
  // Nothing asked for: the account's own place, never `/`.
  if (next.split("?")[0] === "/") await toOwnPlace();
  elsewhere(next);
}
const signIn = createRoute({
  getParentRoute: () => root,
  path: "/sign-in",
  staticData: { space: "public" },
  beforeLoad: beforeAuthEntry,
  loader: loadAuthConfig,
  component: auth,
});
const signUp = createRoute({
  getParentRoute: () => root,
  path: "/sign-up",
  staticData: { space: "public" },
  beforeLoad: beforeAuthEntry,
  loader: loadAuthConfig,
  component: auth,
});
const accessGift = createRoute({
  getParentRoute: () => root,
  path: "/access",
  staticData: { space: "account" },
  // Signed out, sign-in comes back here.
  beforeLoad: ({ location }) =>
    requireSignedIn(location, { back: { return: "access" } }),
  component: lazyRouteComponent(
    () => import("../features/access/AccessScreen"),
    "AccessScreen",
  ),
});
const accountReady = createRoute({
  getParentRoute: () => root,
  path: "/account/ready",
  staticData: { space: "account" },
  // Signed out: sign in, keeping the continuation. A gift waiting (or a
  // sign-up that came from one): the gift's page, in one hop.
  beforeLoad: async ({ location }) => {
    const session = await requireSignedIn(location);
    // A failed lookup is the screen's inline retry, never a route error.
    const me = await queryClient
      .ensureQueryData(meOptions(session))
      .catch((error: unknown) =>
        console.warn("The new account didn’t load ahead", error),
      );
    const account =
      me?.signedIn && me.account.id === session.accountId ? me : null;
    if (
      account?.availableAccessGrant ||
      continuationSearch(location.search).return === "access"
    )
      elsewhere("/access");
  },
  component: lazyRouteComponent(
    () => import("../features/account/AccountReady"),
    "AccountReady",
  ),
});
const deleteAccountScreens = () => import("../features/account/DeleteAccount");
const accountDeleted = createRoute({
  getParentRoute: () => root,
  path: "/account/deleted",
  staticData: { space: "account" },
  component: lazyRouteComponent(deleteAccountScreens, "AccountDeletedScreen"),
});
const signInStep = createRoute({
  getParentRoute: () => root,
  path: "/sign-in/$step",
  staticData: { space: "public" },
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
  staticData: { space: "public" },
  loader: loadAuthConfig,
  component: auth,
});
/** "What brings you to AMP?" (`/start`), each answer (`/start/<choice>`) and
 * each step of a parent's or tutor's setup (`/start/<choice>/<step>`). Any
 * signed-in adult may open it to add a place. Where each address goes
 * instead is the one first-run router's (`routeFor`): the URL is the step and
 * `me.setup` the progress. */
async function beforeStarter({
  params,
  location,
}: {
  params: { choice?: string };
  location: { pathname: string; search: Record<string, unknown> };
}) {
  const session = await requireSignedIn(location, { adults: true, web: true });
  // Which question this is and which answers it offers are the account's:
  // known before the first paint, so neither changes under the reader. An
  // old trial link reads the account fresh: a first run may have finished in
  // another tab. A failed read routes by the address alone.
  const resuming =
    params.choice === undefined &&
    location.search.return === "free-practice" &&
    !appReturn(location.search.from);
  const me = resuming
    ? await queryClient.fetchQuery({ ...meOptions(session), staleTime: 0 })
    : await queryClient
        .ensureQueryData(meOptions(session))
        .catch((error) => console.warn("The account didn’t load ahead", error));
  const target = routeFor(me?.signedIn ? me : null, location);
  // An established account's old trial link: straight to its place.
  if (target?.to === "/")
    await toOwnPlace(me?.signedIn ? me : undefined);
  if (target) elsewhere(target.to);
  // The school answer's next step depends on the account's schools: there
  // before the page paints, so its buttons never arrive late.
  if (params.choice === "school") {
    const { orgsOptions } = await import("../features/school/api");
    await queryClient
      .ensureQueryData(orgsOptions(session))
      .catch((error) => console.warn("Schools didn’t load ahead", error));
  }
}
const starter = lazyRouteComponent(
  () => import("../features/onboarding/Starter"),
  "Starter",
);
const starterIndex = createRoute({
  getParentRoute: () => root,
  path: "/start",
  staticData: { space: "account" },
  beforeLoad: beforeStarter,
  component: starter,
});
const starterChoice = createRoute({
  getParentRoute: () => root,
  path: "/start/$choice",
  staticData: { space: "account" },
  beforeLoad: beforeStarter,
  component: starter,
});
/** A parent's or a tutor's setup after its first step:
 * `/start/parent/ready`, `/start/tutor/join` and `/start/tutor/ready`; the
 * retired steps' addresses resolve in `routeFor`. */
const starterStep = createRoute({
  getParentRoute: () => root,
  path: "/start/$choice/$step",
  staticData: { space: "account" },
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
  staticData: { space: "account" },
  beforeLoad: beforeStart,
  component: start,
});
/** Stripe Checkout's success and cancel URL for parent enrollment. */
const startPurchase = createRoute({
  getParentRoute: () => root,
  path: "/start/purchase",
  staticData: { space: "account" },
  beforeLoad: async (input) => {
    // A learner's enrollment checkout from the pay flow comes back to that
    // learner's confirmation; one with no learner yet stays here.
    await stripeReturn(
      input.location,
      "enrollment",
      await queryClient.ensureQueryData(sessionOptions),
    );
    return beforeStart(input);
  },
  component: start,
});
const startName = createRoute({
  getParentRoute: () => root,
  path: "/start/name",
  staticData: { space: "account" },
  beforeLoad: beforeStart,
  component: start,
});
const startYear = createRoute({
  getParentRoute: () => root,
  path: "/start/birth-year",
  staticData: { space: "account" },
  beforeLoad: beforeStart,
  component: start,
});
const startConsent = createRoute({
  getParentRoute: () => root,
  path: "/start/consent",
  staticData: { space: "account" },
  beforeLoad: beforeStart,
  component: start,
});
const startVerify = createRoute({
  getParentRoute: () => root,
  path: "/start/verify-email",
  staticData: { space: "account" },
  beforeLoad: beforeStart,
  component: start,
});
/** Screens on the app frame know who is signed in before they paint, so
 * the frame's bar is there from their first frame and nothing moves under it. */
/** A learning screen's data before it renders (lib/learning-view), its code
 * loaded only when one is visited. */
async function preloadLearning(location?: {
  pathname: string;
  search: Record<string, unknown>;
}) {
  const { preloadLearningView } = await import("../lib/learning-view");
  await preloadLearningView(location);
}
async function framedScreen() {
  admit({ web: true });
  await queryClient
    .ensureQueryData(sessionOptions)
    .catch((error: unknown) =>
      console.warn("The session didn’t load ahead", error),
    );
}
const inventory = createRoute({
  getParentRoute: () => root,
  path: "/inventory",
  staticData: { space: "learner" },
  // A learning record belongs to an account: signed out, sign in first.
  beforeLoad: async ({ location }) => {
    await requireSignedIn(location, { web: true });
    await canonicalLearnerAddress(location);
    await adoptPracticeMode(location);
  },
  // Its record and level arrive with it: one paint, whole.
  loader: ({ location }) =>
    preloadLearning({
      pathname: location.pathname,
      search: location.search as Record<string, unknown>,
    }),
  component: lazyRouteComponent(
    () => import("../features/inventory/InventoryScreen"),
    "InventoryScreen",
  ),
});
/** One map for the whole curriculum: a skill opens over it as a layer
 * (nav/layer-store.ts), so choosing or closing one never moves the map (its
 * camera, full screen and orbit stay as they were). */
const pathways = createRoute({
  getParentRoute: () => root,
  path: "/pathways",
  staticData: { space: "learner" },
  // (A skill, lesson or shared stack from before the layer store, `?skill=`,
  // `?lesson=`, `?open=` and `/pathways/<skill>`, is an app/legacy-aliases.ts
  // row, which seeds the store.)
  beforeLoad: async ({ location }) => {
    await framedScreen();
    await canonicalLearnerAddress(location);
    await adoptPracticeMode(location);
  },
  // The curriculum and the learner's record arrive with it: one paint. A
  // problem type's short lesson needs neither: it opens at once over the
  // map, which fills in under it.
  loader: ({ location }) => {
    const at = {
      pathname: location.pathname,
      search: location.search as Record<string, unknown>,
    };
    const scope = layerScope(
      location.pathname,
      queryClient.getQueryData(sessionOptions.queryKey)?.accountId,
    );
    const stack = useLayerStore.getState().stacks[scope] ?? [];
    if (!stack.some((layer) => layer.kind === "lesson"))
      return preloadLearning(at);
    void preloadLearning(at).catch((error: unknown) =>
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
/** A learner's workbooks are a tab of their Progress. The address names
 * the learner (`$learnerId`): the screen reads it from there, and once the
 * navigation resolves it is the account's current learner
 * (followResolvedLearner). The server still decides what the account may
 * open. */
const beforeWorkbooks = ({ location }: { location: { pathname: string; searchStr: string } }) =>
  requireSignedIn(location, { web: true, adults: true });
/** Daily paper workbooks for one learner (features/workbooks). */
const workbookHistory = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks",
  staticData: { space: "learner" },
  beforeLoad: beforeWorkbooks,
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookHistoryScreen"),
    "WorkbookHistoryScreen",
  ),
});
const workbookDay = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks/$date",
  staticData: { space: "learner" },
  beforeLoad: beforeWorkbooks,
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookDayScreen"),
    "WorkbookDayScreen",
  ),
});
const workbookResults = createRoute({
  getParentRoute: () => root,
  path: "/learners/$learnerId/workbooks/$workbookId/results",
  staticData: { space: "learner" },
  beforeLoad: beforeWorkbooks,
  component: lazyRouteComponent(
    () => import("../features/workbooks/WorkbookResultsScreen"),
    "WorkbookResultsScreen",
  ),
});
/** The account (`/account`, the IA v2 spec, §4): one page for every adult,
 * and the overlays its rows open over it (app/account-overlays.tsx):
 * billing, privacy, sign-in & security, deleting the account, Pay. They
 * render for anyone signed in, family parents too, so mailed and returned
 * links keep working; a family's own links go to its Settings instead. */
const accountHub = createRoute({
  getParentRoute: () => root,
  path: "/account",
  staticData: { space: "account" },
  beforeLoad: async ({ location }) => {
    await requireSignedIn(location, {
      web: true,
      // A school's sign-in finishing here may be a student's, briefly.
      adults: !finishingSignIn(),
    });
  },
  component: lazyRouteComponent(
    () => import("../features/account/AccountHub"),
    "AccountHost",
  ),
});
/** The form shows its own retry when the offers didn't load ahead. */
const invoiceOffersFailed = (error: unknown) =>
  console.warn("The invoice offers didn’t load ahead", error);
const invoiceForm = lazyRouteComponent(
  () => import("../features/funding/InvoiceForm"),
  "InvoiceForm",
);
const invoiceArkansas = createRoute({
  getParentRoute: () => root,
  path: "/invoice/arkansas-efa",
  staticData: { space: "account" },
  loader: () =>
    queryClient
      .ensureQueryData(invoiceOffersOptions("ar-efa"))
      .catch(invoiceOffersFailed),
  component: invoiceForm,
});
const invoiceArizona = createRoute({
  getParentRoute: () => root,
  path: "/invoice/arizona-esa",
  staticData: { space: "account" },
  loader: () =>
    queryClient
      .ensureQueryData(invoiceOffersOptions("az-esa"))
      .catch(invoiceOffersFailed),
  component: invoiceForm,
});
const invoiceNewHampshire = createRoute({
  getParentRoute: () => root,
  path: "/invoice/new-hampshire-efa",
  staticData: { space: "account" },
  loader: () =>
    queryClient
      .ensureQueryData(invoiceOffersOptions("nh-efa"))
      .catch(invoiceOffersFailed),
  component: invoiceForm,
});
/** Where a student signs in, and where an ended sign-in lands. */
/** One chunk for all of student sign-in, so each next step is already here. */
const joinScreens = () => import("../features/school/join");
const join = createRoute({
  getParentRoute: () => root,
  path: "/join",
  staticData: { space: "student" },
  component: lazyRouteComponent(joinScreens, "JoinScreen"),
});
/** Back from a school account's sign-in. The session is in the fragment, which
 * `card-entry` has already taken out of the address bar. */
const joinContinue = createRoute({
  getParentRoute: () => root,
  path: "/join/continue",
  staticData: { space: "student" },
  component: lazyRouteComponent(joinScreens, "ContinueScreen"),
});
const joinClass = createRoute({
  getParentRoute: () => root,
  path: "/join/$code",
  staticData: { space: "student" },
  component: lazyRouteComponent(joinScreens, "ClassScreen"),
});
const joinPictures = createRoute({
  getParentRoute: () => root,
  path: "/join/$code/$person",
  staticData: { space: "student" },
  component: lazyRouteComponent(joinScreens, "PicturesScreen"),
});
/** A printed card's link. Its secret is in the fragment, which `card-entry`
 * has already taken out of the address bar. */
const signInCard = createRoute({
  getParentRoute: () => root,
  path: "/c",
  staticData: { space: "student" },
  component: lazyRouteComponent(joinScreens, "CardScreen"),
});
/** A class's staff screens. Each is its own child, and the API decides who
 * reaches which class. */
const classScreens = () => import("../features/school/classes");
const schoolClass = createRoute({
  getParentRoute: () => root,
  path: "/school/$org/classes/$class",
  staticData: { space: "classroom" },
  // (A parent's family at its old class address is an
  // app/legacy-aliases.ts row.)
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
const schoolClassToday = createRoute({
  getParentRoute: () => schoolClass,
  path: "today",
  // A family's own class lists children from other families: there before
  // the screen paints.
  loader: async ({ context, params }) => {
    const session = (context as { session: AuthSession }).session;
    const me = await queryClient
      .ensureQueryData(meOptions(session))
      .catch((error: unknown) =>
        console.warn("The account didn’t load ahead", error),
      );
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
        .catch((error: unknown) =>
          console.warn("The class's students didn’t load ahead", error),
        ),
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
/** The import's later steps, each at its own address: `import/columns`,
 * `import/review`, `import/done`. */
const schoolClassImportStep = createRoute({
  getParentRoute: () => schoolClass,
  path: "import/$step",
  component: lazyRouteComponent(
    () => import("../features/school/ImportScreen"),
    "ImportScreen",
  ),
});
/** A teacher sets up a class: its two steps, each at its own address
 * (features/school/pilots/start-steps.ts). Nothing rides along in a query. */
const startLoader = async ({ context }: { context: unknown }) => {
  const { session } = context as { session: AuthSession };
  await Promise.all([
    preload(meOptions(session)),
    preload(orgsOptions(session)),
  ]);
};
const schoolStart = createRoute({
  getParentRoute: () => root,
  path: "/school/start",
  staticData: { space: "account" },
  beforeLoad: staffScreen,
  loader: startLoader,
  component: lazyRouteComponent(
    () => import("../features/school/pilots/SchoolStartScreen"),
    "SchoolStartScreen",
  ),
});
const schoolStartStudents = createRoute({
  getParentRoute: () => root,
  path: "/school/start/students",
  staticData: { space: "account" },
  beforeLoad: staffScreen,
  loader: startLoader,
  component: lazyRouteComponent(
    () => import("../features/school/pilots/SchoolStartScreen"),
    "SchoolStartStudentsScreen",
  ),
});
/** "I run a school": the school, then its classes (one short form). */
const schoolCreate = createRoute({
  getParentRoute: () => root,
  path: "/school/start/school",
  staticData: { space: "account" },
  beforeLoad: staffScreen,
  component: lazyRouteComponent(
    () => import("../features/school/pilots/SchoolCreateScreen"),
    "SchoolCreateScreen",
  ),
});
/** Clever. Without Clever enabled there is nothing to connect here, so the
 * address opens class setup instead (no page that can only fail). */
const schoolConnect = createRoute({
  getParentRoute: () => root,
  path: "/school/connect",
  staticData: { space: "account" },
  ...cleverReturn,
  beforeLoad: async () => {
    admit({ web: true });
    const config = await queryClient.ensureQueryData(authConfigOptions);
    if (config.mode === "accounts" && !config.clever) elsewhere("/school/start");
    if (studentSession()) {
      // The component may already have captured a hash-only completion.
      // Await its validation; only the helper can replace a student, and
      // only for an explicitly received completion rather than an old proof.
      const { cleverOnboardingSession } =
        await import("../features/school/clever/onboarding-session");
      await cleverOnboardingSession();
    }
    admit({ adults: true });
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
  staticData: { space: "account" },
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
  staticData: { space: "public" },
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
  staticData: { space: "student" },
  validateSearch: standingsSearchSchema,
  beforeLoad: async () => {
    if (!studentSession()) await toOwnPlace();
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
async function ownPractice(location: { pathname: string; searchStr: string }) {
  const session = await requireSignedIn(location, { web: true, adults: true });
  const me = await queryClient.ensureQueryData(meOptions(session));
  // The server no longer knows the session: sign in again.
  if (!me.signedIn)
    elsewhere(withQuery("/sign-in", signInTarget(location).search));
  return { me, session };
}
const ownRecord = createRoute({
  getParentRoute: () => root,
  path: "/me",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    const { me, session } = await ownPractice(location);
    const own = me.adultPractice?.learner;
    // Nothing to read yet: start, when they may; otherwise their place.
    if (!own) {
      if (me.adultPractice?.eligible) elsewhere("/me/start");
      return toOwnPlace(me);
    }
    // Once `/me` resolves, the adult's own learner is the account's current
    // one (followResolvedLearner).
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
/** The adult's own time, by day and by week (R15), from `/me`'s "This
 * week". The same record `/me` reads, so it paints from the cache. */
const ownTime = createRoute({
  getParentRoute: () => root,
  path: "/me/time",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    const { me, session } = await ownPractice(location);
    // Nothing to time yet: where `/me` would send them, in one hop.
    if (!me.adultPractice?.learner)
      return me.adultPractice?.eligible
        ? elsewhere("/me/start")
        : toOwnPlace(me);
    return { session };
  },
  loader: async ({ context }) => {
    const { session } = context as { session: AuthSession };
    const { ownPracticeOptions } = await import("../features/me/api");
    await queryClient
      .ensureQueryData(ownPracticeOptions(session))
      .catch((error) => console.warn("Your time didn’t load ahead", error));
  },
  component: lazyRouteComponent(ownScreens, "OwnTimeScreen"),
});
const ownStart = createRoute({
  getParentRoute: () => root,
  path: "/me/start",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    const { me } = await ownPractice(location);
    if (me.adultPractice?.learner) elsewhere("/me");
    if (!me.adultPractice?.eligible) await toOwnPlace(me);
  },
  component: lazyRouteComponent(ownScreens, "OwnStartScreen"),
});
/** Practicing as someone else (features/profiles): "Try a level…" and one
 * saved profile's levels. Any adult account; one chunk. */
const profileScreens = () => import("../features/profiles");
const profiles = createRoute({
  getParentRoute: () => root,
  path: "/me/profiles",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    await ownPractice(location);
  },
  component: lazyRouteComponent(profileScreens, "ProfilesScreen"),
});
const newProfile = createRoute({
  getParentRoute: () => root,
  path: "/me/profiles/new",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    await ownPractice(location);
  },
  component: lazyRouteComponent(profileScreens, "NewProfileScreen"),
});
/** "Practice at a level" (SPEC R5): a grade and pace, then practice there. */
const levelPractice = createRoute({
  getParentRoute: () => root,
  path: "/me/level",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    await ownPractice(location);
  },
  component: lazyRouteComponent(profileScreens, "LevelScreen"),
});
const editProfile = createRoute({
  getParentRoute: () => root,
  path: "/me/profiles/$profileId",
  staticData: { space: "me" },
  beforeLoad: async ({ location }) => {
    await ownPractice(location);
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
const notInTheApp = () => admit({ web: true });
const schoolsHome = createRoute({
  getParentRoute: () => root,
  path: "/schools",
  staticData: { space: "public" },
  beforeLoad: notInTheApp,
  loader: loadCurriculum,
  component: lazyRouteComponent(schoolsPublic, "SchoolsScreen"),
});
const schoolsScope = createRoute({
  getParentRoute: () => root,
  path: "/schools/scope-and-sequence",
  staticData: { space: "public" },
  beforeLoad: notInTheApp,
  loader: loadScope,
  component: lazyRouteComponent(schoolsPublic, "ScopeScreen"),
});
const schoolsTrust = createRoute({
  getParentRoute: () => root,
  path: "/schools/trust",
  staticData: { space: "public" },
  beforeLoad: notInTheApp,
  component: lazyRouteComponent(schoolsPublic, "TrustScreen"),
});
/** A family's progress link. Its secret is in the fragment, which `share-entry`
 * has already taken out of the address bar. */
const familyLink = createRoute({
  getParentRoute: () => root,
  path: "/p",
  staticData: { space: "public" },
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
  staticData: { space: "public" },
  // A student's home is their practice.
  beforeLoad: () => admit({ web: true, adults: true }),
  component: lazyRouteComponent(
    () => import("../features/family-approval/ApproveLinkScreen"),
    "ApproveLinkScreen",
  ),
});
const familyApproval = createRoute({
  getParentRoute: () => root,
  path: "/family/approvals/$approvalId",
  staticData: { space: "public" },
  beforeLoad: async ({ location }) => {
    await requireSignedIn(location, { web: true, adults: true });
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
  staticData: { space: "public" },
  validateSearch: (search) => designSearchSchema.parse(search),
  beforeLoad: () => {
    if (!designAllowed()) elsewhere("/");
  },
  component: lazyRouteComponent(
    () => import("../features/design/DesignScreen"),
    "DesignScreen",
  ),
});
const fallback = createRoute({
  getParentRoute: () => appScreen,
  path: "/$",
  // Reject unknown shapes before adopting a learner or loading the legacy app.
  beforeLoad: async ({ location }) => {
    if (!knownDocumentPath(location.pathname)) throw notFound();
    await practiceAddress(location);
    await canonicalLearnerAddress(location);
    await adoptPracticeMode(location);
  },
  // The app screen is rendered by the layout, so load its chunk here, as the
  // route's own component would have been. The Overview's level too, so it
  // paints in its final layout (a learner's first day has its own).
  loader: async ({ location }) => {
    await Promise.all([
      legacy.preload?.(),
      location.pathname === "/overview" &&
        import("../lib/learning-view").then((view) =>
          view.preloadOverviewLevel({
            pathname: location.pathname,
            search: location.search as Record<string, unknown>,
          }),
        ),
    ]);
  },
});
const lessonFilm = createRoute({
  getParentRoute: () => appScreen,
  path: "/lessons/$templateId/watch",
  staticData: { space: "learner" },
  component: lazyRouteComponent(
    () => import("../features/films/FilmScreen"),
    "FilmScreen",
  ),
  loader: async () => {
    await legacy.preload?.();
  },
});
/** A film watched as help for one problem (`<problem>`): the same film,
 * and watching it counts as help for that problem. */
const lessonFilmProblem = createRoute({
  getParentRoute: () => appScreen,
  path: "/lessons/$templateId/watch/$problem",
  staticData: { space: "learner" },
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
      staticData: { space: "public" },
      component: lazyRouteComponent(
        () => import("../features/dev/PersonaSwitcher"),
        "PersonaSwitcher",
      ),
    })
  : null;
const history = nativeRuntime
  ? createMemoryHistory({ initialEntries: ["/"] })
  : createBrowserHistory();
export const router = createRouter({
  routeTree: root.addChildren([
    appScreen.addChildren([home, fallback, lessonFilm, lessonFilmProblem]),
    join,
    joinContinue,
    joinClass,
    joinPictures,
    signInCard,
    schoolClass.addChildren([
      schoolClassToday,
      schoolClassMap,
      schoolClassGradebook,
      schoolClassTime,
      schoolClassReportCards,
      schoolClassSettings,
      schoolClassRoster,
      schoolClassImport,
      schoolClassImportStep,
      schoolClassStart,
      schoolClassCards,
      schoolClassExperience,
      schoolClassWorkbooks,
      schoolClassMarks,
      schoolClassMissing,
    ]),
    standings,
    ownRecord,
    ownTime,
    ownStart,
    profiles,
    newProfile,
    levelPractice,
    editProfile,
    schoolsHome,
    schoolsScope,
    schoolsTrust,
    schoolsContinue,
    schoolStart,
    schoolStartStudents,
    schoolCreate,
    schoolConnect,
    schoolAdopt,
    familyLink,
    familyApprove,
    familyApproval,
    design,
    signIn,
    signUp,
    accountReady,
    accountDeleted,
    accessGift,
    signInStep,
    reset,
    starterIndex,
    starterChoice,
    starterStep,
    startPlan,
    startPurchase,
    startName,
    startYear,
    startConsent,
    startVerify,
    inventory,
    pathways.addChildren([pathwaysIndex]),
    workbookHistory,
    workbookDay,
    workbookResults,
    accountHub.addChildren([...accountOverlays(accountHub)]),
    invoiceArkansas,
    invoiceArizona,
    invoiceNewHampshire,
    // Linked to through the splat route, as every staff screen is, so their
    // URLs stay out of the typed route table.
    ...(schoolRoutes(root) as unknown as []),
    ...(familyRoutes(root) as unknown as []),
    ...payAddresses(root),
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
  // Every route catches its own failure, inside its parent: a screen that
  // fails to load or render says so in the content area, under the app's bar
  // and menu, with Try again and Go home. Only the root's own failure (the
  // shell itself) takes the whole page. React reports each caught error
  // (createRoot's onCaughtError in boot.tsx, trackClientError).
  defaultErrorComponent: RouterError,
  defaultPendingMs: 1000,
  defaultPendingMinMs: 0,
});
// The learner a resolved address names is the account's current learner:
// the router writes it, once per navigation (learner-store.ts).
followResolvedLearner(router);
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
    ampRouteTable: () => [
      ...(Object.values(router.routesById) as unknown as Entry[])
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
      // Old addresses (app/legacy-aliases.ts): each an address, no page.
      ...[
        ...new Set(
          LEGACY_ALIASES.filter((alias) => !alias.when).map(
            (alias) => alias.from,
          ),
        ),
      ]
        .filter((path) => !router.routesById[path as never])
        .map((path) => ({ path, page: false })),
    ],
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
      state: stampPrevious(
        {
          ...next,
          state: carryFamilyPractice(
            next.pathname,
            next.state,
            router.history.location.state,
          ),
        },
        router.history.location,
      ) as typeof next.state,
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
    // Who a learning screen is for, and where adding a place returns, go
    // with the reader (features/profiles/practice-mode.ts, `carriedKeys`).
    const identity = carriedKeys(
      {
        pathname: here.pathname,
        search: here.search as Record<string, unknown>,
      },
      {
        pathname: next.pathname,
        search: next.search as Record<string, unknown>,
      },
      typeof options.search === "object" && options.search !== null
        ? Object.keys(options.search)
        : [],
    );
    if (identity)
      return build({
        ...options,
        search: { ...(next.search as object), ...identity },
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
// Back and Forward between a screen and what is open over it keep the
// screen's scroll: a sheet in history state (the same address), or an
// overlay one leaf below the screen (`overList`: a settings hub's Billing or
// Privacy, a workbook day). After a pop the router otherwise scrolls the
// window to the top, so closing an overlay with ✕ (which goes Back,
// lib/return-to.ts) lost the reader's place on the screen behind.
router.history.subscribe(({ location, action }) => {
  if (action.type === "PUSH" || action.type === "REPLACE") return;
  const from = router.state.location.pathname;
  if (from === location.pathname || overList(from, location.pathname))
    router._scroll.n = false;
});
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
  const chosen = currentLearner();
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
// A device handed to a child from a parent's screen: the child's identity
// arrives in the same render as the screen that mounts next (practice), so
// the parent's screen never redraws for the child first
// (features/school/join/api.ts).
router.subscribe("onBeforeRouteMount", () => applyDeferredIdentity());
// A link from before the layer store names its layers in the address
// (`?open=`): once the screen is on view they move into the store
// (nav/layer-store.ts) and leave the address, replacing its entry. The one
// legacy step; nothing in the app writes `?open=` into the address bar.
router.subscribe("onResolved", ({ toLocation }) => {
  const legacy = settleLegacyLayers(
    toLocation,
    queryClient.getQueryData(sessionOptions.queryKey)?.accountId,
  );
  if (!legacy) return;
  seedLayers(legacy.scope, legacy.stack);
  void router.navigate({
    href: legacy.href,
    replace: true,
    resetScroll: false,
  });
});
const SIGNED_OUT_KEY = "amp.signed-out-redirect";
/** True when this tab was sent to sign-in moments ago: a second 401 then is
 * not an ended session, and redirecting again would loop. */
function redirectedRecently() {
  try {
    const at = Number(sessionStorage.getItem(SIGNED_OUT_KEY));
    sessionStorage.setItem(SIGNED_OUT_KEY, String(Date.now()));
    return Date.now() - at < 30_000;
  } catch (error) {
    console.warn("This tab's last sign-in redirect wasn't read", error);
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
  // Setup handles an expired credential in place. A late response from the
  // previous student must not replace an explicitly started Clever handoff.
  if (window.location.pathname === "/school/connect") return false;
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
            queryClient.removeQueries({ queryKey: qk.accounts() });
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
  const { pathname } = router.state.location;
  // Sign-in screens, a student's included, have no sign-in to leave.
  if (/^\/(sign-in|sign-up|reset-password|join|c)(\/|$)/.test(pathname))
    return false;
  if (redirectedRecently()) return false;
  leaving = true;
  const clear = () => {
    leaving = false;
    queryClient.setQueryData(sessionOptions.queryKey, null);
    queryClient.removeQueries({ queryKey: qk.accounts() });
  };
  // The sign-in gate's own address (app/sign-in-gate.ts), carrying the
  // campaign, program and return context.
  const target = signInTarget(router.state.location);
  void router
    .preloadRoute(target)
    .catch((error: unknown) =>
      console.warn("Sign-in didn’t load ahead", error),
    )
    .then(() => router.navigate({ ...target, replace: true }))
    .finally(clear);
  return true;
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
