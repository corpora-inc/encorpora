/**
 * Standalone dev entry. `npm run dev` and play.
 *
 * URL knobs, for playtesting rather than for players:
 *   ?seed=abc     reproduce a run's arithmetic exactly
 *   ?level=5      start the question ladder high instead of at single digits
 *   ?reduced=1    force the reduced-motion path without touching OS settings
 */

import { createStubHost } from "./stub/host.ts";
import { mountSerpent } from "./game/mount.ts";
import type { Report } from "./contract.ts";

const params = new URLSearchParams(location.search);
const el = document.getElementById("stage");
if (!el) throw new Error("no #stage");

const reports: Report[] = [];
const forceReduced = params.get("reduced") === "1";

const host = createStubHost({
  ...(params.get("seed") ? { seed: params.get("seed") as string } : {}),
  ...(params.get("level") ? { startLevel: Number(params.get("level")) } : {}),
  onReport: (r) => {
    reports.push(r);
    if (reports.length > 400) reports.shift();
  },
});

const patched = forceReduced ? { ...host, prefersReducedMotion: () => true } : host;
const handle = mountSerpent(el, patched);

// A seam for automated playtesting: drive the real game, read the real state.
Object.defineProperty(window, "__serpent", {
  value: {
    handle,
    host,
    reports,
    stats: () => host.stats(),
    accuracy: () => {
      if (reports.length === 0) return 1;
      return reports.filter((r) => r.correct).length / reports.length;
    },
  },
  configurable: true,
});
