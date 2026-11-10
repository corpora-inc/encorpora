import { useEffect, useId, useRef, useState } from "react";
import {
  counterBuilderAnswerText,
  emptyCounterBuilder,
  normalizeCounterBuilder,
  parseCounterBuilder,
  type CounterBuilderDraft,
  type CounterBuilderResponse,
} from "../math/counter-builder";
import {
  CounterObject,
  CounterSign,
  NumberSentence,
  NumberTilePad,
  spokenNumberTile as spoken,
} from "./NumberSentence";

const slotNames = [
  "First number",
  "Plus or minus",
  "Second number",
  "Number after equals",
];
export function CounterBuilderInput({
  response: r,
  value,
  onChange,
  locked,
  resolved,
  skipped,
}: {
  response: CounterBuilderResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  resolved: boolean;
  skipped?: boolean;
}) {
  const a = parseCounterBuilder(r, value) ?? emptyCounterBuilder(r);
  const total = a.groups.reduce((sum, n) => sum + n, 0);
  const [slot, setSlot] = useState(0);
  const [color, setColor] = useState(0);
  const [announcement, announce] = useState("");
  // Which particular objects were crossed out is local drawing state. Only
  // the count matters mathematically, so the transport never grades position.
  const [crossed, setCrossed] = useState<Set<number>>(new Set());
  const shownCrosses =
    crossed.size === a.removed && [...crossed].every((i) => i < total)
      ? crossed
      : new Set(Array.from({ length: a.removed }, (_, i) => total - 1 - i));
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const [cursor, setCursor] = useState([0, 0]);
  const id = useId();
  const empty =
    total === 0 && a.removed === 0 && a.sentence.every((v) => v === null);
  useEffect(() => {
    if (!empty) return;
    setSlot(0);
    setColor(0);
    setCrossed(new Set());
    setCursor([0, 0]);
    announce(
      `Board reset. ${counterBuilderAnswerText(r, JSON.stringify(emptyCounterBuilder(r)))} Choose the first number.`,
    );
  }, [empty]);
  function update(next: CounterBuilderDraft, message: string) {
    onChange(JSON.stringify(next));
    announce(`${message} ${counterBuilderAnswerText(r, JSON.stringify(next))}`);
  }
  function add(group: number) {
    if (locked || total >= r.max) return;
    setColor(group);
    const groups = [...a.groups];
    groups[group] = groups[group]! + 1;
    update({ ...a, groups }, `Added one ${r.thing}.`);
  }
  function undo(group: number) {
    if (locked || a.groups[group] === 0) return;
    const groups = [...a.groups];
    groups[group]!--;
    const next = new Set(shownCrosses);
    next.delete(total - 1);
    setCrossed(next);
    update(
      { ...a, groups, removed: r.canRemove ? next.size : 0 },
      `Removed one ${r.thing}.`,
    );
  }
  function tap(group: number, index: number) {
    if (locked) return;
    if (r.canRemove && index < total) {
      const next = new Set(shownCrosses);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setCrossed(next);
      update(
        { ...a, removed: next.size },
        next.has(index) ? "Crossed out." : "Put back.",
      );
    } else if (r.board === "frame") {
      if (index < total) undo(index < a.groups[0]! ? 0 : 1);
      else add(color);
    } else if (index < a.groups[group]!) undo(group);
    else add(group);
  }
  function put(value: number | "+" | "-") {
    if (locked || (typeof value === "number" && slot === 1)) return;
    const sentence = [...a.sentence] as CounterBuilderDraft["sentence"];
    if (typeof value === "number") {
      if (slot === 0) sentence[0] = value;
      else if (slot === 2) sentence[2] = value;
      else sentence[3] = value;
    } else sentence[1] = value;
    const next =
      typeof value === "string" ? 2 : slot === 0 ? 1 : slot === 2 ? 3 : 3;
    setSlot(next);
    update({ ...a, sentence }, `${spoken(value)} placed. ${slotNames[next]}.`);
  }
  const board = (group: number) => (
    <div
      className="counter-cells"
      role="group"
      aria-label={
        r.canRemove
          ? "Starting group"
          : r.board === "frame"
            ? "Ten frame"
            : `Group ${group + 1}`
      }
    >
      {Array.from({ length: 10 }, (_, index) => {
        const placed =
          r.board === "two-groups" ? index < a.groups[group]! : index < total;
        const tint =
          r.board === "frame"
            ? placed
              ? index < a.groups[0]!
                ? 0
                : 1
              : color
            : group;
        const removed = placed && shownCrosses.has(index) && r.canRemove;
        const action = !placed
          ? `Add a ${r.thing}`
          : r.canRemove
            ? removed
              ? `Put back ${r.thing}`
              : `Cross out ${r.thing}`
            : `Remove a ${r.thing}`;
        const key = `${group}-${index}`;
        return (
          <button
            key={index}
            type="button"
            className="counter-cell"
            data-color={tint}
            data-placed={placed}
            data-crossed={removed}
            ref={(node) => {
              if (node) cells.current.set(key, node);
              else cells.current.delete(key);
            }}
            tabIndex={
              resolved
                ? -1
                : cursor[0] === group && cursor[1] === index
                  ? 0
                  : -1
            }
            aria-disabled={locked || (!placed && total === r.max)}
            aria-label={`${action}. Row ${Math.floor(index / 5) + 1}, column ${(index % 5) + 1}. ${r.canRemove ? `${total} at the start, ${a.removed} crossed out, ${total - a.removed} left` : `${a.groups[tint]} in group ${tint + 1}`}.`}
            onFocus={() => setCursor([group, index])}
            onClick={() => tap(group, index)}
            onKeyDown={(event) => {
              if (locked) return;
              if (event.key === "Delete" || event.key === "Backspace") {
                event.preventDefault();
                undo(r.board === "frame" ? tint : group);
                return;
              }
              if (!event.key.startsWith("Arrow")) return;
              event.preventDefault();
              const next =
                index +
                (event.key === "ArrowLeft"
                  ? -1
                  : event.key === "ArrowRight"
                    ? 1
                    : event.key === "ArrowUp"
                      ? -5
                      : 5);
              if (next >= 0 && next < 10)
                cells.current.get(`${group}-${next}`)?.focus();
            }}
          >
            {placed && <CounterObject thing={r.thing} />}
            {removed && (
              <svg
                className="counter-cross"
                viewBox="0 0 44 44"
                aria-hidden="true"
              >
                <path d="M7 7L37 37M7 37L37 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
  const groupControl = (group: number) => (
    <div className="counter-group-heading" data-color={group}>
      <span>
        <span className="counter-swatch" aria-hidden="true" />
        <strong>{r.canRemove ? "At the start" : `Group ${group + 1}`}</strong>
        <span className="counter-group-count">{a.groups[group]}</span>
      </span>
      <button
        type="button"
        disabled={locked || total === r.max}
        aria-label={`Add ${r.thing} to ${r.canRemove ? "starting group" : `group ${group + 1}`}. ${a.groups[group]} now.`}
        onClick={() => add(group)}
        onKeyDown={(event) => {
          if (["Delete", "Backspace"].includes(event.key)) {
            event.preventDefault();
            undo(group);
          }
        }}
      >
        <span aria-hidden="true">+</span> Add
      </button>
      <button
        type="button"
        className="counter-undo"
        disabled={locked || a.groups[group] === 0}
        aria-label={`Undo last ${r.thing} in ${r.canRemove ? "starting group" : `group ${group + 1}`}`}
        onClick={() => undo(group)}
      >
        ↶
      </button>
    </div>
  );
  return (
    <section
      className="counter-builder"
      data-resolved={resolved}
      aria-labelledby={`${id}-label`}
    >
      <h3 className="sr-only" id={`${id}-label`}>
        Show it with {r.thing}s
      </h3>
      <p className="counter-help" id={`${id}-help`}>
        {r.canRemove
          ? "Tap Add. Tap an object to cross it out or put it back."
          : "Tap Add. Tap an object to take it away."}
      </p>
      <div
        className="counter-boards"
        data-board={r.board}
        aria-describedby={`${id}-help`}
      >
        {r.board === "frame" ? (
          <div className="counter-region counter-frame">
            {board(0)}
            <div className="counter-frame-tools">
              {[0, 1].map((i) => (
                <div key={i}>{groupControl(i)}</div>
              ))}
            </div>
          </div>
        ) : (
          a.groups.map((_, i) => (
            <div className="counter-region" key={i}>
              {groupControl(i)}
              {board(i)}
            </div>
          ))
        )}
      </div>
      <p className="counter-total">
        {r.canRemove ? (
          <>
            <strong>{a.removed}</strong> crossed out ·{" "}
            <strong>{total - a.removed}</strong> left
          </>
        ) : (
          <>
            <strong>{total}</strong> in all
          </>
        )}
      </p>
      <NumberSentence
        slots={a.sentence.map((value, i) => ({
          value,
          label: slotNames[i]!,
          ...(i === 3 ? { prefix: "=" as const } : {}),
        }))}
        selected={slot}
        onSelect={setSlot}
        locked={locked}
        resolved={resolved}
      />
      <p className="counter-tile-help">
        {resolved
          ? skipped
            ? "One way to show the story."
            : "Your picture and sentence."
          : slot === 1
            ? "Choose plus or minus."
            : `Choose ${slot === 0 ? "the first number" : slot === 2 ? "the second number" : "the number after equals"}.`}
      </p>
      <NumberTilePad
        numbers={Array.from({ length: 11 }, (_, n) => n)}
        onNumber={put}
        locked={locked}
        resolved={resolved}
        disabledNumber={() => slot === 1}
        operators={(["+", "-"] as const).map((sign) => (
          <button
            type="button"
            key={sign}
            disabled={locked}
            onClick={() => put(sign)}
            aria-label={sign === "+" ? "Plus" : "Minus"}
          >
            <CounterSign sign={sign} />
          </button>
        ))}
      />
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement || counterBuilderAnswerText(r, JSON.stringify(a))}
      </span>
      <span className="sr-only">
        Use arrow keys to move between spaces. Enter or Space acts on a space.
        Delete undoes the last placement. Read each group size on its Add
        button.
        {r.board === "frame" &&
          " Empty spaces use the group you last added to."}
      </span>
    </section>
  );
}

export function CounterBuilderAnswer({
  response,
  value,
  onChange,
  locked,
  sending,
  submit,
}: {
  response: CounterBuilderResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  sending: boolean;
  submit: () => void;
}) {
  const complete = normalizeCounterBuilder(response, value) !== null;
  const a = parseCounterBuilder(response, value);
  const empty =
    !a ||
    (a.groups.every((n) => n === 0) && a.sentence.every((v) => v === null));
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
        onClick={() => onChange(JSON.stringify(emptyCounterBuilder(response)))}
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
