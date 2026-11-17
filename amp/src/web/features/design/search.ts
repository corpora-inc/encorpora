import { analyticsTraffic } from "../../lib/analytics";
import { nativeRuntime } from "../../native-runtime";

/** The widths every screen is checked at (the premium UI standard). */
export const designWidths = [320, 390, 768, 1280] as const;
export type DesignWidth = (typeof designWidths)[number] | "fill";
export type DesignTheme = "light" | "dark";

/** The gallery is an internal tool: on a development server, or in a browser
 * marked as staff with `localStorage['amp.analytics.traffic'] = 'internal'`
 * (docs/engagement-measurement.md), never in the native app. It renders only
 * fixtures, so the mark keeps it out of sight rather than guarding data. */
export function designAllowed() {
  if (nativeRuntime) return false;
  return import.meta.env.DEV || analyticsTraffic() === "internal";
}
