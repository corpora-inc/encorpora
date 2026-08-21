/**
 * The standalone street: `npm run dev`.
 *
 * Ten stub stalls, and past them the scaffolding goes on forever. Query
 * parameters exist for the screenshot harness only — they are not a product
 * surface and there is no UI for them:
 *
 *   ?day=0.95      day-state
 *   ?night=1       force the night bazaar
 *   ?sub=1         subscribed
 *   ?sound=0       sound valve shut
 *   ?at=6          open centred on the nth stall
 */

import { mountBazaar } from "../bazaar.ts";
import { QUARTERS } from "../world/quarters.ts";
import { DEMO_PREVIEWS, DEMO_TITLES } from "./previews.ts";
import type { StallSpec } from "../types.ts";
import "../tokens/bazaar.css";

const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => {
  const v = q.get(k);
  return v === null ? d : Number(v);
};

const stalls: StallSpec[] = QUARTERS.map((quarter, i) => ({
  id: quarter.id,
  title: DEMO_TITLES[quarter.id] ?? quarter.id,
  quarter: quarter.id,
  preview: DEMO_PREVIEWS[quarter.id],
  state: "open",
  accretion: [0.9, 0.2, 0.65, 0.4, 0, 0.3, 0.1, 0.5, 0.75, 0][i] ?? 0,
}));

const el = document.getElementById("bazaar");
if (el) {
  const bazaar = mountBazaar(el, {
    stalls,
    dayRemaining: 1 - num("day", 0.12),
    subscribed: q.get("sub") === "1",
    sound: q.get("sound") !== "0",
    theme: q.get("night") === "1" ? "night" : "auto",
    seed: 0x1453,
    onEnter: (id) => {
      // The host owns what happens next; the bazaar owns coming back.
      console.info("enter", id);
      setTimeout(() => bazaar.setInStall(false), 1400);
    },
    onUpgrade: () => console.info("upgrade sheet"),
  });

  const at = q.get("at");
  if (at !== null) {
    const target = stalls[Number(at) % stalls.length];
    if (target) requestAnimationFrame(() => bazaar.goToStall(target.id));
  }

  // The screenshot harness reads these; nothing in the product does.
  (window as unknown as { bazaar: typeof bazaar }).bazaar = bazaar;
}
