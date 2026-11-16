import { PitchNavProvider } from "./nav";
import { PitchPage } from "./PitchPage";
import { useRouterPitchNav } from "./router-nav";

export { loadPitch } from "./PitchPage";

/** The pitch inside the app, at `/` for a signed-out web visitor, moving
 * through the router. The home document paints the same `PitchPage` before
 * the app loads (`home-entry.tsx`). */
export function PitchScreen() {
  return (
    <PitchNavProvider value={useRouterPitchNav()}>
      <PitchPage />
    </PitchNavProvider>
  );
}
