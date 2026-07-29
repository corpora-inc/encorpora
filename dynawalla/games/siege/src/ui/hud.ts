/**
 * The DOM chrome: the anvil, the build menus, the focus overlay and the banners.
 *
 * Text lives in the DOM because canvas text at three device pixel ratios is a
 * losing fight, and because the numbers are the one thing that must be perfectly
 * crisp on every device.
 */
import { TOWERS, type TowerKind } from "../game/constants.ts";
import { chromeVars } from "./chrome.ts";
import type { Question } from "../contract.ts";

export type HudCallbacks = {
  onAnswer(index: number): void;
  onFocusAnswer(index: number): void;
  onFocusCancel(): void;
  onOvercharge(): void;
  onSpeed(): void;
  onSound(): void;
  onRestart(): void;
  onBuy(kind: TowerKind): void;
  onArm(kind: TowerKind): void;
  onUpgrade(): void;
  onCallWave(): void;
};

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

/** tiny inline silhouettes so the build menu reads at a glance, no emoji */
function towerGlyph(kind: TowerKind): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "26");
  svg.setAttribute("height", "26");
  svg.setAttribute("viewBox", "0 0 26 26");
  const p = document.createElementNS(ns, "path");
  const d =
    kind === "bolt"
      ? "M13 2 L23 22 L3 22 Z"
      : kind === "mortar"
        ? "M4 9 h18 v13 h-18 z M10 2 h6 v7 h-6 z"
        : "M13 2 L23 8 L23 18 L13 24 L3 18 L3 8 Z";
  p.setAttribute("d", d);
  p.setAttribute("fill", "none");
  p.setAttribute("stroke", "#ffcf5c");
  p.setAttribute("stroke-width", "2.2");
  p.setAttribute("stroke-linejoin", "round");
  svg.appendChild(p);
  return svg;
}

function speakerGlyph(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "17");
  svg.setAttribute("height", "17");
  svg.setAttribute("viewBox", "0 0 17 17");
  const body = document.createElementNS(ns, "path");
  body.setAttribute("d", "M3 6.5 h2.6 L9 3.5 v10 L5.6 10.5 H3 Z");
  body.setAttribute("fill", "none");
  body.setAttribute("stroke", "#9b8878");
  body.setAttribute("stroke-width", "1.6");
  body.setAttribute("stroke-linejoin", "round");
  svg.appendChild(body);
  for (const [r, o] of [
    [2.6, 0.9],
    [4.6, 0.55],
  ] as const) {
    const a = document.createElementNS(ns, "path");
    a.setAttribute("d", `M11 ${8.5 - r * 0.72} A ${r} ${r} 0 0 1 11 ${8.5 + r * 0.72}`);
    a.setAttribute("fill", "none");
    a.setAttribute("stroke", "#9b8878");
    a.setAttribute("stroke-width", "1.5");
    a.setAttribute("stroke-linecap", "round");
    a.setAttribute("opacity", String(o));
    a.setAttribute("class", "wave");
    svg.appendChild(a);
  }
  return svg;
}

export class Hud {
  readonly root: HTMLDivElement;
  private style: HTMLStyleElement;
  readonly board: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;

  private embersEl: HTMLDivElement;
  private embersWrap: HTMLDivElement;
  private dpsEl: HTMLDivElement;
  private waveEl: HTMLDivElement;
  private threatEl: HTMLDivElement;
  private coreEl: HTMLDivElement;
  private pips: HTMLDivElement[] = [];
  private speedChip: HTMLButtonElement;
  private soundChip: HTMLButtonElement;
  private callChip: HTMLButtonElement;

  private anvil: HTMLDivElement;
  private palette!: HTMLDivElement;
  private cards: Partial<Record<TowerKind, { card: HTMLButtonElement; dps: HTMLDivElement }>> = {};
  private promptEl: HTMLDivElement;
  private payEl!: HTMLSpanElement;
  private slugs: HTMLButtonElement[] = [];
  private overBtn: HTMLButtonElement;
  private overFill: HTMLDivElement;
  private overPct: HTMLDivElement;

  private pop: HTMLDivElement | null = null;
  private banner: HTMLDivElement | null = null;
  private focus: HTMLDivElement | null = null;
  private focusSlugs: HTMLButtonElement[] = [];
  private focusTimer: HTMLElement | null = null;
  private end: HTMLDivElement | null = null;

  private flyPool: HTMLDivElement[] = [];
  private cb: HTMLCallbacksShim;

  constructor(host: HTMLElement, cb: HudCallbacks) {
    this.cb = cb as HTMLCallbacksShim;
    const root = el("div", "sg");
    this.root = root;

    // `styles.css` uses `env()` directly everywhere it can — exact, no
    // JavaScript, and it survives a rotation with no listener. The one thing it
    // cannot know is how wide the HOST's controls are, so that single number is
    // written in from the shared constants here.
    this.style = document.createElement("style");
    this.style.textContent = chromeVars();
    root.appendChild(this.style);

    // -- top bar -----------------------------------------------------------
    const top = el("div", "sg-top");

    const mkStat = (k: string, cls = ""): { wrap: HTMLDivElement; v: HTMLDivElement } => {
      const wrap = el("div", `sg-stat ${cls}`);
      wrap.appendChild(el("div", "sg-stat-k", k));
      const v = el("div", "sg-stat-v", "0");
      wrap.appendChild(v);
      return { wrap, v };
    };

    const embers = mkStat("embers", "sg-embers");
    this.embersWrap = embers.wrap;
    this.embersEl = embers.v;
    const dps = mkStat("dps");
    this.dpsEl = dps.v;
    const wave = mkStat("wave");
    this.waveEl = wave.v;
    const threat = mkStat("hp in");
    this.threatEl = threat.v;

    this.coreEl = el("div", "sg-core");
    for (let i = 0; i < 20; i++) {
      const pip = el("div", "sg-pip");
      this.pips.push(pip);
      this.coreEl.appendChild(pip);
    }

    this.callChip = el("button", "sg-chip", "");
    this.callChip.onclick = () => cb.onCallWave();
    this.speedChip = el("button", "sg-chip", "1×");
    this.speedChip.onclick = () => cb.onSpeed();
    this.soundChip = el("button", "sg-chip on");
    this.soundChip.setAttribute("aria-label", "sound");
    this.soundChip.appendChild(speakerGlyph());
    this.soundChip.onclick = () => cb.onSound();

    // The three switches are NOT in this bar. Its right-hand end is the corner
    // the host paints its how-to-play control over, and on a 320px phone the
    // bar was already over-full and clipping them off the screen. They are
    // appended to the anvil's head row below, where the console has room.
    top.append(
      embers.wrap,
      dps.wrap,
      wave.wrap,
      threat.wrap,
      el("div", "sg-spacer"),
      this.coreEl,
    );

    // -- board -------------------------------------------------------------
    this.board = el("div", "sg-board");
    this.canvas = el("canvas");
    this.board.appendChild(this.canvas);

    // -- anvil -------------------------------------------------------------
    this.anvil = el("div", "sg-anvil");

    // desktop palette: arm a tower, then click pads. Costs and dps side by side
    // is the cost-benefit sum made visible without a word of explanation.
    this.palette = el("div", "sg-pal");
    for (const kind of ["bolt", "mortar", "chain"] as const) {
      const spec = TOWERS[kind];
      const card = el("button", "sg-card");
      card.appendChild(towerGlyph(kind));
      const meta = el("div", "meta");
      meta.appendChild(el("div", "n", spec.name));
      meta.appendChild(el("div", "d", spec.blurb));
      card.appendChild(meta);
      const nums = el("div", "nums");
      const cost = el("div", "cost", String(spec.cost));
      nums.appendChild(cost);
      const dps = el("div", "dps", "");
      nums.appendChild(dps);
      card.appendChild(nums);
      card.onclick = () => cb.onArm(kind);
      this.cards[kind] = { card, dps };
      this.palette.appendChild(card);
    }

    const work = el("div", "sg-work");
    const head = el("div", "sg-head");
    head.appendChild(el("span", "", "ANVIL"));
    this.payEl = el("span", "pay", "+0");
    head.appendChild(this.payEl);
    const switches = el("div", "sg-switches");
    switches.append(this.callChip, this.speedChip, this.soundChip);
    head.appendChild(switches);
    this.promptEl = el("div", "sg-prompt");
    const slugRow = el("div", "sg-slugs");
    for (let i = 0; i < 4; i++) {
      const b = el("button", "sg-slug");
      b.onpointerdown = (ev) => {
        ev.preventDefault();
        cb.onAnswer(i);
      };
      this.slugs.push(b);
      slugRow.appendChild(b);
    }
    work.append(head, this.promptEl, slugRow);

    this.overBtn = el("button", "sg-over");
    this.overFill = el("div", "fill");
    this.overFill.style.height = "0%";
    this.overPct = el("div", "pct", "0");
    this.overBtn.append(this.overFill, el("div", "lab", "OVERCHARGE"), this.overPct);
    this.overBtn.onclick = () => cb.onOvercharge();

    this.anvil.append(this.palette, work, this.overBtn);

    root.append(top, this.board, this.anvil);
    host.appendChild(root);
  }

  // -- stats ---------------------------------------------------------------

  setEmbers(n: number, bump: boolean): void {
    this.embersEl.textContent = String(n);
    if (bump) {
      this.embersWrap.classList.remove("bump");
      void this.embersWrap.offsetWidth;
      this.embersWrap.classList.add("bump");
    }
  }

  setDps(n: number): void {
    this.dpsEl.textContent = String(n);
  }

  setWave(n: number): void {
    this.waveEl.textContent = String(n);
  }

  setThreat(n: number): void {
    this.threatEl.textContent = n >= 10000 ? `${Math.round(n / 1000)}k` : String(n);
  }

  setCore(hp: number, max: number, hurt: boolean): void {
    for (let i = 0; i < this.pips.length; i++) {
      const p = this.pips[i];
      if (!p) continue;
      p.style.display = i < max ? "" : "none";
      p.classList.toggle("out", i >= hp);
    }
    if (hurt) {
      this.coreEl.classList.remove("hurt");
      void this.coreEl.offsetWidth;
      this.coreEl.classList.add("hurt");
    }
  }

  setCall(text: string, active: boolean): void {
    this.callChip.textContent = text;
    this.callChip.style.display = text ? "" : "none";
    this.callChip.classList.toggle("on", active);
  }

  /** dps values come from the sim so the palette can never drift from the truth */
  setPalette(embers: number, armed: TowerKind | null, dps: Record<TowerKind, number>): void {
    for (const kind of ["bolt", "mortar", "chain"] as const) {
      const c = this.cards[kind];
      if (!c) continue;
      c.card.classList.toggle("armed", armed === kind);
      c.card.classList.toggle("poor", embers < TOWERS[kind].cost);
      const v = `${dps[kind]} dps`;
      if (c.dps.textContent !== v) c.dps.textContent = v;
    }
  }

  setSpeed(mult: number): void {
    this.speedChip.textContent = `${mult}×`;
    this.speedChip.classList.toggle("on", mult > 1);
  }

  setSound(on: boolean): void {
    this.soundChip.classList.toggle("on", on);
    for (const w of this.soundChip.querySelectorAll(".wave")) {
      (w as SVGElement).style.display = on ? "" : "none";
    }
  }

  setReducedMotion(on: boolean): void {
    this.root.classList.toggle("rm", on);
  }

  // -- anvil ---------------------------------------------------------------

  setQuestion(q: Question, order: number[], pays: number): void {
    this.payEl.textContent = `+${pays}`;
    this.promptEl.classList.remove("dark");
    this.promptEl.replaceChildren(
      document.createTextNode(q.prompt),
      Object.assign(el("span", "eq"), { textContent: "=" }),
    );
    const options = [q.answer, ...q.distractors];
    for (let i = 0; i < 4; i++) {
      const b = this.slugs[i];
      if (!b) continue;
      b.className = "sg-slug";
      b.textContent = options[order[i] ?? i] ?? "";
      b.disabled = false;
    }
  }

  markAnswer(idx: number, correct: boolean, correctIdx: number): void {
    const b = this.slugs[idx];
    if (b) b.classList.add(correct ? "right" : "wrong");
    if (!correct) {
      const c = this.slugs[correctIdx];
      if (c) c.classList.add("reveal");
    }
  }

  /** centre of an answer slug in root-relative pixels — the ember flight origin */
  slugCenter(idx: number): { x: number; y: number } {
    const b = this.slugs[idx];
    const rootBox = this.root.getBoundingClientRect();
    if (!b) return { x: rootBox.width / 2, y: rootBox.height - 60 };
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rootBox.left, y: r.top + r.height / 2 - rootBox.top };
  }

  focusSlugCenter(idx: number): { x: number; y: number } {
    const b = this.focusSlugs[idx];
    const rootBox = this.root.getBoundingClientRect();
    if (!b) return { x: rootBox.width / 2, y: rootBox.height / 2 };
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2 - rootBox.left, y: r.top + r.height / 2 - rootBox.top };
  }

  setCold(cold: boolean): void {
    this.anvil.classList.toggle("cold", cold);
    this.promptEl.classList.toggle("dark", cold);
  }

  setOvercharge(pct: number, ready: boolean): void {
    this.overFill.style.height = `${Math.min(100, pct)}%`;
    this.overPct.textContent = ready ? "GO" : String(Math.floor(pct));
    this.overBtn.classList.toggle("ready", ready);
    this.overBtn.disabled = !ready;
  }

  /** embers arcing from the anvil to the counter — the money-go-up beat */
  flyEmbers(n: number, fromX: number, fromY: number, onArrive: (i: number) => void): void {
    const tgt = this.embersWrap.getBoundingClientRect();
    const rootBox = this.root.getBoundingClientRect();
    const tx = tgt.left + tgt.width / 2 - rootBox.left;
    const ty = tgt.top + tgt.height / 2 - rootBox.top;
    const count = Math.min(9, Math.max(4, Math.round(n / 3)));
    for (let i = 0; i < count; i++) {
      let d = this.flyPool.pop();
      if (!d) {
        d = el("div");
        d.style.cssText =
          "position:absolute;width:11px;height:11px;pointer-events:none;z-index:9;" +
          "background:radial-gradient(circle,#fff5d8,#ff8a2b 60%,rgba(255,80,10,0));";
      }
      d.style.left = `${fromX - 5}px`;
      d.style.top = `${fromY - 5}px`;
      d.style.opacity = "1";
      this.root.appendChild(d);
      const spread = 90;
      const a = d.animate(
        [
          { transform: "translate(0,0) scale(0.5)", opacity: 1 },
          {
            transform: `translate(${(Math.random() - 0.5) * spread}px, ${-30 - Math.random() * 50}px) scale(1.35)`,
            opacity: 1,
            offset: 0.3,
          },
          { transform: `translate(${tx - fromX}px, ${ty - fromY}px) scale(0.55)`, opacity: 0.9 },
        ],
        {
          duration: 430 + i * 44,
          easing: "cubic-bezier(0.5, -0.3, 0.4, 1)",
          fill: "forwards",
        },
      );
      const node = d;
      a.onfinish = () => {
        node.remove();
        if (this.flyPool.length < 24) this.flyPool.push(node);
        onArrive(i);
      };
    }
  }

  // -- build / upgrade popup ------------------------------------------------

  showBuild(x: number, y: number, embers: number, onPick: (k: TowerKind) => void): void {
    this.hidePop();
    const p = el("div", "sg-pop");
    for (const kind of ["bolt", "mortar", "chain"] as const) {
      const spec = TOWERS[kind];
      const b = el("button", "sg-buy");
      b.appendChild(towerGlyph(kind));
      b.appendChild(el("div", "n", spec.name));
      b.appendChild(el("div", "c", String(spec.cost)));
      b.appendChild(el("div", "d", spec.blurb));
      b.disabled = embers < spec.cost;
      b.onpointerdown = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onPick(kind);
      };
      p.appendChild(b);
    }
    this.placePop(p, x, y);
  }

  showTower(
    x: number,
    y: number,
    info: { name: string; level: number; dps: number; cost: number | null; affordable: boolean },
    onUpgrade: () => void,
  ): void {
    this.hidePop();
    const p = el("div", "sg-pop");
    const b = el("button", "sg-buy");
    b.style.width = "116px";
    b.appendChild(el("div", "n", `${info.name} L${info.level + 1}`));
    b.appendChild(el("div", "c", info.cost === null ? "MAX" : `${info.cost}`));
    b.appendChild(el("div", "d", info.cost === null ? `${info.dps} dps` : `upgrade · solve`));
    b.disabled = info.cost === null || !info.affordable;
    b.onpointerdown = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      onUpgrade();
    };
    p.appendChild(b);
    const stat = el("div", "sg-buy");
    stat.style.width = "84px";
    stat.appendChild(el("div", "n", "DPS"));
    stat.appendChild(el("div", "c", String(info.dps)));
    stat.appendChild(el("div", "d", "per second"));
    p.appendChild(stat);
    this.placePop(p, x, y);
  }

  private placePop(p: HTMLDivElement, x: number, y: number): void {
    p.style.visibility = "hidden";
    this.board.appendChild(p);
    const w = p.offsetWidth;
    const h = p.offsetHeight;
    const bw = this.board.clientWidth;
    const bh = this.board.clientHeight;
    let left = x - w / 2;
    let top = y - h - 44;
    if (top < 4) top = Math.min(bh - h - 4, y + 44);
    left = Math.max(4, Math.min(bw - w - 4, left));
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
    p.style.visibility = "";
    this.pop = p;
  }

  hidePop(): void {
    this.pop?.remove();
    this.pop = null;
  }

  get popOpen(): boolean {
    return this.pop !== null;
  }

  // -- banner --------------------------------------------------------------

  showBanner(big: string, sub: string): void {
    if (this.focus) return; // never stack a banner under the focus overlay
    this.banner?.remove();
    const b = el("div", "sg-banner in");
    b.appendChild(el("div", "big", big));
    b.appendChild(el("div", "sub", sub));
    this.board.appendChild(b);
    this.banner = b;
    const node = b;
    setTimeout(() => {
      if (this.banner === node) {
        node.remove();
        this.banner = null;
      }
    }, 2200);
  }

  // -- focus overlay (overcharge + upgrade) ---------------------------------

  showFocus(tag: string, q: Question, order: number[], withTimer: boolean): void {
    this.hideFocus();
    // a wave banner behind a translucent overlay is unreadable soup
    this.banner?.remove();
    this.banner = null;
    const f = el("div", "sg-oc");
    f.appendChild(el("div", "tag", tag));
    f.appendChild(el("div", "q", `${q.prompt} =`));
    const grid = el("div", "grid");
    const options = [q.answer, ...q.distractors];
    this.focusSlugs = [];
    for (let i = 0; i < 4; i++) {
      const b = el("button", "sg-slug");
      b.textContent = options[order[i] ?? i] ?? "";
      b.onpointerdown = (ev) => {
        ev.preventDefault();
        this.cb.onFocusAnswer(i);
      };
      this.focusSlugs.push(b);
      grid.appendChild(b);
    }
    f.appendChild(grid);
    if (withTimer) {
      const t = el("div", "timer");
      const i = el("i");
      t.appendChild(i);
      f.appendChild(t);
      this.focusTimer = i;
    } else {
      this.focusTimer = null;
    }
    f.onpointerdown = (ev) => {
      if (ev.target === f) this.cb.onFocusCancel();
    };
    this.root.appendChild(f);
    this.focus = f;
  }

  setFocusTimer(frac: number): void {
    if (this.focusTimer) this.focusTimer.style.transform = `scaleX(${Math.max(0, frac)})`;
  }

  markFocus(idx: number, correct: boolean, correctIdx: number): void {
    const b = this.focusSlugs[idx];
    if (b) b.classList.add(correct ? "right" : "wrong");
    if (!correct) this.focusSlugs[correctIdx]?.classList.add("reveal");
    for (const s of this.focusSlugs) s.disabled = true;
  }

  hideFocus(): void {
    this.focus?.remove();
    this.focus = null;
    this.focusSlugs = [];
    this.focusTimer = null;
  }

  get focusOpen(): boolean {
    return this.focus !== null;
  }

  // -- end -----------------------------------------------------------------

  showEnd(wave: number, lines: string[]): void {
    this.hideEnd();
    const e = el("div", "sg-end");
    e.appendChild(el("div", "t", "THE FORGE WENT COLD"));
    e.appendChild(el("div", "w", String(wave)));
    e.appendChild(el("div", "s", "WAVES HELD"));
    const s = el("div", "s", lines.join("   ·   "));
    s.style.marginTop = "10px";
    e.appendChild(s);
    const b = el("button", "again", "RELIGHT");
    b.onclick = () => this.cb.onRestart();
    e.appendChild(b);
    this.root.appendChild(e);
    this.end = e;
  }

  hideEnd(): void {
    this.end?.remove();
    this.end = null;
  }

  destroy(): void {
    this.style.remove();
    this.root.remove();
  }
}

type HTMLCallbacksShim = HudCallbacks;
