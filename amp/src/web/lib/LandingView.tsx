import { useEffect } from "react";
import { landingProps, trackOnce } from "./analytics";

/** Records `landing_view` once per tab session when the public landing shows.
 * Renders nothing, so it never affects layout. */
export function LandingView() {
  useEffect(() => trackOnce("landing", "landing_view", landingProps()), []);
  return null;
}
