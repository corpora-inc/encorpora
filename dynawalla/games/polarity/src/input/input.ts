import { PLAYER } from "../game/constants.ts";
import { flip, release } from "../game/sim.ts";
import type { World } from "../game/world.ts";
import { fit, toWorldX, toWorldY } from "../render/view.ts";

/**
 * Touch is primary — this is a form that lives on a tablet — and desktop is a
 * first-class second, not a fallback.
 *
 * TOUCH   drag anywhere to fly (relative, so your thumb never covers the ship);
 *         a quick tap flips; a second finger flips without letting go; the two
 *         big pads flip and vent for anyone who never discovers the gestures.
 * MOUSE   the ship tracks the cursor 1:1; left click flips, right click vents.
 * KEYS    arrows/WASD fly, Space/J flips, Shift/K vents, P or Esc pauses.
 */

export type InputHooks = {
  onPause: () => void;
  onAnyInput: () => void;
  /** the shell handles taps on overlays itself; input is suspended then */
  isBlocked: () => boolean;
};

const TAP_MS = 190;
const TAP_PX = 14;

export class Input {
  private keys = new Set<string>();
  private primary = -1;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private shipX = 0;
  private shipY = 0;
  private moved = 0;
  private readonly off: (() => void)[] = [];

  constructor(
    private readonly el: HTMLElement,
    private readonly w: World,
    private readonly hooks: InputHooks,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(
      t: HTMLElement | Window | Document,
      k: K | string,
      f: (e: never) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      t.addEventListener(k, f as EventListener, opts);
      this.off.push(() => t.removeEventListener(k, f as EventListener, opts));
    };

    on(el, "pointerdown", (e: PointerEvent) => this.down(e), { passive: false });
    on(el, "pointermove", (e: PointerEvent) => this.move(e), { passive: false });
    on(el, "pointerup", (e: PointerEvent) => this.up(e));
    on(el, "pointercancel", (e: PointerEvent) => this.up(e));
    on(el, "contextmenu", (e: Event) => e.preventDefault());
    on(window, "keydown", (e: KeyboardEvent) => this.key(e, true));
    on(window, "keyup", (e: KeyboardEvent) => this.key(e, false));
    on(window, "blur", () => this.keys.clear());
  }

  dispose(): void {
    for (const f of this.off) f();
    this.off.length = 0;
  }

  private frame(): { f: ReturnType<typeof fit>; w: number; h: number; rect: DOMRect } {
    const rect = this.el.getBoundingClientRect();
    return { f: fit(rect.width, rect.height, this.w.halfH), w: rect.width, h: rect.height, rect };
  }

  private down(e: PointerEvent): void {
    this.hooks.onAnyInput();
    if (this.hooks.isBlocked()) return;
    e.preventDefault();
    if (e.pointerType === "mouse") {
      if (e.button === 2) release(this.w);
      else flip(this.w);
      return;
    }
    if (this.primary !== -1) {
      // a second finger is the flip, so you never have to stop flying
      flip(this.w);
      return;
    }
    this.primary = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    const { f, w: cw, h: ch, rect } = this.frame();
    this.downX = toWorldX(e.clientX - rect.left, cw, f);
    this.downY = toWorldY(e.clientY - rect.top, ch, f);
    this.shipX = this.w.px;
    this.shipY = this.w.py;
    this.downAt = performance.now();
    this.moved = 0;
    this.w.pointing = true;
    this.w.tx = this.w.px;
    this.w.ty = this.w.py;
  }

  private move(e: PointerEvent): void {
    if (this.hooks.isBlocked()) return;
    const { f, w: cw, h: ch, rect } = this.frame();
    const wx = toWorldX(e.clientX - rect.left, cw, f);
    const wy = toWorldY(e.clientY - rect.top, ch, f);
    if (e.pointerType === "mouse") {
      this.w.pointing = true;
      this.w.tx = wx;
      this.w.ty = wy;
      return;
    }
    if (e.pointerId !== this.primary) return;
    e.preventDefault();
    const dx = wx - this.downX;
    const dy = wy - this.downY;
    this.moved = Math.max(this.moved, Math.hypot(dx, dy) * f.scale);
    // slight gain so the far corners are reachable without a full-screen swipe
    this.w.tx = this.shipX + dx * 1.18;
    this.w.ty = this.shipY + dy * 1.18;
  }

  private up(e: PointerEvent): void {
    if (e.pointerId !== this.primary) return;
    this.primary = -1;
    const quick = performance.now() - this.downAt < TAP_MS && this.moved < TAP_PX;
    if (quick && !this.hooks.isBlocked()) flip(this.w);
    // the ship holds its last position rather than snapping anywhere
    this.w.tx = this.w.px;
    this.w.ty = this.w.py;
  }

  private key(e: KeyboardEvent, down: boolean): void {
    const c = e.code;
    if (down) this.hooks.onAnyInput();
    const nav =
      c === "ArrowLeft" ||
      c === "ArrowRight" ||
      c === "ArrowUp" ||
      c === "ArrowDown" ||
      c === "KeyW" ||
      c === "KeyA" ||
      c === "KeyS" ||
      c === "KeyD" ||
      c === "Space";
    if (nav) e.preventDefault();
    if (down) {
      if (this.keys.has(c)) return;
      this.keys.add(c);
      if (this.hooks.isBlocked()) return;
      if (c === "Space" || c === "KeyJ" || c === "KeyZ") flip(this.w);
      else if (c === "ShiftLeft" || c === "ShiftRight" || c === "KeyK" || c === "KeyX")
        release(this.w);
      else if (c === "KeyP" || c === "Escape") this.hooks.onPause();
    } else this.keys.delete(c);
  }

  /** Keyboard flight, integrated once per frame. */
  step(dt: number): void {
    const k = this.keys;
    const lx = (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0) - (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0);
    const ly = (k.has("ArrowUp") || k.has("KeyW") ? 1 : 0) - (k.has("ArrowDown") || k.has("KeyS") ? 1 : 0);
    if (lx === 0 && ly === 0) return;
    this.w.pointing = false;
    const m = Math.hypot(lx, ly) || 1;
    this.w.pvx += (lx / m) * PLAYER.accel * dt;
    this.w.pvy += (ly / m) * PLAYER.accel * dt;
    const sp = Math.hypot(this.w.pvx, this.w.pvy);
    if (sp > PLAYER.maxSpeed) {
      this.w.pvx = (this.w.pvx / sp) * PLAYER.maxSpeed;
      this.w.pvy = (this.w.pvy / sp) * PLAYER.maxSpeed;
    }
  }

  /** Called by the HUD pads. */
  static flip = flip;
  static release = release;
}
