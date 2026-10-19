import { useLayoutEffect, useRef, type RefObject } from "react";

/** A text field's value and selection. A collapsed selection is the caret. */
export interface Field {
  value: string;
  start: number;
  end: number;
}

/** The value after an on-screen key, and where the caret goes. */
export interface Edited {
  value: string;
  caret: number;
}

/** Inserts `text` at the caret, replacing any selection. */
export function insertText(field: Field, text: string): Edited {
  return {
    value:
      field.value.slice(0, field.start) + text + field.value.slice(field.end),
    caret: field.start + text.length,
  };
}

/** Deletes the selection, or else the character before the caret. */
export function deleteBackward(field: Field): Edited {
  const from =
    field.start === field.end ? Math.max(0, field.start - 1) : field.start;
  return {
    value: field.value.slice(0, from) + field.value.slice(field.end),
    caret: from,
  };
}

export function clearField(): Edited {
  return { value: "", caret: 0 };
}

/** An answer's sign: adds or removes one leading minus. The caret stays
 * beside the same digit. */
export function toggleLeadingMinus(field: Field): Edited {
  const negative = field.value.startsWith("-");
  const shift = negative ? -1 : 1;
  const value = negative ? field.value.slice(1) : `-${field.value}`;
  return { value, caret: clamp(field.start + shift, 0, value.length) };
}

/** A calculator's ±: negates the whole expression. A number gains or loses
 * its minus; anything else is wrapped as −(…), and pressing again unwraps it.
 * The caret stays beside the same character. */
export function negateExpression(field: Field): Edited {
  const { value } = field;
  if (!value) return { value: "-", caret: 1 };
  if (wrappedNegation(value)) {
    const inner = value.slice(2, -1);
    return { value: inner, caret: clamp(field.start - 2, 0, inner.length) };
  }
  if (/^-?(\d*\.?\d+|\d+\.|π)$/.test(value)) return toggleLeadingMinus(field);
  return { value: `-(${value})`, caret: field.start + 2 };
}

/** True for `-(…)` whose first bracket closes at the very end. */
function wrappedNegation(value: string): boolean {
  if (!value.startsWith("-(") || !value.endsWith(")")) return false;
  let depth = 0;
  for (let i = 1; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")" && --depth === 0) return i === value.length - 1;
  }
  return false;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** Reads an input's selection, clamped to `value`. With no input, the caret
 * is at the end. */
export function readField(
  input: HTMLInputElement | null,
  value: string,
): Field {
  const length = value.length;
  const a = clamp(input?.selectionStart ?? length, 0, length);
  const b = clamp(input?.selectionEnd ?? a, 0, length);
  return { value, start: Math.min(a, b), end: Math.max(a, b) };
}

function placeCaret(input: HTMLInputElement | null, caret: number) {
  if (!input) return;
  input.focus({ preventScroll: true });
  input.setSelectionRange(caret, caret);
  revealCaret(input, caret);
}

/** Chrome does not scroll a long value to a caret set by script, so the
 * newest digit could sit out of view. Scroll the field just enough. */
function revealCaret(input: HTMLInputElement, caret: number) {
  if (input.scrollWidth <= input.clientWidth) return;
  const style = getComputedStyle(input);
  const mirror = document.createElement("span");
  mirror.textContent = input.value.slice(0, caret);
  mirror.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;white-space:pre";
  for (const property of [
    "font-family",
    "font-size",
    "font-weight",
    "font-variant-numeric",
    "letter-spacing",
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property));
  document.body.append(mirror);
  const left = Number.parseFloat(style.paddingLeft);
  const right = Number.parseFloat(style.paddingRight);
  // The caret's offset in the scrolled content, which includes the padding.
  const x = left + mirror.getBoundingClientRect().width;
  mirror.remove();
  if (x - left < input.scrollLeft) input.scrollLeft = x - left;
  else if (x + right > input.scrollLeft + input.clientWidth)
    input.scrollLeft = x + right - input.clientWidth;
}

/**
 * On-screen keys that edit a controlled input where its caret is. `read`
 * gives the current value and selection; `commit` stores the edit and puts
 * focus and the caret back in the field, both now and after React writes the
 * new value (which would otherwise move the caret to the end).
 */
export function useKeypadCaret(input: RefObject<HTMLInputElement | null>) {
  const pending = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pending.current === null) return;
    placeCaret(input.current, pending.current);
    pending.current = null;
  });
  return {
    read: (value: string) => readField(input.current, value),
    commit(edit: Edited, set: (value: string) => void) {
      if (input.current && edit.value !== input.current.value)
        pending.current = edit.caret;
      set(edit.value);
      placeCaret(input.current, edit.caret);
    },
  };
}
