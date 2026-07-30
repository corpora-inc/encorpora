/**
 * The HUD, in DOM.
 *
 * The prompt is the single most-read thing in the game, so it is not a texture
 * and not a billboard: it is text, at a fixed position, at whatever the
 * device's native crispness is. It sits just above the horizon line so the eye
 * travel between "what am I being asked" and "which lane says what" is short.
 * Splitting those two across the screen is the difference between a game and an
 * eye test.
 *
 * The register is instrument panel: hairlines, brackets, tabular figures, hard
 * corners, uppercase. No cards, no gradients, no rounded boxes, nothing that
 * reads as a worksheet or a settings app.
 */

import { hudVars } from "./chrome.ts";
import {
  PLAIN_STOPS,
  REVIVE_STOPS,
  VOLT_BED,
  VOLT_BED_A,
  gradientStops,
  laneFaceStops,
} from "./contrast.ts";
import type { Insets } from "../../../../packs/shared/game-chrome/index.ts";

/**
 * The safe-area insets, as CSS values.
 *
 * `viewport-fit=cover` puts this document under the cutout and the home
 * indicator on purpose — the causeway and the ocean should reach the physical
 * edge of the glass. The HUD should not: a voltage bar under the home indicator
 * is a voltage bar with a white pill through it, and a score under the cutout is
 * a score nobody can read.
 *
 * **These are custom properties and not `env()`, and that is the whole point.**
 * `env(safe-area-inset-*)` belongs to the top-level browsing context. A pack runs
 * in an iframe sandboxed `allow-scripts` with no `allow-same-origin`, so all four
 * resolve to **0** inside it — on every device, in every orientation, for ever.
 * This stylesheet used to read them directly, so on the founder's phone the score
 * painted eighteen pixels under the host's exit chevron and the voltage bar
 * painted inside Android's gesture strip. The host measures the real insets and
 * posts them; `chrome.ts` turns them into these properties and `layoutHud` writes
 * them on. Nothing here may reach for `env()` again — `chrome.test.ts` fails the
 * build if it does.
 */
const SA_T = "var(--vt-sa-t, 0px)";
const SA_R = "var(--vt-sa-r, 0px)";
const SA_B = "var(--vt-sa-b, 0px)";
const SA_L = "var(--vt-sa-l, 0px)";

/**
 * The stylesheet, exported so `chrome.test.ts` can hold it to three rules that
 * cannot be checked any other way: it contains no `env(safe-area-inset-*)` — the
 * value that is zero inside a pack and shipped the founder's three collisions —
 * every positional declaration on the five in-run HUD boxes is a `var()` filled
 * in by `chrome.ts`, so the sheet has no geometry of its own to drift, and every
 * `color` on something a child reads is a `var()` filled in by `contrast.ts`, so
 * it has no *ink* of its own either. A fixed ink is how the recharge gate came
 * to be near-black numerals on a near-black panel in THE BLEACH; see
 * `contrast.ts` for the three separate instances of that one mistake.
 */
export const HUD_CSS = `
.vt-root { position:absolute; inset:0; pointer-events:none; overflow:hidden;
  font-family:"Archivo Black","Helvetica Neue","Arial Black","Segoe UI",system-ui,sans-serif;
  font-weight:900; -webkit-font-smoothing:antialiased; text-transform:uppercase;
  color:var(--vt-ink-sky,#eaf6ff); user-select:none; -webkit-user-select:none; }
/* Each family of surfaces takes the ink derived for the thing it lands on. The
   sky and the deck are different backdrops and used to share one colour, which
   is why the voltage bar was #12121a on a #0b0b0d deck in THE BLEACH. */
.vt-prompt, .vt-tl, .vt-tr, .vt-banner { color:var(--vt-ink-sky,#eaf6ff); }
.vt-volt, .vt-tools, .vt-perf { color:var(--vt-ink-deck,#eaf6ff); }
.vt-veil { color:var(--vt-ink-veil,#eaf6ff); }
.vt-root * { box-sizing:border-box; }
.vt-num { font-variant-numeric:tabular-nums; letter-spacing:0.01em; }

/* ---- prompt ---- */
.vt-prompt { position:absolute; left:50%; top:var(--vt-prompt-y,15%); transform:translate(-50%,0);
  display:flex; align-items:center; gap:clamp(8px,2.2vw,18px); white-space:nowrap; }
.vt-prompt-bar { width:clamp(10px,3vw,26px); height:clamp(3px,0.7vw,5px); background:currentColor;
  opacity:0.55; }
/* Paint-order stroke, so the ink's backdrop is the stroke and not the sky.
   Halfway through a crossing into THE BLEACH the sky is a mid grey, and against
   a mid grey NO flat ink clears 4.5:1 — black gets to 4.46 and white less. The
   glyph has to bring its own ground. Same move .vt-banner already makes. */
.vt-prompt-text { font-size:clamp(30px,7.4vw,72px); line-height:0.95; letter-spacing:0.005em;
  paint-order:stroke fill; -webkit-text-stroke:clamp(4px,0.9vw,7px) var(--vt-halo-sky,#04060f);
  text-shadow:0 0 22px rgba(0,0,0,0.85), 0 0 60px currentColor;
  transform-origin:50% 50%; }
.vt-prompt.vt-punch .vt-prompt-text { animation:vt-punch 0.34s cubic-bezier(.16,1.4,.4,1); }
@keyframes vt-punch { 0%{transform:scale(1.55);opacity:0.25;} 45%{transform:scale(0.94);opacity:1;} 100%{transform:scale(1);} }

/* ---- corners ---- */
/* The host paints an exit control in the top-LEFT 44px corner and a
   how-to-play control in the top-RIGHT one, over this pack. The score used
   to sit under the first and the surge meter under the second. They drop
   clear of both — the readouts move, the world behind them does not.
   Every offset comes from hudBoxes in chrome.ts. There is deliberately no
   arithmetic here to disagree with it. */
.vt-tl { position:absolute; left:var(--vt-tl-x,10px); top:var(--vt-tl-y,63px); }
.vt-tr { position:absolute; right:var(--vt-tr-x,10px); top:var(--vt-tr-y,63px); text-align:right; }
/* Quiet, but never quiet enough to stop being readable. These carried an
   opacity, and an opacity composites the ink into the sky — halfway through the
   crossing from THE ABYSS to THE BLEACH the sky is a mid grey where no ink has
   contrast to spare, so every value below 1 was under the bar. contrast.ts
   softens and then corrects back, so the number does not have to be a
   compromise between the darkest world and the greyest one. */
.vt-label { font-size:clamp(8px,1.5vw,11px); letter-spacing:0.28em; color:var(--vt-ink-sky-dim,#eaf6ff);
  paint-order:stroke fill; -webkit-text-stroke:2px var(--vt-halo-sky,#04060f); }
/* Tracking adds a trailing space after the last letter, which right-aligned
   text pushes off a narrow screen. Pull it back. */
.vt-tr .vt-label { margin-right:-0.28em; }
.vt-tr .vt-surge { margin-right:-0.02em; }
.vt-score { font-size:clamp(24px,5.4vw,48px); line-height:1;
  paint-order:stroke fill; -webkit-text-stroke:clamp(3px,0.7vw,5px) var(--vt-halo-sky,#04060f); }
.vt-dist { font-size:clamp(12px,2.4vw,19px); color:var(--vt-ink-sky-dim,#eaf6ff); line-height:1.3;
  paint-order:stroke fill; -webkit-text-stroke:2px var(--vt-halo-sky,#04060f); }

.vt-surge { display:flex; align-items:baseline; justify-content:flex-end; gap:2px; }
.vt-surge-x { font-size:clamp(14px,2.6vw,22px); color:var(--vt-ink-sky-dim,#eaf6ff);
  paint-order:stroke fill; -webkit-text-stroke:2px var(--vt-halo-sky,#04060f); }
.vt-surge-n { font-size:clamp(28px,6.4vw,56px); line-height:1;
  paint-order:stroke fill; -webkit-text-stroke:clamp(3px,0.7vw,5px) var(--vt-halo-sky,#04060f);
  text-shadow:0 0 26px currentColor; }
.vt-surge.vt-bump .vt-surge-n { animation:vt-bump 0.42s cubic-bezier(.16,1.5,.4,1); }
@keyframes vt-bump { 0%{transform:scale(1.9) rotate(-5deg);} 60%{transform:scale(0.92);} 100%{transform:scale(1);} }
.vt-chain { display:flex; gap:3px; justify-content:flex-end; margin-top:5px; }
.vt-pip { width:clamp(7px,1.5vw,12px); height:clamp(3px,0.6vw,5px); background:currentColor; opacity:0.16; }
.vt-pip.on { opacity:1; box-shadow:0 0 8px currentColor; }
/* A committed read — already in the right lane before the gate came at you —
   is worth two pips, and the meter says so. */
.vt-chain.vt-clean .vt-pip { animation:vt-clean 0.5s ease-out; }
@keyframes vt-clean { 0%{transform:scaleY(3.4); opacity:1;} 100%{transform:scaleY(1);} }

/* ---- voltage ----
   The bottom offset clears Android's gesture strip as well as the reported inset: the
   strip eats the pixels and reports an inset of zero. See GESTURE_STRIP. */
.vt-volt { position:absolute; left:var(--vt-volt-l,10px); right:var(--vt-volt-r,10px);
  bottom:var(--vt-volt-b,36px); height:var(--vt-volt-h,9px);
  border:2px solid rgba(255,255,255,0.30); display:flex; align-items:stretch; padding:2px;
  /* A bed, so the fill has a backdrop that is known rather than whatever stretch
     of deck or ocean happens to be under the bar. THE BLEACH's deck is #0b0b0d
     and its ocean is #c9c3b4 — no single fill colour clears 4.5:1 against both,
     and a full-width bar crosses both. */
  background:rgba(${(VOLT_BED >> 16) & 255},${(VOLT_BED >> 8) & 255},${VOLT_BED & 255},${VOLT_BED_A}); }
.vt-volt-fill { height:100%; width:100%; transform-origin:0 50%; transition:none;
  box-shadow:0 0 18px currentColor; background:var(--vt-volt-fill,#eaf6ff); }
.vt-volt-ticks { position:absolute; inset:2px; display:flex; }
.vt-volt-ticks i { flex:1; border-right:2px solid rgba(0,0,0,0.55); }
.vt-volt-ticks i:last-child { border-right:0; }
.vt-volt.vt-crit { animation:vt-crit 0.85s steps(2,end) infinite; }
@keyframes vt-crit { 0%,60%{opacity:1;} 61%,100%{opacity:0.45;} }
/* Above the bar, so the bar's own bed does not reach it. It gets its own —
   in landscape this label is out over the OCEAN rather than the deck (the deck
   is only DECK_HALF metres wide), and in THE BLEACH the ocean is bone while the
   deck is near-black. One ink cannot clear both; a bed means it does not have
   to. */
.vt-volt-label { position:absolute; left:0; bottom:calc(100% + 5px); font-size:clamp(8px,1.5vw,11px);
  letter-spacing:0.28em; color:var(--vt-ink-deck-dim,#eaf6ff); padding:1px 5px;
  background:rgba(${(VOLT_BED >> 16) & 255},${(VOLT_BED >> 8) & 255},${VOLT_BED & 255},${VOLT_BED_A}); }

/* ---- biome banner ---- */
.vt-banner { position:absolute; left:0; right:0; top:38%; text-align:center; opacity:0;
  font-size:clamp(20px,5.6vw,54px); letter-spacing:0.2em;
  /* Paint-order stroke, not a glow: in the inverted biome the banner is dark
     ink on bone and a same-colour glow just smears it. */
  paint-order:stroke fill; -webkit-text-stroke:6px var(--vt-halo-sky,#04060f);
  text-shadow:0 0 40px currentColor; }
.vt-banner.vt-show { animation:vt-banner 2.6s ease-out forwards; }
@keyframes vt-banner {
  0%{opacity:0; transform:scale(1.3) translateY(10px); letter-spacing:0.5em;}
  14%{opacity:1; transform:scale(1); letter-spacing:0.2em;}
  70%{opacity:1;} 100%{opacity:0; letter-spacing:0.34em;}
}

/* ---- overlays ---- */
.vt-veil { position:absolute; inset:0; display:none; flex-direction:column; align-items:center;
  justify-content:center; pointer-events:auto;
  padding:calc(${SA_T} + clamp(14px,4vw,40px)) calc(${SA_R} + clamp(14px,4vw,40px))
          calc(${SA_B} + clamp(14px,4vw,40px)) calc(${SA_L} + clamp(14px,4vw,40px));
  background:radial-gradient(ellipse at 50% 45%, ${gradientStops(PLAIN_STOPS)}); }
.vt-veil.vt-on { display:flex; }
.vt-title { font-size:clamp(38px,12vw,110px); line-height:0.86; letter-spacing:0.04em;
  text-shadow:0 0 60px currentColor; }
.vt-sub { font-size:clamp(11px,2.3vw,16px); letter-spacing:0.3em; color:var(--vt-ink-veil-dim,#eaf6ff); margin-top:14px; text-align:center; }
.vt-hint { font-size:clamp(10px,2vw,14px); letter-spacing:0.22em; color:var(--vt-ink-veil-dim,#eaf6ff); margin-top:26px; text-align:center; line-height:2; }
/* background:currentColor only works while color is still the inherited ink —
   setting color on the button itself paints it black on black. The label carries
   its own colour instead, derived from the ink the fill is painted in. It was a
   fixed #04060f, which is a coin toss the moment the ink stops being pale. */
.vt-btn { pointer-events:auto; margin-top:26px; padding:clamp(12px,2.6vw,20px) clamp(26px,7vw,64px);
  font:inherit; font-size:clamp(15px,3.4vw,26px); letter-spacing:0.18em; text-transform:uppercase;
  background:currentColor; border:0; cursor:pointer; box-shadow:0 0 40px currentColor; }
.vt-btn span { color:var(--vt-on-veil-ink,#04060f); }
.vt-btn:active { transform:translateY(2px); }
.vt-btn:focus-visible { outline:3px solid #fff; outline-offset:3px; }

/* ---- recharge gate ----
   This screen is where a child decides whether to keep playing, so it is the
   last place in the game that should look like a dialog box. It used to drop to
   a flat near-black panel and the run visibly died behind it. Now the causeway
   keeps rushing past in full colour through a thin scrim, the whole rig is lit
   in the current biome's accent, and the three answers are built out of the same
   posts-and-lintel the gates out on the track are. It is a gate, indoors.

   The scrim's stops live in contrast.ts, not here: the clear window where the
   causeway shows through is the top two fifths, and below it the scrim comes up
   to a floor because that is where the question and the three answers are. A
   numeral cannot be legible against a band that runs from bone to black behind
   it, and that band is exactly what shipped. */
.vt-veil[data-v="revive"] {
  background:
    linear-gradient(180deg, ${gradientStops(REVIVE_STOPS)}),
    radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 40%, rgba(2,5,14,0.55) 100%);
  justify-content:flex-end; padding-bottom:calc(${SA_B} + clamp(20px,5vh,54px)); }
/* A charge front sweeping up the screen. Slow, wide, low-contrast: energy, not
   a strobe — 4.2s per pass is far under any flash threshold. */
.vt-veil[data-v="revive"]::before { content:""; position:absolute; left:0; right:0; height:36%;
  background:linear-gradient(0deg, transparent, var(--vt-accent, #6cf) 55%, transparent);
  opacity:0.13; animation:vt-charge 4.2s linear infinite; pointer-events:none; }
@keyframes vt-charge { 0%{transform:translateY(120%);} 100%{transform:translateY(-160%);} }

.vt-charge { display:flex; align-items:center; gap:clamp(10px,2.4vw,20px); margin-bottom:clamp(6px,1.4vh,14px); }
/* The accent, corrected only as far as it takes to clear 4.5:1 on the scrim —
   so it still reads as the biome you died in. --vt-accent is the raw world
   colour and belongs to glows and rules, never to a word. */
.vt-charge-label { font-size:clamp(11px,2.3vw,16px); letter-spacing:0.34em; opacity:1;
  color:var(--vt-accent-veil, currentColor); text-shadow:0 0 22px var(--vt-accent, currentColor); }
.vt-revive-prompt { font-size:clamp(36px,9.6vw,88px); line-height:1; margin:2px 0 clamp(14px,2.4vh,28px);
  paint-order:stroke fill; -webkit-text-stroke:8px rgba(2,5,14,0.6);
  text-shadow:0 0 46px var(--vt-accent, currentColor); }

.vt-lanes { display:flex; gap:clamp(10px,2.6vw,22px); width:100%; max-width:820px; }
.vt-lane { pointer-events:auto; position:relative; flex:1; min-width:0; aspect-ratio:3/2.5;
  border:0; border-left:clamp(4px,0.9vw,7px) solid var(--vt-accent, #6cf);
  border-right:clamp(4px,0.9vw,7px) solid var(--vt-accent, #6cf);
  background:linear-gradient(180deg, ${laneFaceStops()});
  color:inherit; font:inherit; cursor:pointer; overflow:hidden;
  font-size:clamp(30px,8.6vw,66px); display:flex; align-items:center; justify-content:center;
  font-variant-numeric:tabular-nums; letter-spacing:0.01em;
  box-shadow:0 0 32px -6px var(--vt-accent, #6cf), inset 0 0 40px -14px var(--vt-accent, #6cf); }
/* The lintel: the same overhead bar the gates on the causeway wear. */
.vt-lane::before { content:""; position:absolute; left:calc(-1 * clamp(4px,0.9vw,7px));
  right:calc(-1 * clamp(4px,0.9vw,7px)); top:0; height:clamp(7px,1.5vw,11px);
  background:var(--vt-accent, #6cf); box-shadow:0 0 24px var(--vt-accent, #6cf); }
.vt-lane::after { content:""; position:absolute; left:0; right:0; bottom:0; height:2px;
  background:var(--vt-accent, #6cf); opacity:0.45; }
.vt-lane span { position:relative; color:var(--vt-ink-lane,#eaf6ff);
  text-shadow:0 0 30px rgba(0,0,0,0.9), 0 3px 0 rgba(0,0,0,0.55); }
.vt-lane:active { transform:translateY(3px); }
.vt-lane:focus-visible { outline:3px solid #fff; outline-offset:4px; }
.vt-lane.vt-right { background:var(--vt-accent, #6cf); box-shadow:0 0 70px var(--vt-accent, #6cf); }
.vt-lane.vt-right span { color:var(--vt-on-accent,#04060f); text-shadow:none; }
.vt-lane.vt-wrong { opacity:0.22; }
.vt-ring { width:clamp(52px,11vw,84px); height:clamp(52px,11vw,84px); }
.vt-ring circle { fill:none; stroke-width:9; }
.vt-ring .bg { stroke:rgba(255,255,255,0.16); }
.vt-ring .fg { stroke:currentColor; stroke-linecap:butt; transform:rotate(-90deg); transform-origin:50% 50%;
  filter:drop-shadow(0 0 10px currentColor); }

/* ---- stats / summary ---- */
.vt-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:clamp(8px,2vw,20px) clamp(20px,6vw,64px);
  margin-top:clamp(16px,3vw,30px); }
.vt-stat { text-align:left; }
.vt-stat b { display:block; font-size:clamp(20px,5vw,40px); line-height:1; font-variant-numeric:tabular-nums; }
.vt-stat i { display:block; font-style:normal; font-size:clamp(8px,1.6vw,11px); letter-spacing:0.26em; color:var(--vt-ink-veil-dim,#eaf6ff); margin-top:5px; }

/* ---- settings ----
   Stacked on the voltage readout rather than measured from the bottom edge, so
   the gap between the two cannot be closed by a change to either. */
.vt-tools { position:absolute; right:var(--vt-tools-r,10px); bottom:var(--vt-tools-b,66px);
  display:flex; gap:6px; pointer-events:auto; }
.vt-tool { width:var(--vt-tool-s,30px); height:var(--vt-tool-s,30px); border:2px solid rgba(255,255,255,0.28);
  background:rgba(2,5,14,0.55); color:inherit; font:inherit; font-size:clamp(11px,2.2vw,14px);
  cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
.vt-tool[aria-pressed="true"] { background:currentColor; }
.vt-tool[aria-pressed="true"] span { color:var(--vt-on-deck-ink,#04060f); }
.vt-tool:focus-visible { outline:3px solid #fff; outline-offset:2px; }
.vt-perf { position:absolute; left:var(--vt-perf-l,10px); bottom:var(--vt-perf-b,110px);
  padding:2px 5px; background:rgba(${(VOLT_BED >> 16) & 255},${(VOLT_BED >> 8) & 255},${VOLT_BED & 255},${VOLT_BED_A});
  font-size:11px; letter-spacing:0.1em; opacity:0.6; white-space:pre; display:none;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-weight:400; text-transform:none; }
.vt-perf.vt-on { display:block; }

@keyframes vt-banner-rm { 0%{opacity:0;} 12%{opacity:1;} 72%{opacity:1;} 100%{opacity:0;} }
/* Reduced motion, whether the OS asked or the in-game toggle did. Information
   is preserved — the punch becomes a hold, the crit blink becomes an outline. */
@media (prefers-reduced-motion: reduce) {
  .vt-prompt.vt-punch .vt-prompt-text, .vt-surge.vt-bump .vt-surge-n { animation:none; }
  .vt-banner.vt-show { animation:vt-banner-rm 2.6s ease-out forwards; }
  .vt-volt.vt-crit { animation:none; outline:3px solid currentColor; outline-offset:3px; }
  .vt-chain.vt-clean .vt-pip { animation:none; }
  /* The sweep becomes a still wash: same "this rig is live" reading, no travel. */
  .vt-veil[data-v="revive"]::before { animation:none; transform:translateY(-40%); opacity:0.1; }
}
/* An overlay owns the screen. The in-run prompt behind a revive gate is pure
   collision — two different questions on top of each other. */
.vt-root.vt-veiled .vt-prompt, .vt-root.vt-veiled .vt-tl, .vt-root.vt-veiled .vt-tr,
.vt-root.vt-veiled .vt-volt, .vt-root.vt-veiled .vt-tools, .vt-root.vt-veiled .vt-banner {
  opacity:0; transition:opacity 0.18s ease; }
.vt-root.vt-rm .vt-prompt.vt-punch .vt-prompt-text,
.vt-root.vt-rm .vt-surge.vt-bump .vt-surge-n { animation:none; }
.vt-root.vt-rm .vt-banner.vt-show { animation:vt-banner-rm 2.6s ease-out forwards; }
.vt-root.vt-rm .vt-volt.vt-crit { animation:none; outline:3px solid currentColor; outline-offset:3px; }
.vt-root.vt-rm .vt-chain.vt-clean .vt-pip { animation:none; }
.vt-root.vt-rm .vt-veil[data-v="revive"]::before { animation:none; transform:translateY(-40%); opacity:0.1; }
`;

export type HudRefs = {
  root: HTMLDivElement;
  /**
   * The stylesheet, which is a *sibling* of `root` rather than a child.
   *
   * Handed back so `unmount()` can remove it. It used to be left behind, and a
   * host that swaps packs would accumulate one dead `<style>` per mount — each
   * still claiming every `.vt-root` rule, so the leftovers styled the next mount
   * too.
   */
  style: HTMLStyleElement;
  prompt: HTMLDivElement;
  promptText: HTMLDivElement;
  score: HTMLDivElement;
  dist: HTMLDivElement;
  surge: HTMLDivElement;
  surgeN: HTMLDivElement;
  chain: HTMLDivElement;
  volt: HTMLDivElement;
  voltFill: HTMLDivElement;
  banner: HTMLDivElement;
  start: HTMLDivElement;
  revive: HTMLDivElement;
  revivePrompt: HTMLDivElement;
  reviveLanes: HTMLButtonElement[];
  reviveRing: SVGCircleElement;
  reviveCount: HTMLDivElement;
  over: HTMLDivElement;
  overStats: HTMLDivElement;
  startBtn: HTMLButtonElement;
  againBtn: HTMLButtonElement;
  soundBtn: HTMLButtonElement;
  motionBtn: HTMLButtonElement;
  perf: HTMLDivElement;
};

const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;

export function buildHud(host: HTMLElement): HudRefs {
  const style = document.createElement("style");
  style.textContent = HUD_CSS;
  host.appendChild(style);

  const root = document.createElement("div");
  root.className = "vt-root";
  root.innerHTML = `
    <div class="vt-prompt"><div class="vt-prompt-bar"></div><div class="vt-prompt-text vt-num">—</div><div class="vt-prompt-bar"></div></div>

    <div class="vt-tl">
      <div class="vt-label">Score</div>
      <div class="vt-score vt-num">0</div>
      <div class="vt-dist vt-num">0 m</div>
    </div>

    <div class="vt-tr">
      <div class="vt-label">Surge</div>
      <div class="vt-surge"><div class="vt-surge-x">&times;</div><div class="vt-surge-n vt-num">1</div></div>
      <div class="vt-chain"></div>
    </div>

    <div class="vt-volt">
      <div class="vt-volt-label">Voltage</div>
      <div class="vt-volt-fill"></div>
      <div class="vt-volt-ticks"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div>

    <div class="vt-banner"></div>

    <div class="vt-tools">
      <button class="vt-tool" data-a="sound" aria-pressed="true" title="Sound"><span>&#9835;</span></button>
      <button class="vt-tool" data-a="motion" aria-pressed="false" title="Reduce motion"><span>&#8767;</span></button>
    </div>
    <div class="vt-perf"></div>

    <div class="vt-veil" data-v="start">
      <div class="vt-title">VOLTA</div>
      <div class="vt-sub">Pick the lane that is right</div>
      <button class="vt-btn" data-a="start"><span>Run</span></button>
      <div class="vt-hint">Swipe or tap left / right to switch lane<br>Swipe up to jump &middot; swipe down to slide<br>Keyboard: arrows or W A S D</div>
    </div>

    <div class="vt-veil" data-v="revive">
      <div class="vt-charge">
        <svg class="vt-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="bg" cx="50" cy="50" r="${RING_R}"></circle>
          <circle class="fg" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="0"></circle>
        </svg>
        <div class="vt-charge-label">Recharge</div>
      </div>
      <div class="vt-revive-prompt vt-num">—</div>
      <div class="vt-lanes">
        <button class="vt-lane" data-l="0"><span class="vt-num"></span></button>
        <button class="vt-lane" data-l="1"><span class="vt-num"></span></button>
        <button class="vt-lane" data-l="2"><span class="vt-num"></span></button>
      </div>
      <div class="vt-hint" data-v="revive-count"></div>
    </div>

    <div class="vt-veil" data-v="over">
      <div class="vt-title">RUN OVER</div>
      <div class="vt-stats"></div>
      <button class="vt-btn" data-a="again"><span>Run again</span></button>
    </div>
  `;
  host.appendChild(root);

  const q = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const chain = q<HTMLDivElement>(".vt-chain");
  // Three pips: three clean gates buys the next multiplier. Short enough that a
  // child sees the reward loop close inside the first twenty seconds.
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement("div");
    pip.className = "vt-pip";
    chain.appendChild(pip);
  }

  return {
    root,
    style,
    prompt: q(".vt-prompt"),
    promptText: q(".vt-prompt-text"),
    score: q(".vt-score"),
    dist: q(".vt-dist"),
    surge: q(".vt-surge"),
    surgeN: q(".vt-surge-n"),
    chain,
    volt: q(".vt-volt"),
    voltFill: q(".vt-volt-fill"),
    banner: q(".vt-banner"),
    start: q('[data-v="start"]'),
    revive: q('[data-v="revive"]'),
    revivePrompt: q(".vt-revive-prompt"),
    reviveLanes: Array.from(root.querySelectorAll<HTMLButtonElement>(".vt-lane")),
    reviveRing: q<SVGCircleElement>(".vt-ring .fg"),
    reviveCount: q('[data-v="revive-count"]'),
    over: q('[data-v="over"]'),
    overStats: q(".vt-stats"),
    startBtn: q('[data-a="start"]'),
    againBtn: q('[data-a="again"]'),
    soundBtn: q('[data-a="sound"]'),
    motionBtn: q('[data-a="motion"]'),
    perf: q(".vt-perf"),
  };
}

/**
 * Put the HUD where the host's measured insets say it goes.
 *
 * Called on mount, on every resize and on every inset change — rotation swaps
 * top and bottom with left and right, and iPadOS moves them again when the pack
 * is resized in Split View, so a HUD laid out once at mount is correct until the
 * first rotation and wrong after it.
 *
 * There is no path by which the stylesheet can place these boxes itself: it
 * declares `left: var(--vt-tl-x)` and friends, and `chrome.ts` owns every one of
 * those values.
 */
export function layoutHud(refs: HudRefs, w: number, h: number, insets: Insets): void {
  const vars = hudVars(w, h, insets);
  for (const [name, value] of Object.entries(vars)) refs.root.style.setProperty(name, value);
}

export const ringCircumference = RING_C;

/** 12345 -> "12 345". Thin spaces, not commas: locale-neutral and legible. */
export function groupDigits(n: number): string {
  const s = Math.round(n).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += " ";
    out += s[i];
  }
  return out;
}
