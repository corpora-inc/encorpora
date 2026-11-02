import { errorDetails } from "../analytics/error-details";
import { track } from "./lib/analytics";
import { screenForPath } from "../analytics/engagement";
import "./consent-entry";
import { createRoot } from "react-dom/client";
import { RouterView } from "./app/RouterView";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./app/styles";
import { captureOpenAIEntry } from "./lib/openai-acquisition";
import { startEngagement } from "./lib/engagement";
import { watchForNewRelease } from "./lib/app-recovery";
import { trackSessionStart, trackGooglePage } from "./lib/analytics";
// After consent-entry has removed any private fragment from the URL.
captureOpenAIEntry();
const engagement = startEngagement();
router.subscribe("onResolved", () => {
  engagement.navigate(router.state.location.pathname);
  trackGooglePage();
});
trackGooglePage();
trackSessionStart();
watchForNewRelease();
createRoot(document.getElementById("root")!, {
  onCaughtError: (error) =>
    track("client_error", {
      ...errorDetails(error, undefined, location.origin),
      kind: "render",
      boundary: "caught",
      screen: screenForPath(location.pathname),
    }),
  onUncaughtError: (error) =>
    track("client_error", {
      ...errorDetails(error, undefined, location.origin),
      kind: "render",
      boundary: "uncaught",
      screen: screenForPath(location.pathname),
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
  </Providers>,
);
