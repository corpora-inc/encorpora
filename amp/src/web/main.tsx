import "./card-entry";
import "./share-entry";
import "./capability-entry";
import "./lib/zod-config";
import { errorDetails } from "../analytics/error-details";
import { screenOf, trackClientError } from "./lib/analytics";
import "./consent-entry";
import { startRuntimeRecovery } from "./lib/chunk-recovery";
import { ChunkRecoveryNotice } from "./ui/ChunkRecoveryNotice";
import { createRoot } from "react-dom/client";
import { RouterView } from "./app/RouterView";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./app/styles";
import "./app/preload-math-fonts";
import { captureOpenAIEntry } from "./lib/openai-acquisition";
import { startEngagement } from "./lib/engagement";
import {
  startAdultActivity,
  startStudentActivity,
} from "./lib/student-activity";
import { watchForNewRelease } from "./lib/app-recovery";
import { trackSessionStart, trackGooglePage } from "./lib/analytics";
// After consent-entry has removed any private fragment from the URL.
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
    onAccountExit={() => {
      // A purchase view belongs to the parent who opened it. The provider has
      // already cleared that parent's private state and installed the new session.
      if (/^\/purchase(?:\/|$)/.test(router.state.location.pathname))
        void router.navigate({ to: "/", replace: true });
    }}
  >
    <RouterView />
    <ChunkRecoveryNotice />
  </Providers>,
);
