/**
 * Free-trial funnel events go through the shared first-party helper; the
 * vocabulary and props live in `src/analytics/events.ts` (#1134).
 */
export { track, trackSessionStart } from "../../lib/analytics";
