import "./card-entry";
import "./share-entry";
// A consent email's private fragment leaves the URL before any module that
// can load authentication evaluates (capability-entry's school sessions and
// analytics do): see consent-entry.ts.
import "./consent-entry";
import "./capability-entry";
import "./lib/zod-config";
import { errorDetails } from "../analytics/error-details";
import { screenOf, trackClientError } from "./lib/analytics";
import { startRuntimeRecovery } from "./lib/chunk-recovery";
import { ChunkRecoveryNotice } from "./ui/ChunkRecoveryNotice";
import { createRoot } from "react-dom/client";
import { RouterView } from "./app/RouterView";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./app/styles";
import { preloadMathFonts } from "./app/preload-math-fonts";
import { captureOpenAIEntry } from "./lib/openai-acquisition";
import { startEngagement } from "./lib/engagement";
import {
  startAdultActivity,
  startStudentActivity,
} from "./lib/student-activity";
import { watchForNewRelease } from "./lib/app-recovery";
import { discardStalePurchaseReturn } from "./purchase-return";
import { trackSessionStart, trackGooglePage } from "./lib/analytics";
import { finishingSignIn } from "./features/school/join/api";
// After consent-entry has removed any private fragment from the URL.
discardStalePurchaseReturn();
startRuntimeRecovery();
captureOpenAIEntry();
const engagement = startEngagement({ awaitRoute: true });
const studentActivity = startStudentActivity();
const adultActivity = startAdultActivity();
router.subscribe("onResolved", () => {
  engagement.navigate(router.state.location.pathname);
  studentActivity.navigate(router.state.location.pathname);
  adultActivity.navigate(router.state.location.pathname);
  trackGooglePage();
  if (screenOf(router.state.location.pathname) !== "pitch") preloadMathFonts();
});
trackGooglePage();
trackSessionStart();
watchForNewRelease();
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
      // A purchase view belongs to the parent who opened it. The provider has
      // already cleared that parent's private state and installed the new session.
      // Child practice and the parent's return preserve the invoice origin.
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
