import { useEffect, useId, useState } from "react";
import {
  emptyEqualAddends,
  parseEqualAddends,
  normalizeEqualAddends,
  equalAddendsAnswerText,
  type EqualAddendsDraft,
  type EqualAddendsResponse,
} from "../math/equal-addends";
import {
  CounterObject,
  CounterSign,
  NumberSentence,
  NumberTilePad,
} from "./NumberSentence";

export function EqualAddendsInput({
  response: r,
  value,
  onChange,
  locked,
  resolved,
}: {
  response: EqualAddendsResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  resolved: boolean;
}) {
  const a = parseEqualAddends(r, value) ?? emptyEqualAddends(r);
  const [selected, select] = useState(0);
  const [direction, setDirection] = useState<"rows" | "columns">(
    r.orientation === "columns" ? "columns" : "rows",
  );
  const [group, setGroup] = useState<number | null>(null);
  useEffect(() => {
    if (!value) {
      select(0);
      setGroup(null);
      setDirection(r.orientation === "columns" ? "columns" : "rows");
    }
  }, [value, r.orientation]);
  const id = useId();
  const slot = Math.min(selected, a.addends.length);
  const totalSelected = slot === a.addends.length;
  const chosen = a.addends.find((n) => n !== null);
  function update(next: EqualAddendsDraft) {
    if (!locked) onChange(JSON.stringify(next));
  }
  function setSize(key: "rows" | "columns", n: number) {
    if (locked || r.mode !== "build") return;
    setGroup(null);
    update({ ...a, [key]: n });
  }
  function number(n: number) {
    if (locked) return;
    if (totalSelected) {
      const total = (a.total ?? 0) * 10 + n;
      if (total <= 99) update({ ...a, total });
    } else if (n >= 1 && n <= 5 && (chosen == null || n === chosen)) {
      const addends = [...a.addends];
      addends[slot] = n;
      update({ ...a, addends });
      select(Math.min(slot + 1, addends.length));
    }
  }
  function remove() {
    if (locked) return;
    if (totalSelected)
      update({
        ...a,
        total:
          a.total === null || a.total < 10 ? null : Math.floor(a.total / 10),
      });
    else {
      const addends = [...a.addends];
      addends[slot] = null;
      update({ ...a, addends });
    }
  }
  function resizeSentence(delta: number) {
    if (locked || a.addends.length + delta < 1 || a.addends.length + delta > 5)
      return;
    const addends = delta > 0 ? [...a.addends, null] : a.addends.slice(0, -1);
    update({ ...a, addends });
    select(addends.length - 1);
  }
  function tapGroup(index: number) {
    if (locked) return;
    setGroup(index);
    const n = direction === "rows" ? a.columns : a.rows;
    const changedValue = chosen != null && chosen !== n;
    const addends = changedValue ? a.addends.map(() => null) : [...a.addends];
    const blank = addends.indexOf(null);
    if (blank >= 0) {
      addends[blank] = n;
      select(Math.min(blank + 1, addends.length));
    } else if (addends.length < 5) {
      addends.push(n);
      select(addends.length);
    }
    update({ ...a, addends, total: changedValue ? null : a.total });
  }
  const stepper = (key: "rows" | "columns", label: string) => (
    <div className="equal-stepper" role="group" aria-label={label}>
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Fewer ${key}`}
        disabled={locked || a[key] === 1}
        onClick={() => setSize(key, a[key] - 1)}
      >
        <CounterSign sign="-" />
      </button>
      <output aria-label={`${label} count`}>{a[key]}</output>
      <button
        type="button"
        aria-label={`More ${key}`}
        disabled={locked || a[key] === 5}
        onClick={() => setSize(key, a[key] + 1)}
      >
        <CounterSign sign="+" />
      </button>
    </div>
  );
  return (
    <section
      className="counter-builder equal-addends"
      data-mode={r.mode}
      data-resolved={resolved}
      aria-labelledby={`${id}-label`}
    >
      <h3 className="sr-only" id={`${id}-label`}>
        {r.label}
      </h3>
      <div className="equal-array-tools">
        {r.mode === "build" ? (
          <>
            {stepper("rows", "Rows")}
            {stepper("columns", "Columns")}
          </>
        ) : (
          <div
            className="equal-directions"
            role="group"
            aria-label="Group the array"
          >
            {(["rows", "columns"] as const).map((d) => (
              <button
                type="button"
                key={d}
                aria-pressed={!resolved && direction === d}
                disabled={
                  locked || (r.orientation !== "either" && r.orientation !== d)
                }
                title={`Start a sum using ${d}`}
                onClick={() => {
                  if (direction !== d) {
                    setDirection(d);
                    setGroup(null);
                    select(0);
                    update({ ...a, addends: [null, null], total: null });
                  }
                }}
              >
                {d === "rows" ? "Rows →" : "Columns ↓"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="equal-array-area">
        <div
          className="equal-array"
          role="group"
          aria-label={`${a.rows} ${a.rows === 1 ? "row" : "rows"} of ${a.columns} ${r.thing}s`}
        >
          {Array.from({ length: 25 }, (_, i) => (
            <span className="equal-object" key={i}>
              {Math.floor(i / 5) < a.rows && i % 5 < a.columns && (
                <CounterObject thing={r.thing} />
              )}
            </span>
          ))}
          {r.mode === "given" &&
            Array.from(
              { length: direction === "rows" ? a.rows : a.columns },
              (_, i) => (
                <button
                  type="button"
                  className="equal-group"
                  key={`${direction}-${i}`}
                  disabled={locked}
                  data-outlined={group === i}
                  aria-pressed={!resolved && group === i}
                  aria-label={`Add ${direction === "rows" ? "row" : "column"} ${i + 1}: ${direction === "rows" ? a.columns : a.rows} ${r.thing}s`}
                  style={
                    direction === "rows"
                      ? {
                          left: 0,
                          top: i * 44,
                          width: a.columns * 44,
                          height: 44,
                        }
                      : { left: i * 44, top: 0, width: 44, height: a.rows * 44 }
                  }
                  onClick={() => tapGroup(i)}
                />
              ),
            )}
        </div>
      </div>
      <p className="equal-instruction">
        {r.mode === "given"
          ? `Tap a ${direction === "rows" ? "row" : "column"} to add its count.`
          : "Rows go across. Columns go down."}
      </p>
      <NumberSentence
        selected={slot}
        onSelect={select}
        locked={locked}
        resolved={resolved}
        slots={[
          ...a.addends.map((value, i) => ({
            value,
            label: `Addend ${i + 1}`,
            ...(i ? { prefix: "+" as const } : {}),
          })),
          { value: a.total, label: "Total", prefix: "=" },
        ]}
        onKeyDown={(key) => {
          if (/^\d$/.test(key)) {
            number(Number(key));
            return true;
          }
          if (key === "Backspace" || key === "Delete") {
            if (totalSelected || a.addends.length === 1) remove();
            else resizeSentence(-1);
            return true;
          }
          if (key === "+") {
            resizeSentence(1);
            return true;
          }
          if (key === "Escape") {
            select(0);
            return true;
          }
          return false;
        }}
      />
      <div
        className="equal-count-tools"
        role="group"
        aria-label="Number of addends"
        aria-hidden={resolved || undefined}
      >
        <span>Addends</span>
        <div className="counter-signs">
          <button
            type="button"
            disabled={locked || a.addends.length === 1}
            aria-label="Remove last addend"
            onClick={() => resizeSentence(-1)}
          >
            <CounterSign sign="-" />
          </button>
          <button
            type="button"
            disabled={locked || a.addends.length === 5}
            aria-label="Add another addend"
            onClick={() => resizeSentence(1)}
          >
            <CounterSign sign="+" />
          </button>
        </div>
      </div>
      <NumberTilePad
        numbers={[1, 2, 3, 4, 5, 6, 7, 8, 9, 0]}
        onNumber={number}
        locked={locked}
        resolved={resolved}
        disabledNumber={(n) =>
          totalSelected
            ? (a.total ?? 0) * 10 + n > 99
            : n < 1 || n > 5 || (chosen != null && n !== chosen)
        }
        trailing={
          <button
            type="button"
            className="counter-ten"
            aria-label="Erase selected number"
            disabled={
              locked ||
              (totalSelected ? a.total === null : a.addends[slot] === null)
            }
            onClick={remove}
          >
            ⌫
          </button>
        }
      />
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {equalAddendsAnswerText(r, JSON.stringify(a))}
      </span>
    </section>
  );
}

export function EqualAddendsAnswerControls({
  response,
  value,
  onChange,
  locked,
  sending,
  submit,
}: {
  response: EqualAddendsResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  sending: boolean;
  submit: () => void;
}) {
  const complete = normalizeEqualAddends(response, value) !== null;
  const empty = !value || value === JSON.stringify(emptyEqualAddends(response));
  return (
    <form
      className="counter-builder-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked && complete) submit();
      }}
    >
      <button
        className="secondary"
        type="button"
        disabled={locked || empty}
        onClick={() => onChange("")}
      >
        Reset
      </button>
      <button
        className="choice-submit"
        type="submit"
        disabled={locked || !complete}
        aria-busy={sending}
      >
        Check
      </button>
    </form>
  );
}
