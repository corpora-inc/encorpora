import { COLS, ROWS, idx } from "./core/rules.ts";
import type { Game } from "./game.ts";
import { colAt, type Layout } from "./layout.ts";

/**
 * Two input designs, not one ported to the other.
 *
 * Touch: press anywhere and the chip follows your thumb across columns with a
 * live landing ghost; lift to slam. Your thumb never covers the chip because
 * the chip is at the top and your hand is at the bottom.
 *
 * Desktop: the chip tracks the mouse with no button held, click to slam, and
 * the whole game is playable from the keyboard — arrows or 1-6 to pick a
 * column, space to drop, so a fast player never touches the mouse.
 */

export type InputBinding = { dispose(): void };

function hit(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * `suspended` is the how-to-play panel being open.
 *
 * The panel's scrim swallows pointer events, but the keyboard is bound to
 * `window` and does not care what is on top of the canvas: without this, Space
 * and Enter drop a chip instead of pressing the panel's PLAY button — they are
 * `preventDefault`ed here before the button ever sees them — and `R` silently
 * restarts the run from behind a page of rules.
 */
export function bindInput(
  canvas: HTMLCanvasElement,
  game: Game,
  getLayout: () => Layout | null,
  suspended: () => boolean,
): InputBinding {
  let aiming = false;
  let pointerId = -1;

  const local = (e: PointerEvent): { x: number; y: number } => {
    const b = canvas.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };

  const boardCell = (l: Layout, x: number, y: number): { r: number; c: number } | null => {
    const c = Math.floor((x - l.boardX) / l.cell);
    const r = Math.floor((y - l.boardY) / l.cell);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { r, c };
  };

  const onDown = (e: PointerEvent) => {
    if (suspended()) return;
    const l = getLayout();
    if (!l) return;
    const { x, y } = local(e);
    game.audio.resume();

    if (hit(x, y, l.soundX, l.soundY, l.soundR + 10)) {
      game.toggleSound();
      return;
    }

    if (game.phase === "breach") {
      if (game.pt > 0.55) game.reset();
      return;
    }

    if (game.phase === "resonance") {
      const cell = boardCell(l, x, y);
      if (cell) game.pickCell(cell.r, cell.c);
      return;
    }

    if (hit(x, y, l.keyX, l.keyY, l.keyR * 1.5)) {
      game.pokeReactor();
      return;
    }

    if (game.phase === "aim") {
      aiming = true;
      pointerId = e.pointerId;
      // Capture keeps the drag alive when the finger leaves the canvas. It
      // throws on a pointer the browser no longer considers active, and losing
      // the drop to that would be unforgivable.
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture is an optimisation, not a requirement */
      }
      game.moveTo(colAt(l, x));
    }
  };

  const onMove = (e: PointerEvent) => {
    if (suspended()) return;
    const l = getLayout();
    if (!l || game.phase !== "aim") return;
    const { x, y } = local(e);
    if (aiming && e.pointerId === pointerId) {
      game.moveTo(colAt(l, x));
      return;
    }
    // hover-aim, mouse only: a finger resting on the glass must not move the chip
    if (e.pointerType === "mouse" && y > l.boardY - l.cell * 2) game.moveTo(colAt(l, x));
  };

  const onUp = (e: PointerEvent) => {
    // The drag state is always released, even suspended — a pointer that came
    // up while the manual was opening must not leave the game aiming forever.
    if (!aiming || e.pointerId !== pointerId) return;
    aiming = false;
    pointerId = -1;
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    if (!suspended() && game.phase === "aim") game.drop();
  };

  const onCancel = () => {
    aiming = false;
    pointerId = -1;
  };

  const onKey = (e: KeyboardEvent) => {
    if (suspended()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    game.audio.resume();

    if (game.phase === "breach") {
      if (k === " " || k === "Enter" || k === "r" || k === "R") {
        e.preventDefault();
        if (game.pt > 0.55) game.reset();
      }
      return;
    }

    if (game.phase === "resonance") {
      if (k >= "1" && k <= "6") {
        e.preventDefault();
        pickColumnTop(game, Number(k) - 1);
      }
      return;
    }

    switch (k) {
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        game.nudge(-1);
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        game.nudge(1);
        break;
      case " ":
      case "Enter":
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        game.drop();
        break;
      case "e":
      case "E":
      case "Shift":
        e.preventDefault();
        game.pokeReactor();
        break;
      case "m":
      case "M":
        game.toggleSound();
        break;
      case "r":
      case "R":
        game.reset();
        break;
      default:
        if (k >= "1" && k <= "6") {
          e.preventDefault();
          game.moveTo(Number(k) - 1);
          game.drop();
        }
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
  window.addEventListener("keydown", onKey);
  const stopScroll = (e: Event) => e.preventDefault();
  canvas.addEventListener("touchstart", stopScroll, { passive: false });
  canvas.addEventListener("touchmove", stopScroll, { passive: false });

  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", stopScroll);
      canvas.removeEventListener("touchmove", stopScroll);
    },
  };
}

/** keyboard route into resonance: pick the topmost chip in a column */
export function pickColumnTop(game: Game, c: number): void {
  for (let r = 0; r < ROWS; r++) {
    if (game.board[idx(r, c)]) {
      game.pickCell(r, c);
      return;
    }
  }
}
