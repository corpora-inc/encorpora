/**
 * `mountBazaar(el, options)` — the whole marketplace, in one DOM element.
 *
 * The split that makes both the frame budget and the accessibility work:
 * **pixels on canvas, semantics in DOM.** The street is a real horizontal
 * scroller, so touch gets native flick momentum and `scrollLeft` is a real
 * number we can restore on exit (BZ-08). Each stall is a real `<button>` with a
 * real accessible name, inside a real `listbox`. Everything you can see is
 * drawn; everything you can reach is an element.
 */

import { clamp, mix as mixSeed, hash } from "./util/rng.ts";
import { over } from "./util/color.ts";
import { layout, curve, type Layout } from "./world/layout.ts";
import { Street, type StallFeature } from "./world/street.ts";
import { QUARTERS, quarterById } from "./world/quarters.ts";
import { ambient, semanticAt, type Ambient } from "./world/daylight.ts";
import { Backdrop } from "./world/backdrop.ts";
import { WARDS, type Semantic } from "./tokens/palette.ts";
import { drawStall, drawStallLight, stallBox } from "./stall/chrome.ts";
import { PreviewDirector } from "./stall/preview.ts";
import { Lamp } from "./lamp/state.ts";
import { drawLamp, drawLamplighter } from "./lamp/lamp.ts";
import { drawAstrolabe } from "./finder/astrolabe.ts";
import { PerfGovernor } from "./perf/tiers.ts";
import { Bed } from "./sound/bed.ts";
import { resolveLocale, t as tr, type Locale } from "./strings.ts";
import type { BazaarHandle, BazaarOptions, Quarter, StallSpec } from "./types.ts";

interface StallEl {
  root: HTMLButtonElement;
  chrome: HTMLCanvasElement;
  cctx: CanvasRenderingContext2D | null;
  preview: HTMLCanvasElement;
  pctx: CanvasRenderingContext2D | null;
  sign: HTMLDivElement;
  name: HTMLSpanElement;
  spec: HTMLSpanElement;
  bar: HTMLDivElement;
  key: string;
  attention: number;
  look: number;
}

export function mountBazaar(host: HTMLElement, opts: BazaarOptions): BazaarHandle {
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;
  const locale: Locale = resolveLocale(opts.locale ?? win.navigator?.language);
  const seed = opts.seed ?? 0x1453;

  // ── DOM ────────────────────────────────────────────────────────────────
  const root = doc.createElement("div");
  root.className = "bz-root";
  const back = doc.createElement("canvas");
  back.className = "bz-canvas";
  back.setAttribute("aria-hidden", "true");
  const street = doc.createElement("div");
  street.className = "bz-street";
  street.setAttribute("role", "listbox");
  street.setAttribute("aria-label", tr(locale, "street"));
  street.setAttribute("aria-orientation", "horizontal");
  const track = doc.createElement("div");
  track.className = "bz-track";
  street.appendChild(track);
  const fore = doc.createElement("canvas");
  fore.className = "bz-canvas bz-canvas--fore";
  fore.setAttribute("aria-hidden", "true");

  const lampWrap = doc.createElement("div");
  lampWrap.className = "bz-lamp";
  const lampCv = doc.createElement("canvas");
  lampWrap.appendChild(lampCv);
  const lampLabel = doc.createElement("span");
  lampLabel.className = "bz-sr";
  lampLabel.setAttribute("role", "status");
  lampWrap.appendChild(lampLabel);

  const lighter = doc.createElement("button");
  lighter.className = "bz-lamplighter";
  lighter.type = "button";
  lighter.setAttribute("aria-label", tr(locale, "lamplighter"));
  const lighterCv = doc.createElement("canvas");
  lighter.appendChild(lighterCv);

  const finder = doc.createElement("button");
  finder.className = "bz-astrolabe";
  finder.type = "button";
  finder.setAttribute("role", "slider");
  finder.setAttribute("aria-label", tr(locale, "finder"));
  finder.setAttribute("aria-valuemin", "0");
  const finderCv = doc.createElement("canvas");
  finder.appendChild(finderCv);

  const valve = doc.createElement("button");
  valve.className = "bz-valve";
  valve.type = "button";
  const valveHit = doc.createElement("span");
  valveHit.className = "bz-sr";
  valve.appendChild(valveHit);

  root.append(back, street, fore, lampWrap, lighter, finder, valve);
  host.appendChild(root);

  // ── state ──────────────────────────────────────────────────────────────
  const quarters: Quarter[] = [...QUARTERS, ...(opts.quarters ?? [])];
  let stalls: StallSpec[] = opts.stalls.slice();
  let lay: Layout = layout(host.clientWidth || 360, host.clientHeight || 640, dpr());
  let street0 = new Street({ seed, module: lay.M, stalls, quarters });
  const director = new PreviewDirector();
  const lamp = new Lamp();
  const perf = new PerfGovernor();
  const bed = new Bed();
  const backdrop = new Backdrop(back, fore);

  const pool = new Map<string, StallEl>();
  let reduced = prefersReduced();
  let subscribed = opts.subscribed ?? false;
  let soundOn = opts.sound !== false;
  let inStall = false;
  let savedScroll = 0;
  let focusIx = 0;
  let t0 = now();
  let last = t0;
  let raf = 0;
  let alive = true;
  let touch: { x: number; y: number; age: number } | null = null;
  let ripples: { x: number; age: number }[] = [];
  let lanternKick = 0;
  let catWake = 0;
  let finderAngle = 0;
  let shaftXs: number[] = [];
  let entering = 0;

  lamp.setSubscribed(subscribed);
  lamp.setRemaining(opts.dayRemaining ?? 1);

  function dpr(): number {
    return Math.min(2, win.devicePixelRatio || 1);
  }

  function prefersReduced(): boolean {
    try {
      return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function prefersDark(): boolean {
    try {
      return win.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  }

  function now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  // ── layout ─────────────────────────────────────────────────────────────
  function resize(): void {
    const w = host.clientWidth || root.clientWidth || 360;
    const h = host.clientHeight || root.clientHeight || 640;
    lay = layout(w, h, dpr());
    perf.setSmallScreen(lay.small);
    const scale = Math.min(dpr(), 1.5) * 0.85;
    backdrop.resize(lay, Math.max(1, scale));

    street0 = new Street({ seed, module: lay.M, stalls, quarters });
    street0.ensure(w * 3 + lay.M * 6);
    for (const [, el] of pool) el.root.remove();
    pool.clear();

    // The lamp lives in the leading 22 % of the viewport and never leaves it.
    const lampW = Math.max(76, Math.min(lay.w * 0.22, lay.M * 0.36));
    const lampH = Math.min(lay.floorY - lay.skyH * 0.5, lampW * 2.6);
    lampWrap.style.left = `${Math.round(lay.w * 0.03)}px`;
    lampWrap.style.top = `${Math.round(lay.skyH * 0.5)}px`;
    lampCv.width = Math.round(lampW * lay.dpr);
    lampCv.height = Math.round(lampH * lay.dpr);
    lampCv.style.width = `${lampW}px`;
    lampCv.style.height = `${lampH}px`;

    // The lamplighter stands on the pavement beneath the lamp, holding a taper.
    const lw = Math.max(48, lay.M * 0.22);
    lighter.style.left = `${Math.round(lay.w * 0.03 + lampW * 0.5 - lw * 0.5)}px`;
    lighter.style.top = `${Math.round(lay.floorY - lw * 1.5)}px`;
    lighter.style.width = `${lw}px`;
    lighter.style.height = `${lw * 1.5}px`;
    lighterCv.width = Math.round(lw * lay.dpr);
    lighterCv.height = Math.round(lw * 1.5 * lay.dpr);
    lighterCv.style.width = `${lw}px`;
    lighterCv.style.height = `${lw * 1.5}px`;

    const fs = lay.small ? 48 : Math.max(56, Math.min(92, lay.M * 0.26));
    finder.style.right = `${Math.round(lay.w * 0.035)}px`;
    finder.style.bottom = `${Math.round(lay.floorH * 0.18)}px`;
    finder.style.width = `${fs}px`;
    finder.style.height = `${fs}px`;
    finderCv.width = Math.round(fs * lay.dpr);
    finderCv.height = Math.round(fs * lay.dpr);
    finderCv.style.width = `${fs}px`;
    finderCv.style.height = `${fs}px`;

    const vs = Math.max(44, lay.M * 0.14);
    valve.style.right = `${Math.round(lay.M * 0.13 - vs / 2)}px`;
    valve.style.top = `${Math.round(lay.skyH * 0.5 - vs / 2)}px`;
    valve.style.width = `${vs}px`;
    valve.style.height = `${vs}px`;

    syncTrack();
  }

  function syncTrack(): void {
    street0.ensure(street.scrollLeft + lay.w * 3 + lay.M * 6);
    track.style.width = `${Math.round(street0.width + lay.w)}px`;
  }

  // ── stall elements ─────────────────────────────────────────────────────
  function stallEl(f: StallFeature): StallEl {
    const id = f.stall.id;
    let el = pool.get(id);
    if (el) return el;
    const btn = doc.createElement("button");
    btn.className = "bz-stall";
    btn.type = "button";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", "false");
    btn.tabIndex = -1;
    const chrome = doc.createElement("canvas");
    chrome.className = "bz-stall-chrome";
    const preview = doc.createElement("canvas");
    preview.className = "bz-stall-preview";
    const sign = doc.createElement("div");
    sign.className = "bz-sign";
    const name = doc.createElement("span");
    name.className = "bz-sign-name";
    const spec = doc.createElement("span");
    spec.className = "bz-sign-spec";
    spec.setAttribute("aria-hidden", "true");
    sign.append(name, spec);
    const bar = doc.createElement("div");
    bar.className = "bz-focusbar";
    btn.append(chrome, preview, sign, bar);
    track.appendChild(btn);
    el = {
      root: btn,
      chrome,
      cctx: chrome.getContext("2d"),
      preview,
      pctx: preview.getContext("2d"),
      sign,
      name,
      spec,
      bar,
      key: "",
      attention: 0,
      look: 0,
    };
    pool.set(id, el);

    btn.addEventListener("click", () => enterStall(f));
    btn.addEventListener("focus", () => {
      focusIx = f.index;
      centreOn(f, "smooth");
    });
    return el;
  }

  function sizeStallEl(el: StallEl, f: StallFeature): void {
    const box = stallBox(lay);
    const k = `${Math.round(box.w)}x${Math.round(box.h)}@${lay.dpr}`;
    if (el.key === k) return;
    el.key = k;
    el.root.style.width = `${box.w}px`;
    el.root.style.height = `${box.h}px`;
    el.root.style.top = `${lay.stallTop}px`;
    el.chrome.width = Math.round(box.w * lay.dpr);
    el.chrome.height = Math.round(box.h * lay.dpr);
    el.chrome.style.width = `${box.w}px`;
    el.chrome.style.height = `${box.h}px`;
    el.cctx = el.chrome.getContext("2d");
    el.cctx?.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);

    el.preview.width = Math.round(box.apertureW * lay.dpr);
    el.preview.height = Math.round(box.apertureH * lay.dpr);
    el.preview.style.width = `${box.apertureW}px`;
    el.preview.style.height = `${box.apertureH}px`;
    el.preview.style.left = `${box.apertureX}px`;
    el.preview.style.top = `${box.apertureY}px`;
    el.pctx = el.preview.getContext("2d");
    el.pctx?.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);

    el.sign.style.left = `${box.w * 0.09}px`;
    el.sign.style.top = `${box.signY}px`;
    el.sign.style.width = `${box.w * 0.82}px`;
    el.sign.style.height = `${box.signH}px`;
    // Never below 20 px on any device: the numerals are the product.
    const specPx = Math.max(20, Math.round(box.signH * 0.4));
    el.spec.style.fontSize = `${specPx}px`;
    el.name.style.fontSize = `${Math.max(12, Math.round(specPx * 0.62))}px`;

    el.bar.style.left = `${box.w * 0.12}px`;
    el.bar.style.top = `${box.sillY - 5}px`;
    el.bar.style.width = `${box.w * 0.76}px`;
    void f;
  }

  // ── navigation ─────────────────────────────────────────────────────────
  function centreOn(f: StallFeature, behavior: ScrollBehavior = "smooth"): void {
    const target = f.x + f.width / 2 - lay.w / 2;
    street.scrollTo({ left: Math.max(0, target), behavior: reduced ? "auto" : behavior });
  }

  function step(delta: number): void {
    const next = clamp(focusIx + delta, 0, street0.stalls.length - 1);
    street0.ensure((next + 4) * lay.M * 1.3);
    syncTrack();
    const f = street0.stalls[next];
    if (!f) return;
    focusIx = next;
    centreOn(f);
    const el = pool.get(f.stall.id);
    el?.root.focus({ preventScroll: true });
  }

  function enterStall(f: StallFeature): void {
    if (f.stall.state === "scaffold") return;
    savedScroll = street.scrollLeft;
    inStall = true;
    lamp.setInStall(true);
    bed.setDuck("mute");
    entering = 1;
    street.classList.add("is-entering");
    if (!reduced) {
      const box = stallBox(lay);
      const k = 1 / 0.82;
      const cx = f.x + f.width / 2 - street.scrollLeft;
      street.style.transformOrigin = `${cx}px ${box.apertureY + box.apertureH / 2 + lay.stallTop}px`;
      street.style.transform = `scale(${k})`;
    }
    street.style.opacity = "0";
    opts.onEnter?.(f.stall.id);
  }

  function leaveStall(): void {
    inStall = false;
    lamp.setInStall(false);
    bed.setDuck("none");
    entering = 0;
    street.style.transform = "";
    street.style.opacity = "";
    // BZ-08 — losing your place in a bazaar is losing the bazaar.
    street.scrollLeft = savedScroll;
    win.setTimeout(() => street.classList.remove("is-entering"), 460);
  }

  // ── input ──────────────────────────────────────────────────────────────
  street.addEventListener("scroll", syncTrack, { passive: true });

  street.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        street.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false },
  );

  street.addEventListener("keydown", (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight":
        step(1);
        e.preventDefault();
        break;
      case "ArrowLeft":
        step(-1);
        e.preventDefault();
        break;
      case "Home":
      case "End": {
        const bounds = street0.wardBoundaries();
        const target =
          e.key === "Home"
            ? [...bounds].reverse().find((b) => b < focusIx) ?? 0
            : bounds.find((b) => b > focusIx) ?? street0.stalls.length - 1;
        step(target - focusIx);
        e.preventDefault();
        break;
      }
      default:
        break;
    }
  });

  let downAt: { x: number; y: number; time: number } | null = null;
  street.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY, time: now() };
      bed.start();
    },
    { passive: true },
  );
  street.addEventListener(
    "pointerup",
    (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const rect = root.getBoundingClientRect();
      if (moved < 8) poke(e.clientX - rect.left, e.clientY - rect.top);
      downAt = null;
    },
    { passive: true },
  );

  /**
   * A poke at the world. Everything it does is free and grants nothing
   * (BZ-LAW-12): dust scatters, the water rings, the cat wakes, a lantern
   * swings, and the nearest automaton looks up. Once.
   */
  function poke(x: number, y: number): void {
    touch = { x, y, age: 0 };
    if (y > lay.floorY) ripples.push({ x, age: 0 });
    if (ripples.length > 4) ripples.shift();
    if (y < lay.stallTop) lanternKick = 5;
    catWake = 1;
    const camX = street.scrollLeft;
    const f = street0.nearestStall(camX + x);
    if (f) {
      const el = pool.get(f.stall.id);
      if (el) {
        el.attention = 1;
        el.look = clamp((camX + x - (f.x + f.width * 0.13)) / (f.width * 0.5), -1, 1);
      }
    }
    if (soundOn && Math.abs(x - lay.w * 0.5) < lay.w) bed.chime((x / lay.w) * 1.4 - 0.7);
  }

  lighter.addEventListener("click", () => opts.onUpgrade?.());

  valve.addEventListener("click", () => {
    soundOn = !soundOn;
    bed.start();
    bed.setOpen(soundOn);
    valveHit.textContent = tr(locale, soundOn ? "sound.on" : "sound.off");
    valve.setAttribute("aria-label", tr(locale, soundOn ? "sound.on" : "sound.off"));
    valve.setAttribute("aria-pressed", String(soundOn));
  });
  valve.setAttribute("aria-label", tr(locale, soundOn ? "sound.on" : "sound.off"));
  valve.setAttribute("aria-pressed", String(soundOn));

  // The astrolabe: drag the rete, release, and the street flies to that ward.
  let finderDrag = false;
  finder.addEventListener("pointerdown", (e: PointerEvent) => {
    finderDrag = true;
    finder.setPointerCapture(e.pointerId);
  });
  finder.addEventListener("pointermove", (e: PointerEvent) => {
    if (!finderDrag) return;
    const r = finder.getBoundingClientRect();
    finderAngle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  });
  const releaseFinder = (): void => {
    if (!finderDrag) return;
    finderDrag = false;
    flyToWard();
  };
  finder.addEventListener("pointerup", releaseFinder);
  finder.addEventListener("pointercancel", releaseFinder);
  finder.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      finderAngle += (Math.PI * 2) / 5;
      flyToWard();
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      finderAngle -= (Math.PI * 2) / 5;
      flyToWard();
      e.preventDefault();
    }
  });

  function flyToWard(): void {
    const bounds = street0.wardBoundaries();
    if (!bounds.length) return;
    const norm = ((finderAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const ix = Math.min(bounds.length - 1, Math.floor((norm / (Math.PI * 2)) * bounds.length));
    const f = street0.stalls[bounds[ix]!];
    if (!f) return;
    focusIx = f.index;
    centreOn(f);
    finder.setAttribute("aria-valuenow", String(ix));
    finder.setAttribute("aria-valuemax", String(bounds.length - 1));
    finder.setAttribute("aria-valuetext", f.quarter.name[locale]);
  }

  const onResize = (): void => resize();
  win.addEventListener("resize", onResize);
  const onVis = (): void => {
    if (doc.hidden) {
      bed.suspend();
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      bed.resume();
      last = now();
      if (!raf && alive) raf = requestAnimationFrame(frame);
    }
  };
  doc.addEventListener("visibilitychange", onVis);

  let mqReduced: MediaQueryList | null = null;
  try {
    mqReduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    mqReduced.addEventListener("change", () => {
      reduced = prefersReduced();
    });
  } catch {
    /* no matchMedia */
  }

  // ── the loop ───────────────────────────────────────────────────────────
  function frame(): void {
    if (!alive) return;
    const n = now();
    const dt = Math.min(0.05, (n - last) / 1000);
    last = n;
    const t = (n - t0) / 1000;
    perf.sample(dt * 1000, n);
    const budget = perf.budget;

    const reading = lamp.read();
    lamp.setForcedNight(
      opts.theme === "night" || (opts.theme !== "light" && prefersDark() && !subscribed ? false : false),
    );
    const forcedNight = opts.theme === "night" || (opts.theme === "auto" && prefersDark());
    lamp.setForcedNight(forcedNight);
    const r2 = lamp.read();
    const am: Ambient = ambient(r2.d, r2.night);
    const sem: Semantic = semanticAt(r2.night);
    root.classList.toggle("bz-night", r2.night > 0.5);

    if (touch) {
      touch.age += dt;
      if (touch.age > 0.7) touch = null;
    }
    for (const rp of ripples) rp.age += dt;
    ripples = ripples.filter((rp) => rp.age < 1.2);
    lanternKick *= Math.exp(-dt * 2.4);
    catWake = Math.max(0, catWake - dt * 0.18);

    const camX = street.scrollLeft;
    street0.ensure(camX + lay.w * 3 + lay.M * 6);

    // Which stall is centred? Only that one animates (BZ-06).
    const centre = street0.nearestStall(camX + lay.w / 2);
    director.setLive(centre && !inStall ? centre.stall.id : null);
    director.beginFrame();
    bed.setDuck(inStall ? "mute" : centre ? "preview" : "none");

    // ── the visible window ────────────────────────────────────────────────
    const visible = street0.visible(camX - lay.M * 1.2, camX + lay.w + lay.M * 1.2);
    const seen = new Set<string>();
    const reflectors: { x: number; w: number; color: string; lit: boolean }[] = [];

    for (const f of visible) {
      if (f.kind !== "stall") continue;
      seen.add(f.stall.id);
      const el = stallEl(f);
      sizeStallEl(el, f);
      const box = stallBox(lay);
      const dx = f.x + f.width / 2 - (camX + lay.w / 2);
      const y = reduced ? 0 : curve(dx);
      el.root.style.transform = `translate3d(${Math.round(f.x)}px, ${y.toFixed(2)}px, 0)`;
      el.root.style.left = "0";

      const q = f.quarter;
      const isCentre = centre?.stall.id === f.stall.id;
      el.root.setAttribute("aria-selected", String(isCentre));

      // The accessible name: the game, the place, and the specimen in words.
      const spec = f.stall.specimen ?? q.specimen;
      if (f.stall.state === "scaffold") {
        el.root.setAttribute("aria-label", tr(locale, "scaffold", { quarter: q.name[locale] }));
        el.root.setAttribute("aria-disabled", "true");
        el.sign.style.display = "none";
      } else {
        el.root.setAttribute(
          "aria-label",
          tr(locale, "stall", { name: f.stall.title, quarter: q.name[locale], specimen: spec.spoken }),
        );
        el.root.removeAttribute("aria-disabled");
        el.sign.style.display = "";
        if (el.name.textContent !== f.stall.title) el.name.textContent = f.stall.title;
        if (el.spec.textContent !== spec.display) el.spec.textContent = spec.display;
      }

      el.attention = Math.max(0, el.attention - dt / 0.42);

      const g = el.cctx;
      if (g) {
        g.clearRect(0, 0, box.w, box.h);
        drawStall(g, {
          lay,
          sem,
          am,
          quarter: q,
          state: f.stall.state ?? (f.stall.preview ? "open" : "scaffold"),
          seed: mixSeed(f.seed, hash(f.stall.id)),
          accretion: f.stall.accretion ?? 0,
          t,
          reduced,
          look: el.look,
          attention: el.attention,
          centred: isCentre ? 1 : 0,
        });
        // A shaft of light landing on this stall lifts its whole facade.
        const sx = f.x - camX + box.w / 2;
        let nearest = Infinity;
        for (const s of shaftXs) nearest = Math.min(nearest, Math.abs(s - sx));
        if (Number.isFinite(nearest)) drawStallLight(g, am, box, nearest);
      }

      const p = el.pctx;
      if (p && (f.stall.state ?? "open") === "open") {
        const drew = director.draw(
          p,
          f.stall.id,
          budget.livePreview ? f.stall.preview : undefined,
          box.apertureW,
          box.apertureH,
          lay.dpr,
          t,
          f.seed,
          reduced,
        );
        el.preview.style.visibility = drew ? "visible" : "hidden";
      } else if (p) {
        el.preview.style.visibility = "hidden";
      }

      reflectors.push({
        x: f.x - camX + box.w * 0.1,
        w: box.w * 0.8,
        color: over(WARDS[q.ward].glaze, sem.water, 0.35),
        lit: am.lanternGain > 0.3,
      });
    }

    for (const [id, el] of pool) {
      if (!seen.has(id)) {
        el.root.remove();
        pool.delete(id);
      }
    }

    // ── the world behind and in front ────────────────────────────────────
    backdrop.draw({
      camX,
      t,
      dt,
      lay,
      sem,
      am,
      street: street0,
      ward: centre?.quarter.ward ?? "lapis",
      reduced,
      budget,
      seed,
      touch,
      ripples,
      lanternKick,
      catWake,
      soundOpen: soundOn,
      reflectors,
      onShafts: (xs) => {
        shaftXs = xs;
      },
    });

    // ── the lamp ─────────────────────────────────────────────────────────
    const lg = lampCv.getContext("2d");
    if (lg) {
      lg.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);
      drawLamp(lg, lampCv.width / lay.dpr, lampCv.height / lay.dpr, {
        sem,
        am,
        reading: r2,
        subscribed,
        reduced,
        t,
      });
    }
    const label = tr(locale, r2.label);
    if (lampLabel.textContent !== label) lampLabel.textContent = label;

    // The single upgrade surface. It never animates to attract attention, and
    // it is not reachable while a stall is open (BZ-15).
    const showLighter = lamp.showsLamplighter && !inStall;
    lighter.style.display = showLighter ? "" : "none";
    if (showLighter) {
      const lgc = lighterCv.getContext("2d");
      if (lgc) {
        lgc.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);
        drawLamplighter(lgc, lighterCv.width / lay.dpr, lighterCv.height / lay.dpr, sem, am, reduced, t);
      }
    }

    const fg = finderCv.getContext("2d");
    if (fg) {
      fg.setTransform(lay.dpr, 0, 0, lay.dpr, 0, 0);
      drawAstrolabe(fg, finderCv.width / lay.dpr, finderAngle, 5, sem, am, finderDrag);
    }

    raf = requestAnimationFrame(frame);
    void reading;
    void entering;
  }

  resize();
  // Open on the first stall, so the street already reads as a place.
  const first = street0.stalls[0];
  if (first) street.scrollLeft = Math.max(0, first.x + first.width / 2 - lay.w / 2);
  bed.setOpen(soundOn);
  raf = requestAnimationFrame(frame);

  return {
    destroy(): void {
      alive = false;
      cancelAnimationFrame(raf);
      win.removeEventListener("resize", onResize);
      doc.removeEventListener("visibilitychange", onVis);
      bed.destroy();
      director.clear();
      root.remove();
    },
    setStalls(next: StallSpec[]): void {
      stalls = next.slice();
      resize();
    },
    setDay(remaining: number): void {
      lamp.setRemaining(remaining);
    },
    setSubscribed(v: boolean): void {
      subscribed = v;
      lamp.setSubscribed(v);
    },
    setInStall(v: boolean): void {
      if (v === inStall) return;
      if (v) {
        const f = street0.nearestStall(street.scrollLeft + lay.w / 2);
        if (f) enterStall(f);
      } else {
        leaveStall();
      }
    },
    goToStall(id: string): void {
      const f = street0.stallById(id);
      if (f) {
        focusIx = f.index;
        centreOn(f);
      }
    },
    scrollLeft(): number {
      return street.scrollLeft;
    },
    stats() {
      return {
        fps: perf.fps,
        p90: perf.p90,
        tier: perf.level,
        liveNodes: root.querySelectorAll("*").length,
      };
    },
  };
}

export { quarterById };
