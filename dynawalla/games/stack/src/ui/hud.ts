/**
 * The chrome. DOM rather than textures, because a prompt a child has to read
 * under time pressure should be real text at device resolution.
 *
 * Deliberate omissions: no tutorial, no toast, no "Incorrect", no red X. When a
 * value is wrong the equation simply COMPLETES ITSELF in the accent colour for
 * three quarters of a second — the truth, stated once, with no adjective
 * attached to the child. The punishment is already in the building: the tower
 * got thinner and you can see it.
 *
 * Total translatable surface: four words.
 *
 * Every offset that touches an edge comes from `place.ts`, which holds the
 * safe-area arithmetic and the host's two reserved corners in one place and
 * hands this stylesheet the `calc(env(...))` strings — so `place.test.ts` is
 * asserting against the geometry that actually ships, not a copy of it.
 */

import type { Insets } from "../../../../packs/shared/game-chrome/index.ts";
import {
  BEST_NUM,
  CSS_CLEAR_LEFT,
  CSS_CLEAR_RIGHT,
  CSS_EDGE_LEFT,
  CSS_HINT_BOTTOM,
  CSS_PROMPT_TOP,
  CSS_ROW_TOP,
  CSS_TOOL_BOTTOM,
  CSS_TOOL_RIGHT,
  FLOOR_GAP,
  FLOOR_NUM,
  LABEL,
  PROMPT,
  TOOL_SIZE,
  applySafeVars,
  cssSafe,
  cssScale,
} from "./place.ts";
import { BLANK } from "../blank.ts";

/**
 * The stylesheet, exported so `safearea.test.ts` can parse the string that
 * actually ships rather than a copy of what it was meant to say.
 */
export const CSS = `
.mn { position:absolute; inset:0; pointer-events:none; overflow:hidden;
  font-family: ui-sans-serif,-apple-system,"SF Pro Display","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  color:var(--fg); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  --fg:#fff; --bg:#07080f; --ac:#ff6a1f; --dim:rgba(255,255,255,.42); --shadow:0 2px 24px rgba(0,0,0,.55);
  contain:layout style; user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color:transparent; }
.mn * { box-sizing:border-box; margin:0; }

.mn-floor { position:absolute; top:${CSS_ROW_TOP}; left:${CSS_CLEAR_LEFT}; display:flex; align-items:baseline; gap:${FLOOR_GAP}px;
  transform-origin:left center; will-change:transform; }
.mn-floor b { font-size:${cssScale(FLOOR_NUM)}; font-weight:800; letter-spacing:-.045em; line-height:.85;
  font-variant-numeric:tabular-nums; text-shadow:var(--shadow); }
.mn-floor i { font-style:normal; font-size:${cssScale(LABEL)}; font-weight:800; letter-spacing:.22em;
  color:var(--dim); text-transform:uppercase; }

.mn-best { position:absolute; top:${CSS_ROW_TOP}; right:${CSS_CLEAR_RIGHT}; text-align:right;
  font-size:${cssScale(LABEL)}; font-weight:800; letter-spacing:.2em; color:var(--dim); text-transform:uppercase; }
.mn-best em { font-style:normal; display:block; font-size:${cssScale(BEST_NUM)}; letter-spacing:-.02em; color:var(--fg);
  font-variant-numeric:tabular-nums; opacity:.85; }

.mn-prompt { position:absolute; left:50%; top:${CSS_PROMPT_TOP}; transform:translate(-50%,-50%);
  display:flex; align-items:center; gap:0; padding:.42em .72em .5em;
  background:var(--bg); border-bottom:3px solid var(--ac);
  font-size:${cssScale(PROMPT)}; font-weight:800; letter-spacing:-.02em; white-space:nowrap;
  font-variant-numeric:tabular-nums; box-shadow:0 10px 40px rgba(0,0,0,.45);
  will-change:transform,opacity; }
.mn-prompt.reveal { border-bottom-color:var(--fg); }
.mn-prompt .fill { color:var(--ac); }
.mn-prompt .q { color:var(--ac); }

.mn-combo { position:absolute; left:50%; top:calc(${CSS_PROMPT_TOP} + 2.9em); transform:translate(-50%,0) scale(1);
  font-size:clamp(13px,3.4vmin,22px); font-weight:800; letter-spacing:.02em; color:var(--ac);
  font-variant-numeric:tabular-nums; opacity:0; will-change:transform,opacity; }

.mn-true { position:absolute; left:50%; top:47%; text-transform:uppercase; transform:translate(-50%,-50%) scale(.4);
  font-size:clamp(34px,12vmin,104px); font-weight:800; letter-spacing:-.05em; color:var(--ac);
  opacity:0; will-change:transform,opacity; text-shadow:0 0 60px color-mix(in srgb,var(--ac) 60%,transparent); }

.mn-band { position:absolute; left:0; right:0; top:57%; text-align:center; opacity:0; will-change:transform,opacity;
  padding-left:${cssSafe("left")}; padding-right:${cssSafe("right")}; box-sizing:border-box; }
.mn-band u { text-decoration:none; display:block; font-size:clamp(9px,2.4vmin,13px); font-weight:800; letter-spacing:.42em;
  color:var(--dim); text-transform:uppercase; }
.mn-band b { display:block; font-size:clamp(28px,8.5vmin,62px); font-weight:800; letter-spacing:.06em; }

.mn-hint { position:absolute; left:50%; bottom:${CSS_HINT_BOTTOM}; transform:translateX(-50%);
  font-size:clamp(10px,2.6vmin,14px); font-weight:800; letter-spacing:.3em; color:var(--dim); text-transform:uppercase;
  animation:mnpulse 1.9s ease-in-out infinite; }
@keyframes mnpulse { 0%,100%{opacity:.28} 50%{opacity:.85} }

.mn-over { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:clamp(12px,3vmin,24px); pointer-events:auto; opacity:0; visibility:hidden;
  background:radial-gradient(120% 90% at 50% 45%, transparent 18%, color-mix(in srgb,var(--bg) 99%,transparent) 62%);
  /* Four longhands, driven by a custom property, and deliberately NOT a
     \`padding:\` shorthand. A shorthand resets all four sides, so a breakpoint
     that wanted a tighter card on a short screen would silently delete the safe
     area along with the gutter — which is exactly how SIEGE lost its bottom
     inset on every landscape phone. Change --mn-card-pad; leave these alone. */
  --mn-card-pad:20px;
  padding-top:calc(${cssSafe("top")} + var(--mn-card-pad));
  padding-right:calc(${cssSafe("right")} + var(--mn-card-pad));
  padding-bottom:calc(${cssSafe("bottom")} + var(--mn-card-pad));
  padding-left:calc(${cssSafe("left")} + var(--mn-card-pad));
  transition:opacity .28s ease; }
.mn-over.on { opacity:1; visibility:visible; }
.mn-over h1 { font-size:clamp(11px,2.8vmin,15px); font-weight:800; letter-spacing:.42em; color:var(--dim); text-transform:uppercase; }
.mn-over .big { font-size:clamp(56px,20vmin,150px); font-weight:800; letter-spacing:-.06em; line-height:.82;
  font-variant-numeric:tabular-nums; }
.mn-over .sub { font-size:clamp(10px,2.5vmin,13px); font-weight:800; letter-spacing:.25em; color:var(--dim); text-transform:uppercase; }
.mn-q { font-size:clamp(20px,6vmin,40px); font-weight:800; letter-spacing:-.02em; font-variant-numeric:tabular-nums;
  padding:.3em .6em; border-bottom:3px solid var(--ac); background:var(--bg); }
.mn-choices { display:flex; flex-wrap:wrap; gap:clamp(7px,1.8vmin,12px); justify-content:center; max-width:min(560px,94vw); }
.mn-choices button, .mn-btn {
  pointer-events:auto; font:inherit; font-weight:800; letter-spacing:-.01em; font-variant-numeric:tabular-nums;
  min-width:clamp(64px,17vmin,104px); min-height:clamp(52px,13vmin,80px); padding:0 .55em;
  font-size:clamp(20px,5.6vmin,36px); color:var(--bg); background:var(--fg); border:0; border-radius:0;
  cursor:pointer; transition:transform .09s ease, background .12s ease; touch-action:manipulation; }
.mn-choices button:active, .mn-btn:active { transform:scale(.94); }
.mn-choices button.bad { background:#4a4a52; color:rgba(255,255,255,.5); }
.mn-choices button.good { background:var(--ac); }
.mn-btn { min-height:clamp(44px,11vmin,62px); font-size:clamp(11px,2.9vmin,15px); letter-spacing:.26em; text-transform:uppercase;
  background:transparent; color:var(--fg); border:2px solid color-mix(in srgb,var(--fg) 45%,transparent); }
.mn-btn.solid { background:var(--ac); color:var(--bg); border-color:var(--ac); }

.mn-tools { position:absolute; right:${CSS_TOOL_RIGHT}; bottom:${CSS_TOOL_BOTTOM}; display:flex; gap:8px; pointer-events:auto; }
.mn-tools button { pointer-events:auto; width:${TOOL_SIZE}px; height:${TOOL_SIZE}px; border:2px solid color-mix(in srgb,var(--fg) 28%,transparent);
  background:var(--bg); color:var(--fg); font:inherit; font-size:13px; font-weight:800;
  border-radius:0; cursor:pointer; letter-spacing:0; touch-action:manipulation; }
.mn-tools button[aria-pressed="false"] { opacity:.42; }

.mn-perf { position:absolute; background:rgba(0,0,0,.55); padding:6px 9px; color:#fff !important; left:${CSS_EDGE_LEFT}; bottom:${CSS_TOOL_BOTTOM}; font-size:11px; font-weight:700;
  letter-spacing:.06em; color:var(--dim); font-variant-numeric:tabular-nums; white-space:pre; line-height:1.45; display:none; }
.mn-perf.on { display:block; }

@media (prefers-reduced-motion: reduce) {
  .mn-hint { animation:none; opacity:.6; }
  .mn-over { transition:none; }
}
`;

export type HudCallbacks = {
  onRestart(): void;
  onRevive(): void;
  onChoose(v: string): void;
  onToggleAudio(on: boolean): void;
};

export class Hud {
  readonly root: HTMLDivElement;
  private floorEl: HTMLElement;
  private floorNum: HTMLElement;
  private bestNum: HTMLElement;
  private promptEl: HTMLElement;
  private comboEl: HTMLElement;
  private trueEl: HTMLElement;
  private bandEl: HTMLElement;
  private bandName: HTMLElement;
  private hintEl: HTMLElement;
  private overEl: HTMLElement;
  private overBig: HTMLElement;
  private overSub: HTMLElement;
  private overQ: HTMLElement;
  private choicesEl: HTMLElement;
  private reviveBtn: HTMLButtonElement;
  private againBtn: HTMLButtonElement;
  private audioBtn: HTMLButtonElement;
  private perfEl: HTMLElement;

  private lastPrompt = "";
  private lastReveal: string | null = null;
  private lastFloor = -1;
  private insets: Insets | null = null;
  private reduced: boolean;
  private anims: Animation[] = [];

  constructor(parent: HTMLElement, cb: HudCallbacks, reduced: boolean) {
    this.reduced = reduced;
    const style = document.createElement("style");
    style.textContent = CSS;
    parent.appendChild(style);

    const d = document.createElement("div");
    d.className = "mn";
    d.innerHTML = `
      <div class="mn-floor"><b>0</b><i data-t="floor">Floor</i></div>
      <div class="mn-best"><span data-t="best">Best</span><em>0</em></div>
      <div class="mn-prompt"></div>
      <div class="mn-combo"></div>
      <div class="mn-true"></div>
      <div class="mn-band"><u data-t="band">Stratum</u><b></b></div>
      <div class="mn-hint" data-t="tap">Tap to set the stone</div>
      <div class="mn-over">
        <h1 data-t="fell">The monument fell</h1>
        <div class="big">0</div>
        <div class="sub"><span data-t="floor">Floor</span></div>
        <div class="mn-q"></div>
        <div class="mn-choices"></div>
        <button class="mn-btn solid mn-revive" data-t="shore">Shore it up</button>
        <button class="mn-btn mn-again" data-t="again">Begin again</button>
      </div>
      <div class="mn-tools"><button class="mn-audio" aria-pressed="true" aria-label="Sound">♪</button></div>
      <div class="mn-perf"></div>`;
    parent.appendChild(d);
    this.root = d;

    // The stylesheet above cannot work the safe area out for itself: `env()`
    // resolves to zero in a cross-origin child, which is what every pack is. It
    // is written onto this root as four custom properties instead, from the
    // host's own measurement, and republished on every resize.
    applySafeVars(d);

    const q = <T extends Element>(s: string): T => d.querySelector<T>(s)!;
    this.floorEl = q(".mn-floor");
    this.floorNum = q(".mn-floor b");
    this.bestNum = q(".mn-best em");
    this.promptEl = q(".mn-prompt");
    this.comboEl = q(".mn-combo");
    this.trueEl = q(".mn-true");
    this.bandEl = q(".mn-band");
    this.bandName = q(".mn-band b");
    this.hintEl = q(".mn-hint");
    this.overEl = q(".mn-over");
    this.overBig = q(".mn-over .big");
    this.overSub = q(".mn-over .sub");
    this.overQ = q(".mn-q");
    this.choicesEl = q(".mn-choices");
    this.reviveBtn = q(".mn-revive");
    this.againBtn = q(".mn-again");
    this.audioBtn = q(".mn-audio");
    this.perfEl = q(".mn-perf");

    this.reviveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cb.onRevive();
    });
    this.againBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      cb.onRestart();
    });
    this.audioBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const on = this.audioBtn.getAttribute("aria-pressed") !== "true";
      this.audioBtn.setAttribute("aria-pressed", String(on));
      cb.onToggleAudio(on);
    });
    this.choicesEl.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      e.stopPropagation();
      cb.onChoose(b.dataset.v ?? "");
    });
    // A run that ended badly must cost nothing to leave. Anywhere on the
    // backdrop begins again; the buttons keep their own jobs. Without this a
    // child who mis-taps in the first second has to find and hit a control
    // before they are allowed to try the thing they were enjoying.
    this.overEl.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if ((e.target as HTMLElement).closest("button")) return;
      if (this.choicesEl.style.display !== "none" && this.choicesEl.children.length) return;
      cb.onRestart();
    });
  }

  /**
   * Republish the safe area onto the HUD root.
   *
   * Called on every resize rather than once at mount: a rotation trades one top
   * inset for two side ones, and the host re-sends its measurement whenever the
   * app's own layout moves. Idempotent, so a `ResizeObserver` may call it
   * freely — nothing is written when the numbers have not moved.
   */
  setInsets(insets: Insets): void {
    if (applySafeVars(this.root, insets, this.insets)) {
      this.insets = { ...insets };
    }
  }

  /* ── palette ──────────────────────────────────────────────────────────── */

  /** `bright` = the sky behind the chrome is light, so the chrome inverts. */
  setPalette(bright: boolean, plate: string, accent: string): void {
    const s = this.root.style;
    s.setProperty("--fg", bright ? "#0b0c12" : "#ffffff");
    s.setProperty("--bg", plate);
    s.setProperty("--ac", accent);
    s.setProperty("--dim", bright ? "rgba(11,12,18,.6)" : "rgba(255,255,255,.5)");
    s.setProperty("--shadow", bright ? "0 2px 18px rgba(255,255,255,.65)" : "0 2px 24px rgba(0,0,0,.55)");
  }

  /* ── live readouts ────────────────────────────────────────────────────── */

  setFloor(n: number, best: number): void {
    if (n === this.lastFloor) return;
    const up = n > this.lastFloor;
    this.lastFloor = n;
    this.floorNum.textContent = String(n);
    this.bestNum.textContent = String(best);
    if (!this.reduced && up) {
      this.play(this.floorEl, [{ transform: "scale(1.16)" }, { transform: "scale(1)" }], 240);
    }
  }

  /**
   * The blank in the prompt is drawn in the accent so it is obvious at a glance;
   * on a reveal the answer replaces it in the same colour, so the eye lands on
   * exactly the thing that changed.
   *
   * The blank is whatever `src/blank.ts` says it is — `□` as the host writes it,
   * with `?` and `_` tolerated. This used to match a literal `"?"`, which meant
   * the reveal substituted nothing for every `47 + □ = 68` the host served and
   * the child saw the card back with the box still empty.
   */
  setPrompt(prompt: string, reveal: string | null): void {
    // Called every frame, so it compares its two inputs directly instead of
    // building a composite key: string concatenation sixty times a second is
    // exactly the per-frame allocation this game does not do.
    if (prompt === this.lastPrompt && reveal === this.lastReveal) return;
    const fresh = prompt !== this.lastPrompt;
    this.lastPrompt = prompt;
    this.lastReveal = reveal;
    const html = reveal
      ? escape(prompt).replace(BLANK, () => `<span class="fill">${escape(reveal)}</span>`)
      : escape(prompt).replace(BLANK, (glyph) => `<span class="q">${glyph}</span>`);
    this.promptEl.innerHTML = html;
    this.promptEl.classList.toggle("reveal", reveal !== null);
    if (!this.reduced && (fresh || reveal)) {
      this.play(
        this.promptEl,
        reveal
          ? [
              { transform: "translate(-50%,-50%) scale(1.14)" },
              { transform: "translate(-50%,-50%) scale(1)" },
            ]
          : [
              { transform: "translate(-50%,-50%) scale(.92)", opacity: 0.4 },
              { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
            ],
        reveal ? 320 : 200,
      );
    }
  }

  setCombo(n: number): void {
    if (n < 2) {
      this.comboEl.style.opacity = "0";
      return;
    }
    this.comboEl.textContent = `×${n}`;
    this.comboEl.style.opacity = "1";
    if (this.reduced) return;
    const s = Math.min(2.2, 1 + n * 0.075);
    this.play(
      this.comboEl,
      [
        { transform: `translate(-50%,0) scale(${s + 0.5})` },
        { transform: `translate(-50%,0) scale(${s})` },
      ],
      280,
    );
    this.comboEl.style.transform = `translate(-50%,0) scale(${s})`;
  }

  /** The single word this game says when you get it right. */
  callTrue(combo: number): void {
    this.trueEl.textContent = this.t("true", "True");
    if (this.reduced) {
      this.trueEl.style.opacity = "1";
      setTimeout(() => (this.trueEl.style.opacity = "0"), 420);
      return;
    }
    const s = Math.min(2.1, 1 + combo * 0.08);
    this.play(
      this.trueEl,
      [
        { transform: `translate(-50%,-50%) scale(${s * 0.35}) rotate(-6deg)`, opacity: 0 },
        { transform: `translate(-50%,-58%) scale(${s * 1.12}) rotate(1.5deg)`, opacity: 1, offset: 0.22 },
        { transform: `translate(-50%,-64%) scale(${s})`, opacity: 1, offset: 0.5 },
        { transform: `translate(-50%,-92%) scale(${s * 0.9})`, opacity: 0 },
      ],
      620 + combo * 22,
    );
  }

  announceBand(name: string): void {
    this.bandName.textContent = name;
    if (this.reduced) {
      this.bandEl.style.opacity = "1";
      setTimeout(() => (this.bandEl.style.opacity = "0"), 1400);
      return;
    }
    this.play(
      this.bandEl,
      [
        { transform: "scale(.86)", opacity: 0, filter: "blur(6px)" },
        { transform: "scale(1)", opacity: 1, filter: "blur(0)", offset: 0.18 },
        { transform: "scale(1.02)", opacity: 1, offset: 0.7 },
        { transform: "scale(1.1)", opacity: 0 },
      ],
      2000,
    );
  }

  showPrompt(on: boolean): void {
    this.promptEl.style.opacity = on ? "" : "0";
    this.promptEl.style.visibility = on ? "" : "hidden";
  }

  hideHint(): void {
    this.hintEl.style.display = "none";
  }

  /* ── the end, and the way back ────────────────────────────────────────── */

  showOver(floor: number, canRevive: boolean): void {
    this.overBig.textContent = String(floor);
    this.overSub.textContent = this.t("floor", "Floor");
    this.overQ.style.display = "none";
    this.choicesEl.style.display = "none";
    this.reviveBtn.style.display = canRevive ? "" : "none";
    this.againBtn.style.display = "";
    this.overEl.classList.add("on");
  }

  showRevive(prompt: string, choices: string[]): void {
    this.overBig.textContent = "";
    this.overSub.textContent = "";
    this.overQ.style.display = "";
    this.overQ.innerHTML = escape(prompt).replace(
      BLANK,
      (glyph) => `<span class="q">${glyph}</span>`,
    );
    this.choicesEl.style.display = "";
    this.choicesEl.textContent = "";
    for (const c of choices) {
      const b = document.createElement("button");
      b.textContent = c;
      b.dataset.v = c;
      this.choicesEl.appendChild(b);
    }
    this.reviveBtn.style.display = "none";
    this.againBtn.style.display = "";
    this.overEl.classList.add("on");
  }

  markChoice(chosen: string, answer: string): void {
    for (const b of this.choicesEl.querySelectorAll("button")) {
      const v = b.dataset.v ?? "";
      if (v === answer) b.classList.add("good");
      else if (v === chosen) b.classList.add("bad");
      b.disabled = true;
    }
  }

  hideOver(): void {
    this.overEl.classList.remove("on");
  }

  setPerf(text: string, on: boolean): void {
    this.perfEl.classList.toggle("on", on);
    if (on) this.perfEl.textContent = text;
  }

  /* ── plumbing ─────────────────────────────────────────────────────────── */

  private play(el: Element, frames: Keyframe[], ms: number): void {
    if (typeof el.animate !== "function") return;
    const a = el.animate(frames, { duration: ms, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    this.anims.push(a);
    if (this.anims.length > 24) this.anims.splice(0, 12);
  }

  /** Placeholder for the host's string table; four keys is the whole surface. */
  private t(_k: string, fallback: string): string {
    return fallback;
  }

  dispose(): void {
    for (const a of this.anims) {
      try {
        a.cancel();
      } catch (err) {
        console.warn("[stack] anim cancel", err);
      }
    }
    this.anims.length = 0;
    this.root.remove();
  }
}

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;"));
}
