import "../card-entry";
import "../share-entry";
// A consent email's private fragment leaves the URL before any module that
// can load authentication evaluates (capability-entry's school sessions and
// analytics do): see consent-entry.ts. The light home document
// (home-entry.tsx) imports it first itself.
import "../consent-entry";
import "../capability-entry";
import "../lib/zod-config";
import { errorDetails } from "../../analytics/error-details";
import {
  screenOf,
  setAnalyticsSession,
  trackClientError,
  trackGooglePage,
} from "../lib/analytics";
import { ChunkRecoveryNotice } from "../ui/ChunkRecoveryNotice";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { RouterView } from "./RouterView";
import { Providers } from "./providers";
import { router } from "./router";
import "./styles";
import { preloadMathFonts } from "./preload-math-fonts";
import {
  startAdultActivity,
  startStudentActivity,
} from "../lib/student-activity";
import { changeSession } from "../lib/session-generation";
import { authConfigOptions, queryClient, sessionOptions } from "../lib/query";
import { fetchAuthConfig } from "../auth-config";
import type { PitchPlace } from "../features/pitch/nav";
import { startDocumentRuntime } from "./document-runtime";
import { finishingSignIn } from "../features/school/join/api";

let started = false;
/** The app's services, once per document. */
function start() {
  if (started) return;
  started = true;
  const { engagement } = startDocumentRuntime();
  const studentActivity = startStudentActivity();
  const adultActivity = startAdultActivity();
  router.subscribe("onResolved", () => {
    engagement.navigate(router.state.location.pathname);
    studentActivity.navigate(router.state.location.pathname);
    adultActivity.navigate(router.state.location.pathname);
    trackGooglePage();
    if (screenOf(router.state.location.pathname) !== "pitch")
      preloadMathFonts();
  });
}

function render() {
  createRoot(document.getElementById("root")!, {
    onCaughtError: (error) =>
      trackClientError({
        ...errorDetails(error, undefined, location.origin),
        kind: "render",
        boundary: "caught",
        screen: screenOf(location.pathname),
      }),
    onUncaughtError: (error) =>
      trackClientError({
        ...errorDetails(error, undefined, location.origin),
        kind: "render",
        boundary: "uncaught",
        screen: screenOf(location.pathname),
      }),
  }).render(
    <Providers
      onAccountExit={(previous) => {
        // A handoff to a child ("Practice with …") carries its own
        // destination: its one navigation runs the new session's guards
        // there. Re-guarding the screen it leaves would replace that entry
        // ("/" for a student), so Back could never return to it.
        if (finishingSignIn()) return;
        // A purchase view belongs to the parent who opened it. The provider has
        // already cleared that parent's private state and installed the new
        // session. Child practice and the parent's return preserve the
        // invoice origin.
        if (
          !previous.accountId.startsWith("school:") &&
          !finishingSignIn() &&
          /^\/purchase(?:\/|$)/.test(router.state.location.pathname)
        )
          void router.navigate({ to: "/", replace: true });
        // Any other screen stays only if its own guard admits the new session
        // (none, after another tab signed out): never a blank account screen.
        else void router.invalidate();
      }}
    >
      <RouterView />
      <ChunkRecoveryNotice />
    </Providers>,
  );
}

/** The app, on every document but the signed-out pitch's. */
export function bootApp() {
  start();
  render();
}

/**
 * The light home document (`home-entry.tsx`) asked, as `/` loaded, and found
 * no one signed in: the app takes that answer instead of asking again, as it
 * would have kept its own. A sign-in in another tab isn't heard while only
 * the pitch shows, so `openFromPitch` checks the session again on the way
 * out. Then what the pitch's ways out need is readied while the visitor
 * reads, so each opens at once.
 */
export async function prepareFromPitch(places: PitchPlace[]): Promise<void> {
  if (queryClient.getQueryData(sessionOptions.queryKey) === undefined) {
    changeSession(undefined, null);
    setAnalyticsSession(null);
    queryClient.setQueryData(sessionOptions.queryKey, null);
  }
  const config = await fetchAuthConfig().catch(() => undefined);
  if (config) queryClient.setQueryData(authConfigOptions.queryKey, config);
  await Promise.all(
    places.map((place) =>
      router
        .preloadRoute(place as never)
        .catch((error: unknown) => console.warn("Preload failed", error)),
    ),
  );
}

/**
 * The visitor leaves the light pitch for `place`: the app loads that screen
 * with the pitch still showing, then replaces it, as a move within the app
 * keeps the old screen until the new one is ready.
 */
export async function openFromPitch(
  place: PitchPlace,
  closePitch: () => void,
): Promise<void> {
  start();
  // While only the light pitch showed, nothing heard a sign-in made in
  // another tab (that notice starts with the mounted app), so the "signed
  // out" answer `prepareFromPitch` kept may be stale. Ask once, as the
  // visitor leaves, so the place opens for whoever is actually signed in.
  await queryClient
    .fetchQuery({ ...sessionOptions, staleTime: 0 })
    .catch((error: unknown) =>
      console.warn(
        "The session couldn't be checked on leaving the pitch",
        error,
      ),
    );
  const target = router.buildLocation(place as never);
  // A move to `/` itself (a consent link arriving) only decides `/` again.
  if (target.href !== router.latestLocation.href)
    void router.navigate(place as never);
  // Not yet mounted, the router doesn't load on its own: `router.tsx`
  // subscribes to its history first.
  await router.load();
  closePitch();
  window.scrollTo(0, 0);
  // In the same task as the pitch's removal, so no empty frame paints.
  flushSync(render);
}
