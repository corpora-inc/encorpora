// `/`'s own entry (home.html). A signed-out visitor from an ad gets the pitch
// from this light bundle, without the app; the app loads once the pitch is
// up, and takes over when the visitor goes on. Anyone else at `/` gets the
// app at once, as on every other route (`main.tsx`).
import "./lib/zod-config";
// Before anything reads the URL: a consent email's private fragment.
import "./consent-entry";
import {
  defaultParseSearch,
  defaultStringifySearch,
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { errorDetails } from "../analytics/error-details";
import { startDocumentRuntime } from "./app/document-runtime";
import { loadBuyData } from "./features/pitch/BuyOptions";
import { mayShowPitch, signedOutVisitor } from "./features/pitch/home-decision";
import {
  PitchNavProvider,
  type PitchNav,
  type PitchPlace,
} from "./features/pitch/nav";
import { PitchPage } from "./features/pitch/PitchPage";
import { pitchTarget } from "./features/pitch/targets";
import {
  screenOf,
  setAnalyticsSession,
  setPitchShown,
  trackClientError,
  trackGooglePage,
} from "./lib/analytics";
import { campaignSearch } from "./lib/funded-entry";
import { queryClient } from "./lib/query-client";
import { LoadingScreen, markArrival } from "./ui/LoadingScreen";

const container = document.getElementById("root")!;
const search = defaultParseSearch(location.search) as Record<string, unknown>;

let app: Promise<typeof import("./app/boot")> | undefined;
/** The app's code: after the pitch is up, or sooner if a visitor goes on. */
const loadApp = () => (app ??= import("./app/boot"));

function bootApp() {
  // A failed import is the runtime's to recover (`lib/chunk-recovery.ts`).
  void loadApp().then((module) => module.bootApp());
}

const reportRender = (boundary: "caught" | "uncaught") => (error: unknown) =>
  trackClientError({
    ...errorDetails(error, undefined, location.origin),
    kind: "render",
    boundary,
    screen: screenOf(location.pathname),
  });

function showPitch() {
  let root: Root | null = createRoot(container, {
    onCaughtError: reportRender("caught"),
    onUncaughtError: (error) => {
      reportRender("uncaught")(error);
      // The app's own `/` has its error screens and recovery.
      root = null;
      bootApp();
    },
  });
  const close = () => {
    root?.unmount();
    root = null;
  };
  let leaving = false;
  const nav: PitchNav = {
    search,
    // What the router's links show: the place, with the campaign labels and
    // program it keeps on every move (`app/router.tsx`, the root's search).
    href: ({ to, search: next = {} }) =>
      to +
      defaultStringifySearch({
        ...campaignSearch(search),
        ...(typeof search.program === "string"
          ? { program: search.program }
          : {}),
        ...(search.entry !== undefined ? { entry: search.entry } : {}),
        ...next,
      }),
    // The brand on `/` is this page: the router would show it again.
    go: (place) => void (place.to === "/" || leave(place)),
    preload: () => void loadApp(),
    reload: () => void leave({ to: "/", search }),
  };
  async function leave(place: PitchPlace) {
    if (leaving) return;
    leaving = true;
    // As a move within the app shows its pending screen after a second.
    const pending = setTimeout(() => root?.render(<LoadingScreen />), 1000);
    try {
      const { openFromPitch } = await loadApp();
      await openFromPitch(place, () => {
        clearTimeout(pending);
        close();
      });
    } catch (error) {
      clearTimeout(pending);
      console.error("The app didn't open from the pitch", error);
      // Still a real address: the browser opens it as a page.
      location.assign(nav.href(place));
    }
  }
  markArrival();
  root.render(
    <QueryClientProvider client={queryClient}>
      <PitchNavProvider value={nav}>
        <PitchPage />
      </PitchNavProvider>
    </QueryClientProvider>,
  );
}

async function start() {
  // First, as the app's entry does: error reporting and recovery, and the
  // page's measurement.
  const runtime = startDocumentRuntime();
  if (!mayShowPitch(search)) return bootApp();
  let pitch = false;
  try {
    // The pitch paints once, complete, with its prices (as the app's `/`
    // loads them before it shows the pitch).
    [pitch] = await Promise.all([signedOutVisitor(), loadBuyData(search)]);
  } catch (error) {
    console.warn("`/` is the app's to decide", error);
  }
  if (!pitch) return bootApp();
  // What the app's session check and `/` route record for a signed-out
  // visitor at the pitch.
  setAnalyticsSession(null);
  setPitchShown(true);
  showPitch();
  runtime.engagement.navigate(location.pathname);
  trackGooglePage();
  // The app loads while the visitor reads, so every way on opens at once.
  const idle = () =>
    void loadApp()
      .then((module) =>
        module.prepareFromPitch([
          pitchTarget("try", search),
          pitchTarget("card", search),
        ]),
      )
      .catch((error: unknown) =>
        console.warn("The app will load when it's needed", error),
      );
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(idle, { timeout: 2000 });
  else setTimeout(idle, 200);
}

void start();
