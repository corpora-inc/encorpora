/**
 * The focus loop's keyboard dock. The stage is a fixed full-screen frame: the bar and the problem
 * never move, and only the answer dock rides up on a software keyboard.
 *
 * Platforms disagree about what a keyboard does to the page, so the layout reads one number, the
 * keyboard's overlap with the stage, from whatever the platform reports:
 * - Android: the shell (build.rs) overlays the keyboard on the page, so the WebView never resizes
 *   or pans, and reports the keyboard's height itself, every frame of the keyboard's own animation
 *   (`ahaKeyboard`). That number is the only source there; the viewports are not consulted.
 * - iOS WKWebView keeps the layout viewport and shrinks only the visual viewport.
 * - A WebView without the bridge may shrink the layout viewport itself (the window resizes).
 * - Desktop has no software keyboard; both viewports are equal.
 * The stage keeps the height it had before the keyboard opened, and the overlap is measured from
 * the bottom of that stage to the bottom of what is visible, so no case counts the keyboard twice.
 */

/** The Android shell's keyboard bridge (`build.rs` adds it to the generated MainActivity). */
export interface KeyboardBridge {
  /** The keyboard's current overlap with the bottom of the window, device px (0 when closed). */
  height(): number;
}
/** The shell calls this with the keyboard's height in device px on every animation frame, and with
 * `settled` once the keyboard has finished opening or closing. */
export type KeyboardListener = (devicePx: number, settled: boolean) => void;
declare global { interface Window { ahaKeyboard?: KeyboardBridge; __ahaKeyboard?: KeyboardListener } }
/** Window event fired when the Android keyboard has finished opening or closing. */
export const KEYBOARD_SETTLED = "aha-keyboard-settled";

export interface ViewportSample {
  /** window.innerHeight / innerWidth: the layout viewport. */
  layoutHeight: number;
  layoutWidth: number;
  /** visualViewport height and offsetTop (the layout viewport when visualViewport is missing). */
  visualHeight: number;
  visualOffsetTop: number;
  /** A text field has focus. A software keyboard is only ever up while one does. */
  editing: boolean;
  /** The keyboard's overlap with the window, CSS px, from the Android shell's bridge. Undefined
   * where there is no bridge (iOS, desktop, a browser). */
  native?: number;
}

export interface KeyboardLayout {
  /** Height of the fixed stage, CSS px. */
  stage: number;
  /** How much of the stage's bottom the keyboard covers, CSS px (0 when closed). The answer dock
   * lives in the stage and lifts by this. */
  keyboard: number;
  /** How much of the layout viewport's bottom the keyboard covers. Sheets and dialogs are anchored
   * to the viewport, not the stage, and lift by this: on Android the viewport already ends at the
   * keyboard (0), on iOS it runs under it (the same as `keyboard`). */
  viewport: number;
  /** Layout width the stage height belongs to. A new width (rotation, window resize) starts over. */
  width: number;
}

/** Smaller differences are rounding between the two viewports (fractional device pixels), not a
 * keyboard. The smallest real one, iPad's shortcut bar over a hardware keyboard, is ~55px. */
export const MIN_KEYBOARD_PX = 24;

export function nextKeyboardLayout(previous: KeyboardLayout | undefined, sample: ViewportSample): KeyboardLayout {
  if (sample.native !== undefined) {
    // The keyboard overlays an unchanged WebView, so the stage is the window and the keyboard covers
    // the stage and the viewport alike. Every frame passes through, with no minimum (the dock follows
    // the keyboard all the way down) and regardless of focus (the keyboard is still sliding away
    // after the field blurs).
    const keyboard = Math.max(0, Math.round(sample.native));
    return { stage: Math.round(sample.layoutHeight), keyboard, viewport: keyboard, width: sample.layoutWidth };
  }
  const sameWidth = previous !== undefined && Math.abs(previous.width - sample.layoutWidth) < 1;
  // While editing, a shrinking layout viewport is the keyboard (Android), not a smaller stage.
  const stage = sample.editing && sameWidth ? Math.max(previous.stage, sample.layoutHeight) : sample.layoutHeight;
  const visibleBottom = Math.min(sample.layoutHeight, sample.visualOffsetTop + sample.visualHeight);
  const keyboard = (overlap: number) => (sample.editing && overlap >= MIN_KEYBOARD_PX ? overlap : 0);
  return {
    stage: Math.round(stage),
    keyboard: keyboard(Math.round(stage - visibleBottom)),
    viewport: keyboard(Math.round(sample.layoutHeight - visibleBottom)),
    width: sample.layoutWidth,
  };
}

/** Text fields: the elements a software keyboard serves. A read-only one counts (a field turns
 * read-only for a moment while an answer saves, and its keyboard stays up); whether a keyboard is
 * actually showing is read from the viewport, never assumed. */
export function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.disabled;
  if (el instanceof HTMLInputElement) {
    return !el.disabled && !/^(button|checkbox|color|file|hidden|image|radio|range|reset|submit)$/.test(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

export function sampleViewport(win: Window = window, native?: number): ViewportSample {
  const vv = win.visualViewport;
  return {
    layoutHeight: win.innerHeight,
    layoutWidth: win.innerWidth,
    visualHeight: vv?.height ?? win.innerHeight,
    visualOffsetTop: vv?.offsetTop ?? 0,
    editing: isEditable(win.document.activeElement),
    native,
  };
}

interface KeyboardHost {
  ahaKeyboard?: KeyboardBridge;
  __ahaKeyboard?: KeyboardListener;
  devicePixelRatio: number;
}

/**
 * Follows the Android shell's keyboard, in CSS px. Calls `onChange` at once with the current height,
 * then on every frame the shell reports. Returns the unsubscribe function, or undefined when the host
 * has no bridge (the caller then reads the viewports instead).
 */
export function listenNativeKeyboard(host: KeyboardHost, onChange: (cssPx: number, settled: boolean) => void): (() => void) | undefined {
  const bridge = host.ahaKeyboard;
  if (!bridge) return undefined;
  const css = (devicePx: number) => (Number.isFinite(devicePx) ? Math.max(0, devicePx) : 0) / (host.devicePixelRatio || 1);
  const listener: KeyboardListener = (devicePx, settled) => onChange(css(devicePx), settled);
  host.__ahaKeyboard = listener;
  onChange(css(bridge.height()), true);
  return () => { if (host.__ahaKeyboard === listener) delete host.__ahaKeyboard; };
}
