import { useEffect, useRef, useState } from "react";
import { evaluate, formatResult } from "../math/calculator";
import {
  clearField,
  insertText,
  deleteBackward,
  negateExpression,
  useKeypadCaret,
  type Field,
} from "./lib/keypadEdit";

const KEYS = [
  ["(", ")", "^", "√", "AC"],
  ["7", "8", "9", "÷", "⌫"],
  ["4", "5", "6", "×", "π"],
  ["1", "2", "3", "−", "±"],
  ["0", ".", "=", "+", "Use"],
] as const;

/** How the calculator was dismissed: a tap or click outside, or a key. */
export type CalculatorDismissal = "pointer" | "keyboard";

type Props = {
  close: (via: CalculatorDismissal) => void;
  /** Puts the current result into the answer field. */
  use: (value: string) => void;
};

/** A touch browser hit-tests a tap's click after the calculator has already
 * closed on pointerdown, so a tap outside would also press whatever lies
 * beneath. Swallow that one click: a tap outside only closes the calculator. */
function swallowNextClick() {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    release();
  };
  const release = () => {
    window.removeEventListener("click", swallow, true);
    window.clearTimeout(timer);
  };
  window.addEventListener("click", swallow, true);
  const timer = window.setTimeout(release, 700);
}

/** A scientific calculator for problems that allow one (as the SAT does). It
 * sits over the answer area, leaving the question visible. A tap outside or
 * Escape closes it. */
export function Calculator(props: Props) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const display = useRef<HTMLInputElement>(null);
  const caret = useKeypadCaret(display);
  const close = useRef(props.close);
  close.current = props.close;
  useEffect(() => display.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    function pointerDown(event: PointerEvent) {
      if (panel.current?.contains(event.target as Node)) return;
      // No focus change or text selection under the calculator either.
      event.preventDefault();
      swallowNextClick();
      // A pointer dismissal hands focus back without a keyboard focus ring.
      if (
        document.activeElement instanceof HTMLElement &&
        panel.current?.contains(document.activeElement)
      )
        document.activeElement.blur();
      close.current("pointer");
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      close.current("keyboard");
    }
    document.addEventListener("pointerdown", pointerDown, true);
    document.addEventListener("keydown", keyDown);
    return () => {
      document.removeEventListener("pointerdown", pointerDown, true);
      document.removeEventListener("keydown", keyDown);
    };
  }, []);

  const preview = (() => {
    if (!expression) return "";
    try {
      return formatResult(evaluate(expression));
    } catch {
      return "";
    }
  })();
  /** After =, the next operator or ± continues from the result. */
  const continuing = (): Field | null =>
    result !== null && expression === ""
      ? { value: result, start: result.length, end: result.length }
      : null;
  function press(key: string) {
    setError(false);
    const field = caret.read(expression);
    if (key === "AC") {
      setResult(null);
      caret.commit(clearField(), setExpression);
    } else if (key === "⌫") caret.commit(deleteBackward(field), setExpression);
    else if (key === "=") equals();
    else if (key === "Use") {
      const value = result ?? preview;
      if (value) props.use(value);
    } else if (key === "±") {
      caret.commit(negateExpression(continuing() ?? field), setExpression);
      setResult(null);
    } else {
      const text = key === "−" ? "-" : key === "√" ? "√(" : key;
      const from = /^[-+×÷^]$/.test(text) ? continuing() : null;
      caret.commit(insertText(from ?? field, text), setExpression);
      setResult(null);
    }
  }
  function equals() {
    try {
      const value = formatResult(evaluate(expression));
      setResult(value);
      caret.commit(clearField(), setExpression);
    } catch {
      setError(true);
    }
  }
  return (
    <section className="calculator" aria-label="Calculator" ref={panel}>
      <button
        type="button"
        className="calculator-close"
        aria-label="Close calculator"
        onClick={() => close.current("keyboard")}
      >
        ✕
      </button>
      <div className="calculator-display" data-error={error || undefined}>
        <input
          ref={display}
          aria-label="Calculator expression"
          value={expression}
          placeholder={result ?? "0"}
          inputMode="none"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setExpression(event.target.value);
            setResult(null);
            setError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              equals();
            }
          }}
        />
        <output aria-live="polite">
          {error ? "Check the expression" : expression ? preview : result}
        </output>
      </div>
      <div className="calculator-keys">
        {KEYS.flat().map((key) => (
          <button
            type="button"
            key={key}
            className={
              key === "="
                ? "equals"
                : key === "Use"
                  ? "use"
                  : /^[\d.]$/.test(key)
                    ? "digit"
                    : "operator"
            }
            aria-label={
              {
                "^": "power",
                "√": "square root",
                "⌫": "delete",
                "±": "negate",
                AC: "clear",
                Use: "Use result as answer",
              }[key as string] ?? key
            }
            // Keys keep focus, and the caret, in the expression.
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </section>
  );
}
