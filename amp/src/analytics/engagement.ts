import { z } from "zod";
import { MARKETING_SCREENS } from "./site-actions.js";

/** Categories, never raw URLs, query strings, lesson titles or learner IDs. */
export const SCREENS = [
  ...MARKETING_SCREENS,
  "home",
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

/** Monotonic elapsed time. Long timer gaps are treated as suspend, not use. */
export class EngagementClock {
  visibleMs = 0;
  activeMs = 0;
  private last: number;
  private input: number;
  private visible: boolean;
  constructor(now: number, visible: boolean) {
    this.last = this.input = now;
    this.visible = visible;
  }
  sample(now: number, visible: boolean, interaction = false) {
    const elapsed = Math.max(0, now - this.last);
    if (this.visible && elapsed <= 60000) {
      this.visibleMs = Math.min(86400000, this.visibleMs + elapsed);
      this.activeMs = Math.min(
        86400000,
        this.activeMs +
          Math.max(0, Math.min(now, this.input + 60000) - this.last),
      );
    }
    if (interaction && visible) this.input = now;
    this.visible = visible;
    this.last = now;
  }
}
