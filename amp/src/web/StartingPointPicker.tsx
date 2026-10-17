import React, { useLayoutEffect, useRef, useState } from "react";
import {
  startingBands,
  type StartingBand,
  type StartingPoint,
} from "../learning/starting-point";
import "./starting-point.css";

export const startingPointNames: Record<StartingBand, string> = {
  "K–2": "Early number",
  "3–5": "Groups & fractions",
  "6–8": "Ratios & pre-algebra",
  "9–12": "Algebra & functions",
};
const descriptions: Record<StartingBand, string> = {
  "K–2": "Count, add, shapes",
  "3–5": "Multiply, divide, fractions",
  "6–8": "Ratios, negatives, equations",
  "9–12": "Graphs, quadratics, functions",
};

export function StartingPointPicker({
  learnerId,
  api,
  onClose,
  onSaved,
}: {
  learnerId: string;
  api: <T>(path: string, body?: unknown) => Promise<T>;
  onClose: () => void;
  onSaved: (band: StartingBand) => void;
}) {
  const [current, setCurrent] = useState<StartingBand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<StartingBand | null>(null);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    alive.current = true;
    heading.current?.focus({ preventScroll: true });
    void api<StartingPoint>(`/learners/${learnerId}/starting-point`)
      .then((value) => {
        if (alive.current) setCurrent(value.band);
      })
      .catch(() => {
        if (alive.current)
          setError("Couldn’t load your saved choice. Choose one below.");
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
  }, []);
  async function save(band: StartingBand) {
    if (saving || loading) return;
    setSaving(band);
    setError("");
    try {
      await api<StartingPoint>(`/learners/${learnerId}/starting-point`, {
        band,
      });
      if (alive.current) onSaved(band);
    } catch {
      if (alive.current)
        setError("That choice was not saved. Please try again.");
    } finally {
      if (alive.current) setSaving(null);
    }
  }
  return (
    <main className="starting-point-workspace">
      <div className="starting-point-top">
        <button onClick={onClose}>← Back</button>
        <span className="eyebrow">YOUR FIRST STEP</span>
      </div>
      <section
        className="starting-point-content"
        aria-labelledby="starting-point-title"
        aria-busy={loading || !!saving}
      >
        <h1 id="starting-point-title" ref={heading} tabIndex={-1}>
          Where to begin?
        </h1>
        <p>
          Choose familiar ground. We’ll mix ideas and adjust as you practice.
        </p>
        <div className="starting-point-options">
          {startingBands.map((band, index) => (
            <button
              key={band}
              disabled={loading || !!saving}
              aria-pressed={current === band}
              onClick={() => void save(band)}
            >
              <span className="starting-point-mark" aria-hidden="true">
                {["●", "◒", "↗", "ƒ"][index]}
              </span>
              <span className="starting-point-copy">
                <strong>{startingPointNames[band]}</strong>
                <span>{descriptions[band]}</span>
                <small>{saving === band ? "Saving…" : `Grades ${band}`}</small>
              </span>
              {current === band && (
                <span className="starting-point-check" aria-label="Selected">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
        {error ? (
          <p className="starting-point-error" role="alert">
            {error}
          </p>
        ) : (
          <p className="starting-point-note">
            A preference, not a test. Your practice history is kept.
          </p>
        )}
      </section>
    </main>
  );
}
