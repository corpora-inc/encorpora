import "./consent-entry";
import { createRoot } from "react-dom/client";
import { RouterView } from "./app/RouterView";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./app/styles";
import { startEngagement } from "./lib/engagement";
import { trackSessionStart, trackGooglePage } from "./lib/analytics";
// After consent-entry has removed any private fragment from the URL.
const engagement = startEngagement();
router.subscribe("onResolved", () => {
  engagement.navigate(router.state.location.pathname);
  trackGooglePage();
});
trackGooglePage();
trackSessionStart();
createRoot(document.getElementById("root")!).render(
  <Providers>
    <RouterView />
  </Providers>,
);
