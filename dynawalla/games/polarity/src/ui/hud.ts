import { clamp01, fmtScore } from "../core/util.ts";
import { fmtInt, fmtSigned, tryParseInt } from "../math/signed.ts";
import { PLAYER } from "../game/constants.ts";
import type { World } from "../game/world.ts";
import { applyChromeVars, applySafeVars } from "./layout.ts";
import type { Insets } from "../../../../packs/shared/game-chrome/index.ts";

/**
 * The HUD is DOM, not canvas: crisp numerals at every density, real safe-area
 * insets, and a `prefers-reduced-motion` path that costs nothing. Everything
 * here is written only when the value it shows actually changes, so a whole
 * minute of play does zero layout work.
 *
 * The core gauge is the only piece a player really has to read, so it is the
 * biggest thing on the screen after the ship: a signed numeral over a bar that
 * grows LEFT for negative and RIGHT for positive. Sign is position, not colour.
 */

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const CUE_TEXT: Record<string, string> = {
  absorb: "ABSORB",
  seal: "MATCH THE SIGN",
  clutch: "CLUTCH",
  release: "VENT",
  lock: "VENT EXACTLY",
};

export type HudHooks = {
  onFlip: () => void;
  onVent: () => void;
  onStart: () => void;
  onAgain: () => void;
  onRevive: (answered: string) => void;
  /** The option the child actually touched. Never blank — it is a real answer. */
  onSkipRevive: (answered: string) => void;
  onToggleSound: () => void;
  onTogglePause: () => void;
};

export class Hud {
  readonly root: HTMLElement;
  private readonly score: HTMLElement;
  private readonly best: HTMLElement;
  private readonly chain: HTMLElement;
  private readonly coreNum: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly capL: HTMLElement;
  private readonly capR: HTMLElement;
  private readonly pips: HTMLElement[] = [];
  private readonly stratum: HTMLElement;
  private readonly cue: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly padFlip: HTMLElement;
  private readonly padVent: HTMLElement;
  private readonly keyhint: HTMLElement;
  private readonly veil: HTMLElement;
  private readonly veilBody: HTMLElement;
  private readonly sndBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;

  private last = {
    score: -1,
    best: -1,
    chain: -1,
    core: NaN,
    cap: -1,
    shields: -1,
    stratum: -1,
    pol: 0,
    warn: -1,
    veil: "",
    ventReady: -1,
  };
  private cueKey = "";
  private touch = false;
  private insets: Insets | null = null;

  constructor(host: HTMLElement, private readonly hooks: HudHooks) {
    // The stylesheet is a static file and cannot be asserted about, so the
    // numbers that keep this register clear of the host's two 44px corners
    // live in `layout.ts` and are handed to the CSS here. The tests read the
    // same source, so the two cannot drift.
    applyChromeVars(host);

    this.root = el("div", "pol-hud");

    // The safe area cannot be read from the stylesheet at all: `env()` resolves
    // to zero in a cross-origin child, which is what every pack frame is. It
    // arrives from the host instead, written onto this element as four custom
    // properties and inherited by everything under it — the mini controls, the
    // key hint and the veil included. Republished on every resize.
    applySafeVars(this.root);

    // --- top -------------------------------------------------------------
    const top = el("div", "pol-top");
    const left = el("div");
    this.score = el("div", "pol-score");
    this.score.innerHTML = "<b>0</b>";
    this.best = el("span", "pol-best", "BEST 0");
    this.score.appendChild(this.best);
    this.chain = el("div", "pol-chain", "×1");
    left.append(this.score, this.chain);

    const core = el("div", "pol-core");
    this.coreNum = el("div", "pol-corenum", "0");
    this.bar = el("div", "pol-bar");
    this.fill = el("div", "pol-fill");
    this.bar.appendChild(this.fill);
    const caps = el("div", "pol-caps");
    this.capL = el("span", undefined, "−20");
    this.capR = el("span", undefined, "+20");
    caps.append(this.capL, this.capR);
    core.append(this.coreNum, this.bar, caps);

    const right = el("div", "pol-right");
    const shields = el("div", "pol-shields");
    for (let i = 0; i < PLAYER.shields; i++) {
      const p = el("i", "pol-pip");
      this.pips.push(p);
      shields.appendChild(p);
    }
    this.stratum = el("div", "pol-stratum", "STRATUM 0");
    right.append(shields, this.stratum);

    top.append(left, core, right);

    // --- middle ----------------------------------------------------------
    const mid = el("div", "pol-mid");
    this.cue = el("div", "pol-cue");
    mid.appendChild(this.cue);
    this.banner = el("div", "pol-banner");

    // --- bottom ----------------------------------------------------------
    const pads = el("div", "pol-pads");
    this.padFlip = el("div", "pol-pad", "FLIP");
    this.padVent = el("div", "pol-pad", "VENT");
    this.padVent.dataset.vent = "1";
    pads.append(this.padFlip, this.padVent);
    this.keyhint = el(
      "div",
      "pol-keyhint",
      "MOVE  ←↑↓→ / WASD      FLIP  SPACE      VENT  SHIFT",
    );

    this.root.append(top, mid, pads, this.banner, this.keyhint);

    // --- corner controls --------------------------------------------------
    const mini = el("div", "pol-mini");
    this.sndBtn = el("button", undefined, "SND") as HTMLButtonElement;
    this.pauseBtn = el("button", undefined, "II") as HTMLButtonElement;
    mini.append(this.sndBtn, this.pauseBtn);
    this.root.appendChild(mini);

    // --- overlay ----------------------------------------------------------
    this.veil = el("div", "pol-veil");
    this.veilBody = el("div");
    this.veil.appendChild(this.veilBody);
    this.root.appendChild(this.veil);

    host.appendChild(this.root);

    const tap = (n: HTMLElement, f: () => void): void => {
      n.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.touch = this.touch || e.pointerType !== "mouse";
          f();
        },
        { passive: false },
      );
    };
    tap(this.padFlip, hooks.onFlip);
    tap(this.padVent, hooks.onVent);
    tap(this.sndBtn, hooks.onToggleSound);
    tap(this.pauseBtn, hooks.onTogglePause);
    window.addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType !== "mouse") this.touch = true;
      },
      { capture: true },
    );
  }

  /**
   * Republish the safe area onto the HUD root.
   *
   * Called on every resize rather than once at mount: a rotation trades one top
   * inset for two side ones, and iPadOS changes them when the pack is resized in
   * Split View. Idempotent — nothing is written when the numbers have not moved.
   */
  setInsets(insets: Insets): void {
    if (applySafeVars(this.root, insets, this.insets)) {
      this.insets = { ...insets };
    }
  }

  dispose(): void {
    this.root.remove();
  }

  setSound(on: boolean): void {
    this.sndBtn.dataset.off = on ? "0" : "1";
  }

  blocked(): boolean {
    return !this.veil.hidden;
  }

  banner_(text: string): void {
    this.banner.textContent = text;
    this.banner.dataset.on = "0";
    void this.banner.offsetWidth;
    this.banner.dataset.on = "1";
  }

  // -------------------------------------------------------------------------

  update(w: World, ventReady: boolean): void {
    const L = this.last;

    if (w.pol !== L.pol) {
      L.pol = w.pol;
      this.root.parentElement?.setAttribute("data-pol", String(w.pol));
    }

    const s = Math.floor(w.stats.score);
    if (s !== L.score) {
      L.score = s;
      const b = this.score.firstChild;
      if (b) b.textContent = fmtScore(s);
    }
    if (w.stats.best !== L.best) {
      L.best = w.stats.best;
      this.best.textContent = `BEST ${fmtScore(w.stats.best)}`;
    }

    const mult = Math.min(9, 1 + Math.floor(w.chain / 6));
    if (mult !== L.chain) {
      if (mult > L.chain && L.chain > 0) {
        this.chain.dataset.hot = "0";
        void this.chain.offsetWidth;
        this.chain.dataset.hot = "1";
      }
      L.chain = mult;
      this.chain.textContent = `×${mult}`;
    }
    this.chain.dataset.on = w.chainT > 0 && mult > 1 ? "1" : "0";

    // --- the gauge
    const shown = Math.round(w.coreShown);
    const warn = Math.abs(w.core) >= w.cap - 2 ? 1 : 0;
    if (shown !== L.core) {
      L.core = shown;
      this.coreNum.textContent = fmtSigned(shown);
      this.coreNum.dataset.zero = shown === 0 ? "1" : "0";
      const frac = clamp01(Math.abs(w.coreShown) / Math.max(1, w.cap));
      this.fill.style.width = `${(frac * 50).toFixed(2)}%`;
      this.fill.dataset.neg = w.coreShown < 0 ? "1" : "0";
    }
    if (warn !== L.warn) {
      L.warn = warn;
      this.coreNum.dataset.warn = String(warn);
      this.bar.dataset.warn = String(warn);
    }
    if (w.cap !== L.cap) {
      L.cap = w.cap;
      this.capL.textContent = fmtInt(-w.cap);
      this.capR.textContent = `+${w.cap}`;
    }

    if (w.shields !== L.shields) {
      L.shields = w.shields;
      for (let i = 0; i < this.pips.length; i++) {
        const p = this.pips[i];
        if (p) p.dataset.off = i < w.shields ? "0" : "1";
      }
    }
    if (w.stratum !== L.stratum) {
      L.stratum = w.stratum;
      this.stratum.textContent = `STRATUM ${w.stratum}`;
    }

    const vr = ventReady ? 1 : 0;
    if (vr !== L.ventReady) {
      L.ventReady = vr;
      this.padVent.dataset.ready = String(vr);
    }

    if (w.cueNow && w.cueNow !== this.cueKey && w.cueT > 0) {
      this.cueKey = w.cueNow;
      this.cue.textContent = CUE_TEXT[w.cueNow] ?? "";
      this.cue.dataset.on = "0";
      void this.cue.offsetWidth;
      this.cue.dataset.on = "1";
    }
    if (w.cueT <= 0) this.cueKey = "";

    const showPads = this.touch && w.phase === "play";
    this.padFlip.dataset.hide = showPads ? "0" : "1";
    this.padVent.dataset.hide = showPads ? "0" : "1";
    this.keyhint.style.opacity = this.touch || w.phase !== "play" ? "0" : "";
  }

  // -------------------------------------------------------------------------
  // overlays
  // -------------------------------------------------------------------------

  hideVeil(): void {
    this.veil.hidden = true;
    this.last.veil = "";
  }

  showTitle(best: number): void {
    if (this.last.veil === "title") return;
    this.last.veil = "title";
    this.veil.hidden = false;
    this.veilBody.replaceChildren();
    const t = el("div", "pol-title");
    t.innerHTML = "POLA<i>R</i><u>I</u>TY";
    const sub = el(
      "div",
      "pol-sub",
      "MATCH A BULLET'S SIGN TO DRINK IT. YOUR TOTAL IS THE WEAPON. VENT IT AT THE EDGE.",
    );
    const b = el("button", "pol-btn", "PLAY") as HTMLButtonElement;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.hooks.onStart();
    });
    this.veilBody.append(t, sub, b);
    if (best > 0) this.veilBody.append(el("div", "pol-best", `BEST ${fmtScore(best)}`));
  }

  showPause(): void {
    if (this.last.veil === "pause") return;
    this.last.veil = "pause";
    this.veil.hidden = false;
    this.veilBody.replaceChildren();
    const t = el("div", "pol-title", "PAUSED");
    const b = el("button", "pol-btn", "RESUME") as HTMLButtonElement;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.hooks.onTogglePause();
    });
    this.veilBody.append(t, b);
  }

  /**
   * The continue screen. This is the slot a free-to-play game fills with an
   * advert; here it is one signed-integer question, and the reward is a full
   * shield and a screen-clearing shockwave.
   */
  showRevive(prompt: string, options: string[], correct: string): void {
    if (this.last.veil === "revive") return;
    this.last.veil = "revive";
    this.veil.hidden = false;
    this.veilBody.replaceChildren();
    const ask = el("div", "pol-ask", "REPOLARIZE");
    const p = el("div", "pol-prompt", prompt);
    const row = el("div", "pol-orbs");
    for (const o of options) {
      // A host is free to hand back something this pack did not expect; the
      // last screen of a run is not the place to throw over it.
      const v = tryParseInt(o);
      const btn = el("button", "pol-orb") as HTMLButtonElement;
      btn.dataset.neg = v !== null && v < 0 ? "1" : "0";
      btn.appendChild(el("span", undefined, v === null ? o : fmtInt(v)));
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (btn.dataset.dead === "1") return;
        if (o === correct) this.hooks.onRevive(o);
        else {
          btn.dataset.dead = "1";
          this.hooks.onSkipRevive(o);
        }
      });
      row.appendChild(btn);
    }
    this.veilBody.append(ask, p, row);
  }

  showOver(w: World): void {
    if (this.last.veil === "over") return;
    this.last.veil = "over";
    this.veil.hidden = false;
    this.veilBody.replaceChildren();
    const st = w.stats;
    const head = el("div", "pol-over", st.score >= st.best && st.score > 0 ? "NEW BEST" : "RUN ENDED");
    const n = el("div", "pol-final", fmtScore(st.score));
    const grid = el("div", "pol-stats");
    const mins = Math.floor(st.depth / 60);
    const secs = Math.floor(st.depth % 60);
    const rows: [string, string][] = [
      ["TIME", `${mins}:${String(secs).padStart(2, "0")}`],
      // No STRATUM row: the stratum IS the number of seals broken now, and
      // SEALS below already says it with its denominator attached.
      ["ABSORBED", String(st.absorbs)],
      ["BEST CHAIN", String(st.bestChain)],
      ["CLUTCH FLIPS", String(st.clutches)],
      ["PERFECT VENTS", String(st.perfects)],
      ["SEALS", `${st.right}/${st.asked}`],
    ];
    for (const [k, v] of rows) grid.append(el("span", undefined, k), el("span", undefined, v));
    const b = el("button", "pol-btn", "AGAIN") as HTMLButtonElement;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.hooks.onAgain();
    });
    this.veilBody.append(head, n, grid, b);
  }
}
