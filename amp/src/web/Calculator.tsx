import { useEffect, useRef, useState } from "react";
import { evaluate, formatResult } from "../math/calculator";

const KEYS = [
  ["(", ")", "^", "√", "AC"],
  ["7", "8", "9", "÷", "⌫"],
  ["4", "5", "6", "×", "π"],
  ["1", "2", "3", "−", "±"],
  ["0", ".", "=", "+", "Use"],
] as const;

type Props = {
  close: () => void;
  /** Puts the current result into the answer field. */
  use: (value: string) => void;
};

/** A scientific calculator for problems that allow one (as the SAT does). It
 * sits over the answer area, leaving the question visible. */
export function Calculator(props: Props) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const display = useRef<HTMLInputElement>(null);
  useEffect(() => display.current?.focus({ preventScroll: true }), []);

  const preview = (() => {
    if (!expression) return "";
    try {
      return formatResult(evaluate(expression));
    } catch {
      return "";
    }
  })();
  function press(key: string) {
    setError(false);
    if (key === "AC") {
      setExpression("");
      setResult(null);
    } else if (key === "⌫") setExpression((e) => e.slice(0, -1));
    else if (key === "=") equals();
    else if (key === "Use") {
      const value = result ?? preview;
      if (value) props.use(value);
    } else if (key === "±") setExpression((e) => (e ? `-(${e})` : "-"));
    else {
      const text = key === "−" ? "-" : key === "√" ? "√(" : key;
      // Continue from the last result when an operator follows it.
      setExpression((e) =>
        result !== null && e === "" && /^[-+×÷^]$/.test(text)
          ? result + text
          : e + text,
      );
      setResult(null);
    }
  }
  function equals() {
    try {
      const value = formatResult(evaluate(expression));
      setResult(value);
      setExpression("");
    } catch {
      setError(true);
    }
  }
  return (
    <section className="calculator" aria-label="Calculator">
      <div className="calculator-head">
        <span>Calculator</span>
        <button
          className="dialog-close"
          aria-label="Close calculator"
          onClick={props.close}
        >
          ✕
        </button>
      </div>
      <div className={`calculator-display ${error ? "error" : ""}`}>
        <input
          ref={display}
          aria-label="Calculator expression"
          value={expression}
          placeholder={result ?? "0"}
          inputMode="none"
          onChange={(event) => {
            setExpression(event.target.value);
            setResult(null);
            setError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              equals();
            } else if (event.key === "Escape") props.close();
          }}
        />
        <output aria-live="polite">
          {error ? "Check the expression" : expression ? preview : result}
        </output>
      </div>
      <div className="calculator-keys">
        {KEYS.flat().map((key) => (
          <button
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
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </section>
  );
}
