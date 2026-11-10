import { z } from "zod";
import { analyticsTraffic } from "../../lib/analytics";
import { nativeRuntime } from "../../native-runtime";

/** The widths every screen is checked at (the premium UI standard). */
export const designWidths = [320, 390, 768, 1280] as const;
export type DesignWidth = (typeof designWidths)[number] | "fill";
export type DesignTheme = "light" | "dark";

/** `/design`'s address: the gallery's width and theme, and which document
 * this is. The gallery page draws its controls and frames `frame=canvas`,
 * where the components render at the chosen width; `frame=specimen` is one
 * component that owns the whole viewport (practice, a sheet, a toast). */
export const designSearchSchema = z.object({
  width: z
    // The router reads `?width=390` as a number.
    .union([z.literal("fill"), ...designWidths.map((w) => z.literal(w))])
    .optional()
    .catch(undefined),
  theme: z.enum(["light", "dark"]).optional().catch(undefined),
  frame: z.enum(["canvas", "specimen"]).optional().catch(undefined),
  specimen: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional()
    .catch(undefined),
});
export type DesignSearch = z.infer<typeof designSearchSchema>;

/** The gallery is an internal tool: on a development server, or in a browser
 * marked as staff with `localStorage['amp.analytics.traffic'] = 'internal'`
 * (docs/engagement-measurement.md), never in the native app. It renders only
 * fixtures, so the mark keeps it out of sight rather than guarding data. */
export function designAllowed() {
  if (nativeRuntime) return false;
  return import.meta.env.DEV || analyticsTraffic() === "internal";
}
