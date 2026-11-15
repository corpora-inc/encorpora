import { z } from "zod";
import { MARKETING_SCREENS } from "./site-categories.js";

/** Categories, never raw URLs, query strings, lesson titles or learner IDs. */
export const SCREENS = [
  ...MARKETING_SCREENS,
  "home",
  "pitch",
  "pathways",
  "assessment",
  "practice",
  "lesson",
  "plans",
  "checkout",
  "invoice",
  "funding",
  "account",
  "auth",
  "other",
] as const;
export const TRAFFIC_KINDS = ["external", "internal", "automated"] as const;
export type TrafficKind = (typeof TRAFFIC_KINDS)[number];
export function screenForPath(path: string): (typeof SCREENS)[number] {
  const p = path.split(/[?#]/)[0];
  if (p === "/") return "home";
  if (/^\/(?:pathways|try\/map)(?:\/|$)/.test(p)) return "pathways";
  if (/^\/invoice(?:\/|$)/.test(p)) return "invoice";
  if (/^\/purchase\/(arkansas|arizona|new-hampshire)/.test(p)) return "funding";
  if (/^\/(?:sign-in|sign-up|reset-password|auth)(?:\/|$)/.test(p))
    return "auth";
  if (/^\/(?:account|family)(?:\/|$)/.test(p)) return "account";
  if (/^\/(?:checkout|start\/purchase)(?:\/|$)/.test(p)) return "checkout";
  if (/^\/(?:plans|try\/plans|start\/plan|purchase)(?:\/|$)/.test(p))
    return "plans";
  if (/^\/(?:try\/practice|practice)(?:\/|$)/.test(p)) return "practice";
  if (/^\/(?:lesson|lessons|book|books)(?:\/|$)/.test(p)) return "lesson";
  if (/^\/try(?:\/|$)/.test(p)) return "assessment";
  if (/^\/(?:start|inventory|access)(?:\/|$)/.test(p)) return "account";
  return "other";
}
export const engagementSchema = z
  .strictObject({
    sessionId: z.uuidv4(),
    pageId: z.uuidv4(),
    ordinal: z.number().int().min(0).max(100000),
    screen: z.enum(SCREENS),
    visibleMs: z.number().int().min(0).max(86400000),
    activeMs: z.number().int().min(0).max(86400000),
  })
  .refine((p) => p.activeMs <= p.visibleMs);
export type Engagement = z.infer<typeof engagementSchema>;

export { EngagementClock } from "./engagement-clock.js";
