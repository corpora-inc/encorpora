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
  onCaughtError: () =>
    track("client_error", {
      kind: "render",
      screen: screenForPath(location.pathname),
    }),
  onUncaughtError: () =>
    track("client_error", {
      kind: "render",
      screen: screenForPath(location.pathname),
    }),
}).render(
  <Providers>
    <RouterView />
  </Providers>,
);
