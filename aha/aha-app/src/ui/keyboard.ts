/**
 * The focus loop's keyboard dock. The stage is a fixed full-screen frame: the bar and the problem
 * never move, and only the answer dock rides up on a software keyboard.
 *
 * Platforms disagree about what a keyboard does to the page, so the layout reads one number, the
 * keyboard's overlap with the stage, from whatever the platform reports:
 * - iOS WKWebView keeps the layout viewport and shrinks only the visual viewport.
 * - Android WebView usually shrinks the layout viewport itself (the window resizes).
 * - Desktop has no software keyboard; both viewports are equal.
 * The stage keeps the height it had before the keyboard opened, and the overlap is measured from
 * the bottom of that stage to the bottom of what is visible, so no case counts the keyboard twice.
 */

export interface ViewportSample {
  /** window.innerHeight / innerWidth: the layout viewport. */
  layoutHeight: number;
  layoutWidth: number;
  /** visualViewport height and offsetTop (the layout viewport when visualViewport is missing). */
  visualHeight: number;
  visualOffsetTop: number;
  /** A text field has focus. A software keyboard is only ever up while one does. */
  editing: boolean;
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

export function sampleViewport(win: Window = window): ViewportSample {
  const vv = win.visualViewport;
  return {
    layoutHeight: win.innerHeight,
    layoutWidth: win.innerWidth,
    visualHeight: vv?.height ?? win.innerHeight,
    visualOffsetTop: vv?.offsetTop ?? 0,
    editing: isEditable(win.document.activeElement),
  };
}
