/**
 * Scoped styles for the Vignette framework + the taxi reference.
 *
 * Per the OWNERSHIP rule for this slice, vignettes do NOT touch the shared
 * `styles.css` (other agents are live in it). Instead we inject ONE
 * `<style data-wp-vignette>` block (idempotent — mirrors `badgeCase.ensureStyles`)
 * namespaced under `.wp-vig*`. The framework's host classes are `.wp-vig-*`; the
 * taxi's are `.wp-vig-taxi-*`. We deliberately AVOID `.wp-vignette`, which is the
 * unrelated screen-space color-effect div in game.ts/styles.css.
 *
 * Z-DISCIPLINE: the vignette root mounts INSIDE `.wp-overlay` (z 10, its own
 * stacking context) and uses a high z WITHIN that context (above the menu band)
 * so a centered challenge launched by the vignette (encounter z 60) still stacks
 * correctly relative to the vignette's own dialogue tray. We don't fight the
 * world's z-scale — we live above it inside the overlay, exactly as the menu does.
 *
 * MOTION: every transition is compositor-only (opacity + transform); a
 * `prefers-reduced-motion` block flattens them to instant. The host also passes
 * `reducedMotion` into the context for JS-driven flourishes (the fare-paid pop).
 */

const STYLE_ATTR = "data-wp-vignette"

/** Inject the scoped stylesheet once (idempotent). */
export function ensureVignetteStyles(): void {
  if (typeof document === "undefined") return
  if (document.querySelector(`style[${STYLE_ATTR}]`)) return
  const style = document.createElement("style")
  style.setAttribute(STYLE_ATTR, "")
  style.textContent = CSS
  document.head.appendChild(style)
}

/**
 * The whole vignette stylesheet. Two layers:
 *   - `.wp-vig-root` — the framework's fullscreen container + IN/OUT transition
 *     + the universal Exit affordance.
 *   - `.wp-vig-taxi-*` — the reference taxi back-seat scene (window parallax,
 *     driver billboard, seatbelt/door framing, dialogue tray, fare HUD).
 */
const CSS = `
/* ===================== framework: fullscreen container ===================== */
.wp-vig-root {
  position: absolute;
  inset: 0;
  /* Above the in-overlay menu band but a self-contained stacking context, so a
     centered challenge (z 60) the vignette launches still layers above its tray. */
  z-index: 72;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0c0a09;
  color: #f7f1e6;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  /* compositor-only entrance: fade + a gentle settle */
  opacity: 0;
  transform: scale(1.012);
  transition: opacity 0.34s ease, transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}
.wp-vig-root--in {
  opacity: 1;
  transform: scale(1);
}
.wp-vig-root--out {
  opacity: 0;
  transform: scale(1.012);
}

/* The universal Exit affordance (door/leave) — always present, ≥44px. */
.wp-vig-exit {
  position: absolute;
  top: max(14px, env(safe-area-inset-top, 0px));
  left: max(14px, env(safe-area-inset-left, 0px));
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px 0 12px;
  border: none;
  border-radius: 22px;
  background: rgba(20, 16, 12, 0.62);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: #f7f1e6;
  font: 600 15px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  transition: background 0.18s ease, transform 0.12s ease;
}
.wp-vig-exit:hover { background: rgba(28, 22, 16, 0.82); }
.wp-vig-exit:active { transform: scale(0.97); }
.wp-vig-exit__glyph { font-size: 18px; line-height: 1; }

/* ===================== taxi: the back-seat scene ===================== */
.wp-vig-taxi {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  --vig-accent: #e8b54a;
  --vig-night: #1a1410;
}

/* The window band: the city slides past behind the driver. */
.wp-vig-taxi-window {
  position: absolute;
  inset: 0 0 38% 0;
  overflow: hidden;
  background: linear-gradient(#243447 0%, #3a4a5e 46%, #6b5544 100%);
}
/* Two parallax strips of skyline silhouettes scrolling at different speeds. */
.wp-vig-taxi-parallax {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 100%;
  width: 200%;
  background-repeat: repeat-x;
  background-position: bottom left;
  will-change: transform;
}
.wp-vig-taxi-parallax--far {
  opacity: 0.55;
  animation: wp-vig-scroll 26s linear infinite;
}
.wp-vig-taxi-parallax--near {
  opacity: 0.9;
  animation: wp-vig-scroll 13s linear infinite;
}
@keyframes wp-vig-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
/* Warm low-sun wash + a soft vignette so it reads HD-2D, not flat. */
.wp-vig-taxi-window::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 80% at 78% 22%, rgba(255, 214, 150, 0.28), transparent 60%),
    radial-gradient(140% 120% at 50% 120%, rgba(0, 0, 0, 0.45), transparent 60%);
  pointer-events: none;
}

/* The car interior: dashboard + door frame + seatbelt, drawn over the window. */
.wp-vig-taxi-cabin {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
/* Door pillar on the left, framing the back seat. */
.wp-vig-taxi-cabin::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 14%;
  background: linear-gradient(90deg, #1b1410 0%, #2a201a 70%, transparent 100%);
}
/* Dashboard / front-seat backs rising from the bottom. */
.wp-vig-taxi-dash {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 42%;
  background: linear-gradient(#241a13 0%, #160f0a 100%);
  border-top: 2px solid rgba(232, 181, 74, 0.25);
  box-shadow: 0 -18px 40px rgba(0, 0, 0, 0.5) inset;
}
/* The diagonal seatbelt strap across the player's POV. */
.wp-vig-taxi-belt {
  position: absolute;
  top: -6%;
  right: 6%;
  width: 13px;
  height: 78%;
  background: linear-gradient(180deg, #3a2f25, #5a4a38);
  transform: rotate(15deg);
  transform-origin: top center;
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35), 2px 0 6px rgba(0, 0, 0, 0.3);
  opacity: 0.85;
}

/* The driver: a 2D billboard "paper person" seen from behind/side. */
.wp-vig-taxi-driver {
  position: absolute;
  left: 16%;
  bottom: 30%;
  width: 38%;
  max-width: 320px;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.5));
}
.wp-vig-taxi-driver svg { width: 100%; height: 100%; overflow: visible; }
/* idle sway so the paper person feels alive, never paper-thin. */
.wp-vig-taxi-driver--sway { animation: wp-vig-sway 5.5s ease-in-out infinite; }
@keyframes wp-vig-sway {
  0%, 100% { transform: rotate(-0.6deg) translateY(0); }
  50% { transform: rotate(0.6deg) translateY(-2px); }
}

/* The meter HUD (fare + destination) pinned top-right. */
.wp-vig-taxi-meter {
  position: absolute;
  top: max(14px, env(safe-area-inset-top, 0px));
  right: max(14px, env(safe-area-inset-right, 0px));
  z-index: 5;
  min-width: 150px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(12, 9, 7, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  text-align: right;
}
.wp-vig-taxi-meter__label {
  font: 600 11px/1.3 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(247, 241, 230, 0.6);
}
.wp-vig-taxi-meter__fare {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 3px;
  font: 700 21px/1 "DM Mono", ui-monospace, "SF Mono", monospace;
  color: var(--vig-accent);
  font-variant-numeric: tabular-nums;
}
.wp-vig-taxi-meter__fare canvas { width: 22px; height: 22px; }
.wp-vig-taxi-meter__dest {
  margin-top: 4px;
  font: 500 13px/1.25 ui-sans-serif, system-ui, sans-serif;
  color: #f0e6d4;
}

/* The dialogue tray: the NPC conversation mounts into this lower band so it
   reads as "you, talking to the driver" rather than a centered modal. */
.wp-vig-taxi-tray {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  height: 46%;
  min-height: 280px;
}

/* The destination picker (the purposeful beat: "where to?"). */
.wp-vig-taxi-dests {
  position: absolute;
  left: 50%;
  bottom: calc(46% + 14px);
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  max-width: min(560px, 92vw);
  padding: 0 12px;
}
.wp-vig-taxi-dest {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 1.5px solid rgba(232, 181, 74, 0.5);
  border-radius: 22px;
  background: rgba(20, 15, 10, 0.78);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  color: #f7f1e6;
  font: 600 15px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.16s ease, border-color 0.16s ease;
}
.wp-vig-taxi-dest:hover {
  background: rgba(232, 181, 74, 0.16);
  border-color: var(--vig-accent);
}
.wp-vig-taxi-dest:active { transform: translateY(1px) scale(0.98); }
.wp-vig-taxi-dest__fare {
  font: 600 13px/1 "DM Mono", ui-monospace, monospace;
  color: var(--vig-accent);
  font-variant-numeric: tabular-nums;
}

/* Arrival card — the payoff: "we've arrived", fare paid, reward. */
.wp-vig-taxi-arrival {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: radial-gradient(120% 90% at 50% 30%, rgba(40, 30, 18, 0.92), rgba(8, 6, 4, 0.96));
  text-align: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}
.wp-vig-taxi-arrival--in { opacity: 1; }
.wp-vig-taxi-arrival__landmark { font: 800 26px/1.2 ui-sans-serif, system-ui, sans-serif; }
.wp-vig-taxi-arrival__sub { font: 500 15px/1.4 ui-sans-serif, system-ui, sans-serif; color: rgba(247, 241, 230, 0.78); max-width: 30ch; }
.wp-vig-taxi-arrival__fare {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 9px 16px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.4);
  font: 700 18px/1 "DM Mono", ui-monospace, monospace;
  color: var(--vig-accent);
}
.wp-vig-taxi-arrival__fare canvas { width: 26px; height: 26px; }
/* The fare-paid coin pop. */
.wp-vig-taxi-arrival__fare--paid canvas { animation: wp-vig-coin-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1); }
@keyframes wp-vig-coin-pop {
  0% { transform: translateY(0) scale(1); }
  40% { transform: translateY(-10px) scale(1.25); }
  100% { transform: translateY(0) scale(1); }
}
.wp-vig-taxi-arrival__btn {
  margin-top: 4px;
  min-height: 48px;
  padding: 0 28px;
  border: none;
  border-radius: 24px;
  background: var(--vig-accent);
  color: #1a1206;
  font: 700 16px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(232, 181, 74, 0.35);
  transition: transform 0.12s ease;
}
.wp-vig-taxi-arrival__btn:active { transform: scale(0.97); }

/* ===================== reduced motion ===================== */
@media (prefers-reduced-motion: reduce) {
  .wp-vig-root { transition: opacity 0.2s ease; transform: none; }
  .wp-vig-root--in, .wp-vig-root--out { transform: none; }
  .wp-vig-taxi-parallax--far,
  .wp-vig-taxi-parallax--near,
  .wp-vig-taxi-driver--sway { animation: none; }
  .wp-vig-taxi-arrival__fare--paid canvas { animation: none; }
  .wp-vig-taxi-arrival { transition: opacity 0.15s ease; }
}
`
