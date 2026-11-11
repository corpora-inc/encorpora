import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { MathText, spokenMath } from "./MathText";
import { useTileDrag } from "./useTileDrag";
import { lineTex, parseLine } from "../math/expression";
import {
  checkEntry,
  draftOrder,
  draftRows,
  fieldMaxLength,
  fieldParseOptions,
  normalizeStructuredWork,
  numberTex,
  rowShape,
  serializeDraft,
  workProgress,
  type StructuredWorkResponse,
  type WorkField,
  type WorkRow,
} from "../math/structured-work";
import { deleteBackward, insertText, readField } from "./lib/keypadEdit";

/* Structured work: a list of steps (or a two-column proof) built field by
   field. Every control keeps its size from the first frame: a choice is as
   tall as its tallest option, an entry reserves its preview line, marks have
   reserved space, and the keypad overlays the dock instead of pushing it.
   Styles live in structured-work.css; this module also loads under Node. */

const NOUN = (r: StructuredWorkResponse) =>
  r.layout === "proof" ? "Line" : "Step";

/** Characters an entry may contain; anything else is dropped as typed. */
const ENTRY = /[^0-9a-zA-Z.+\-−–*×·/÷^()=<>≤≥, ²³]/g;

/** Typeset preview of an entry, or its problem in words. */
function preview(f: WorkField, raw: string) {
  const text = raw.trim();
  if (!text) return { kind: "empty" as const };
  if (f.kind === "number") {
    const checked = checkEntry(
      {
        kind: "structured-work",
        label: "",
        layout: "steps",
        mode: "build",
        banks: [],
        rows: [],
      },
      f,
      raw,
    );
    return checked.ok
      ? { kind: "math" as const, tex: numberTex(checked.value) }
      : { kind: "error" as const, text: checked.error };
  }
  const parsed = parseLine(text, fieldParseOptions(f));
  return parsed.ok
    ? { kind: "math" as const, tex: lineTex(parsed.line) }
    : { kind: "error" as const, text: parsed.error };
}

/** The keys an on-screen keypad offers for this response's entries. */
export function keypadKeys(r: StructuredWorkResponse): string[] {
  const fields = (r.open ? [r.rows[0]!] : r.rows).flatMap((row) =>
    row.fields.filter((f) => f.given === undefined && f.kind !== "choice"),
  );
  const keys: string[] = [];
  const add = (k: string) => {
    if (!keys.includes(k)) keys.push(k);
  };
  for (const f of fields)
    if (f.kind === "expression") for (const v of f.variables ?? []) add(v);
  const expressions = fields.some((f) => f.kind === "expression");
  if (expressions) ["+", "−", "×", "÷", "(", ")"].forEach(add);
  else ["−", "/"].forEach(add);
  for (const f of fields) {
    if (f.kind !== "expression") continue;
    if (f.powers) add("²");
    if (f.relations) (f.inequality ? ["<", ">", "≤", "≥"] : ["="]).forEach(add);
    if (f.compound) add("or");
  }
  if (expressions && fields.some((f) => f.kind === "number")) add("/");
  return keys.slice(0, 11);
}
const keyInsert = (k: string) => (k === "÷" ? "/" : k === "or" ? " or " : k);
const keyLabel = (k: string) =>
  k === "−"
    ? "Minus"
    : k === "×"
      ? "Times"
      : k === "÷"
        ? "Divided by"
        : k === "/"
          ? "Fraction slash"
          : k === "²"
            ? "Squared"
            : k === "≤"
              ? "Less than or equal to"
              : k === "≥"
                ? "Greater than or equal to"
                : k === "<"
                  ? "Less than"
                  : k === ">"
                    ? "Greater than"
                    : k === "="
                      ? "Equals"
                      : k === "("
                        ? "Open parenthesis"
                        : k === ")"
                          ? "Close parenthesis"
                          : k === "or"
                            ? "Or"
                            : k === "+"
                              ? "Plus"
                              : k;

type Mark = "correct" | "incorrect" | undefined;
type Active = { row: number; field: number } | null;

function ChoicePicker({
  r,
  field,
  value,
  onChoose,
  disabled,
  label,
}: {
  r: StructuredWorkResponse;
  field: WorkField;
  value: string;
  onChoose: (id: string) => void;
  disabled: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const bank = r.banks.find((b) => b.id === field.bank)!;
  const chosen = bank.options.find((o) => o.id === value);
  const placeholder = `Choose a ${field.label.toLowerCase()}`;
  return (
    <DropdownMenu.Root
      open={open && !disabled}
      onOpenChange={setOpen}
      modal={false}
    >
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className="work-choice"
          data-filled={chosen ? "" : undefined}
          aria-label={`${label}: ${chosen ? spokenMath(chosen.label) : "not chosen"}`}
        >
          {/* Every option is laid out in one cell; only the chosen one shows,
              so the control never changes size. */}
          <span className="work-choice-stack" aria-hidden="true">
            <span
              className="work-choice-value work-choice-placeholder"
              data-shown={chosen ? undefined : ""}
            >
              {placeholder}
            </span>
            {bank.options.map((o) => (
              <span
                key={o.id}
                className="work-choice-value"
                data-shown={o.id === value ? "" : undefined}
              >
                <MathText text={o.label} />
              </span>
            ))}
          </span>
          <svg
            className="work-chevron"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" />
          </svg>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="work-menu"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          loop
          aria-label={label}
        >
          <DropdownMenu.Label className="work-menu-label">
            {label}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={onChoose}>
            {bank.options.map((o) => (
              <DropdownMenu.RadioItem
                key={o.id}
                value={o.id}
                className="work-option"
              >
                <span className="work-option-check" aria-hidden="true">
                  <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
                </span>
                <span className="work-option-label">
                  <MathText text={o.label} />
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** A given field: shown, never entered. */
function Given({ r, field }: { r: StructuredWorkResponse; field: WorkField }) {
  const v = field.given!;
  const text =
    field.kind === "choice"
      ? (r.banks
          .find((b) => b.id === field.bank)
          ?.options.find((o) => o.id === v)?.label ?? v)
      : field.kind === "number"
        ? `$${numberTex(v)}$`
        : (() => {
            const parsed = parseLine(v, fieldParseOptions(field));
            return parsed.ok ? `$${lineTex(parsed.line)}$` : v;
          })();
  return (
    <span className="work-given" data-kind={field.kind}>
      {/* One inline run: words and formulas keep their spaces. */}
      <span>
        <MathText text={text} />
        {/* The unit reads exactly as beside an entry box: plain text, so a
            power base ("× 10^") is never typeset as broken TeX. */}
        {field.kind === "number" && field.unit && (
          <span className="work-unit"> {unitLabel(field.unit)}</span>
        )}
      </span>
    </span>
  );
}

/** A power base ("× 10^", whose exponent is the next box) reads as the
 * row's own notation, × 10ⁿ, never as a caret. Other units are words. */
function unitLabel(unit: string) {
  const power = /^×\s*(\d+)\s*\^$/.exec(unit);
  return power ? (
    <>
      × {power[1]}
      <sup>n</sup>
    </>
  ) : (
    unit
  );
}

/** The steps (or proof lines) of the problem itself. */
export function StructuredWorkInput({
  problemId,
  response: r,
  value,
  onChange,
  locked,
  marks,
  small,
}: {
  problemId: string;
  response: StructuredWorkResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  /** After an answer: each row right or not (an ordering: each position). */
  marks: boolean[] | null;
  /** Touch or narrow: entries use the on-screen keypad. */
  small: boolean;
}) {
  const id = useId();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const [active, setActive] = useState<Active>(null);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const pendingCaret = useRef<{ key: string; caret: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const keypad = useRef<HTMLDivElement>(null);
  const keys = keypadKeys(r);
  useEffect(() => {
    setActive(null);
    setTouched(new Set());
    setAnnounce("");
  }, [problemId]);
  // An ordering starts as shown; its first Check sends that order.
  useEffect(() => {
    if (r.mode === "order" && !locked && value === "")
      onChange(JSON.stringify(r.rows.map((x) => x.id)));
  }, [problemId, r.mode, value, locked]);
  useEffect(() => {
    if (locked) setActive(null);
  }, [locked]);
  useLayoutEffect(() => {
    const p = pendingCaret.current;
    if (!p) return;
    pendingCaret.current = null;
    const input = inputs.current.get(p.key);
    if (!input) return;
    input.focus({ preventScroll: true });
    input.setSelectionRange(p.caret, p.caret);
  });
  const keypadOpen = small && active !== null && !locked && keys.length > 0;
  // Keep the active entry above the keypad within its own scrolling workspace.
  useLayoutEffect(() => {
    if (!keypadOpen || !active) return;
    const input = inputs.current.get(`${active.row}:${active.field}`);
    const pad = keypad.current;
    const stage = input?.closest<HTMLElement>(".answer-editor, .problem-stage");
    if (!input || !pad || !stage) return;
    const field = input.closest<HTMLElement>(".work-entry") ?? input;
    const bottom = field.getBoundingClientRect().bottom;
    const top = pad.getBoundingClientRect().top - 12;
    if (bottom > top) stage.scrollTop += bottom - top;
  }, [keypadOpen, active?.row, active?.field]);

  const rows = r.mode === "order" ? [] : draftRows(r, value);
  const order = r.mode === "order" ? draftOrder(r, value) : [];
  const setEntry = (row: number, field: number, text: string) => {
    if (locked) return;
    const next = draftRows(r, value).map((x) => [...x]);
    next[row]![field] = text;
    onChange(serializeDraft(next));
  };
  const markOf = (i: number): Mark =>
    marks ? (marks[i] ? "correct" : "incorrect") : undefined;
  const noun = NOUN(r);
  // Rows of numbers only (a factor pair, a quotient and remainder) read as
  // one inline line of small, equal fields: no card, no stacked boxes.
  const compact =
    r.layout === "steps" &&
    r.mode !== "order" &&
    r.rows.every((row) => row.fields.every((f) => f.kind === "number"));
  // What an open list adds: its row label ("Pair") when it has one.
  const item = r.open && r.rows[0]?.label ? r.rows[0].label : noun;

  function press(k: string) {
    if (!active || locked) return;
    const key = `${active.row}:${active.field}`;
    const input = inputs.current.get(key) ?? null;
    const f = rowShape(r, active.row).fields[active.field]!;
    const current = rows[active.row]?.[active.field] ?? "";
    if (k === "done") {
      input?.blur();
      setActive(null);
      return;
    }
    const field = readField(input, current);
    const edit =
      k === "backspace"
        ? deleteBackward(field)
        : insertText(field, keyInsert(k));
    if (edit.value.length > fieldMaxLength(f)) return;
    pendingCaret.current = { key, caret: edit.caret };
    setEntry(active.row, active.field, edit.value);
  }

  function entry(i: number, j: number, f: WorkField, rowLabel: string) {
    const key = `${i}:${j}`;
    const raw = rows[i]?.[j] ?? "";
    const p = preview(f, raw);
    const showError =
      p.kind === "error" &&
      touched.has(key) &&
      !(active?.row === i && active.field === j);
    const noteId = `${id}-note-${key}`;
    const label = `${noun} ${i + 1} ${f.label.toLowerCase()}`;
    return (
      <span className="work-entry" data-kind={f.kind}>
        <span className="work-entry-row">
          <input
            ref={(node) => {
              if (node) inputs.current.set(key, node);
              else inputs.current.delete(key);
            }}
            className="work-input"
            data-invalid={showError ? "" : undefined}
            value={raw}
            readOnly={locked}
            inputMode={small ? "none" : "text"}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={fieldMaxLength(f)}
            aria-label={
              rowLabel ? `${spokenMath(rowLabel)}: ${f.label}` : label
            }
            aria-describedby={noteId}
            aria-invalid={showError || undefined}
            placeholder={
              f.kind === "number"
                ? "Number"
                : f.relations
                  ? f.inequality
                    ? "Inequality"
                    : "Equation"
                  : "Expression"
            }
            onFocus={() => setActive({ row: i, field: j })}
            onBlur={(event) => {
              setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
              // Focus moving to the keypad keeps the entry active.
              if (keypad.current?.contains(event.relatedTarget as Node)) return;
              setActive((a) => (a?.row === i && a.field === j ? null : a));
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Escape") {
                event.currentTarget.blur();
                setActive(null);
              }
            }}
            onChange={(event) =>
              setEntry(
                i,
                j,
                event.target.value
                  .replace(ENTRY, "")
                  .slice(0, fieldMaxLength(f)),
              )
            }
          />
          {f.kind === "number" && f.unit && (
            <span className="work-unit" aria-hidden="true">
              {unitLabel(f.unit)}
            </span>
          )}
        </span>
        {/* An expression reserves one line: its typeset form, or what to
            fix. A number is its own preview, so it shows only what to fix,
            overlaid below the field (nothing moves). */}
        {f.kind === "number" ? (
          <span
            className="work-note"
            id={noteId}
            data-tone={showError ? "error" : undefined}
            hidden={!showError}
          >
            {showError && p.kind === "error" ? p.text : null}
          </span>
        ) : (
          <span
            className="work-note"
            id={noteId}
            data-tone={
              showError ? "error" : p.kind === "error" ? "hint" : undefined
            }
          >
            {p.kind === "math" ? (
              <MathText text={`$${p.tex}$`} />
            ) : p.kind === "error" ? (
              p.text
            ) : null}
          </span>
        )}
      </span>
    );
  }

  function fieldControl(i: number, j: number, f: WorkField, row: WorkRow) {
    if (f.given !== undefined) return <Given r={r} field={f} />;
    const rowLabel = r.open
      ? `${item} ${i + 1}`
      : row.label
        ? row.label
        : `${noun} ${i + 1}`;
    if (f.kind === "choice")
      return (
        <ChoicePicker
          r={r}
          field={f}
          value={rows[i]?.[j] ?? ""}
          onChoose={(choice) => setEntry(i, j, choice)}
          disabled={locked}
          label={`${noun} ${i + 1} ${f.label.toLowerCase()}`}
        />
      );
    return entry(i, j, f, row.label || r.open ? rowLabel : "");
  }

  const markBadge = (i: number) => {
    const m = markOf(i);
    return (
      <span
        className="work-mark"
        data-mark={m}
        aria-hidden={m ? undefined : true}
      >
        {m === "correct" ? "✓" : m === "incorrect" ? "✕" : ""}
        {m && (
          <span className="sr-only">
            {m === "correct" ? "correct" : "needs work"}
          </span>
        )}
      </span>
    );
  };

  // After a move, focus follows the row; at the top or bottom, where the
  // pressed arrow is disabled, it moves to the other arrow.
  const pendingFocus = useRef<{ row: string; dir: "up" | "down" } | null>(null);
  useLayoutEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    const row = document.querySelector<HTMLElement>(
      `.work-row[data-row="${p.row}"]`,
    );
    const buttons =
      row?.querySelectorAll<HTMLButtonElement>(".work-move-button");
    if (!buttons || buttons.length < 2) return;
    const [up, down] = [buttons[0]!, buttons[1]!];
    const want = p.dir === "up" ? up : down;
    (want.disabled ? (p.dir === "up" ? down : up) : want).focus({
      preventScroll: true,
    });
  });
  function move(position: number, by: -1 | 1) {
    if (locked) return;
    const next = [...order];
    const to = position + by;
    if (to < 0 || to >= next.length) return;
    [next[position], next[to]] = [next[to]!, next[position]!];
    const moved = document.activeElement?.closest(".work-move");
    if (moved)
      pendingFocus.current = { row: next[to]!, dir: by < 0 ? "up" : "down" };
    onChange(JSON.stringify(next));
    setAnnounce(`${noun} moved to position ${to + 1} of ${next.length}.`);
  }

  // Dragging a row: the others slide aside to show where it will land, and
  // it settles there on release. Rows keep their layout boxes throughout
  // (transforms only), so the stage and the dock never move.
  const list = useRef<HTMLOListElement>(null);
  const reorder = useRef<{
    tops: number[];
    heights: number[];
    gap: number;
    from: number;
    to: number;
    dropped: boolean;
  } | null>(null);
  const rowItems = () => [
    ...(list.current?.querySelectorAll<HTMLElement>(":scope > .work-row") ??
      []),
  ];
  const drag = useTileDrag<string>({
    disabled: locked || r.mode !== "order",
    axis: "y",
    accepts: (_, zone) => zone === "order",
    moved: (rowId, point) => {
      const ol = list.current;
      if (!ol) return;
      const items = rowItems();
      if (!reorder.current) {
        const tops = items.map((x) => x.offsetTop - items[0]!.offsetTop);
        const heights = items.map((x) => x.offsetHeight);
        const from = order.indexOf(rowId);
        reorder.current = {
          tops,
          heights,
          gap: items.length > 1 ? tops[1]! - heights[0]! : 0,
          from,
          to: from,
          dropped: false,
        };
        ol.setAttribute("data-reordering", "");
      }
      const p = reorder.current;
      const y = point.y - items[0]!.getBoundingClientRect().top;
      // Transforms do not move offsets: measure against the first row's
      // layout box, which no transform has moved unless it is shifted.
      const firstShift = items[0]!.style.transform
        ? parseFloat(items[0]!.style.transform.slice(11)) || 0
        : 0;
      const at = y + firstShift;
      const to = p.tops.filter(
        (top, i) => i !== p.from && top + p.heights[i]! / 2 < at,
      ).length;
      p.to = to;
      const room = p.heights[p.from]! + p.gap;
      items.forEach((item, i) => {
        if (i === p.from) return;
        const shift =
          p.from < to && i > p.from && i <= to
            ? -room
            : to < p.from && i >= to && i < p.from
              ? room
              : 0;
        item.style.transform = shift ? `translateY(${shift}px)` : "";
      });
    },
    drop: (rowId) => {
      const p = reorder.current;
      const items = rowItems();
      if (!p) return;
      // Dropped where it started: it settles back into its own place.
      if (p.to === p.from) return items[p.from]!.getBoundingClientRect();
      p.dropped = true;
      const next = order.filter((x) => x !== rowId);
      next.splice(p.to, 0, rowId);
      // Where the row lands: after the rows now above it.
      const source = items[p.from]!.getBoundingClientRect();
      const listTop =
        items[0]!.getBoundingClientRect().top -
        (parseFloat(items[0]!.style.transform.slice(11)) || 0);
      let top = listTop;
      for (const id of next) {
        if (id === rowId) break;
        top += p.heights[order.indexOf(id)]! + p.gap;
      }
      onChange(JSON.stringify(next));
      setAnnounce(`${noun} moved to position ${p.to + 1} of ${next.length}.`);
      return new DOMRect(source.left, top, source.width, source.height);
    },
    ended: () => {
      const p = reorder.current;
      reorder.current = null;
      // A drop clears the room after the new order renders; a cancel lets
      // the rows slide back.
      if (p?.dropped) return;
      for (const item of rowItems()) item.style.transform = "";
      setTimeout(() => list.current?.removeAttribute("data-reordering"), 300);
    },
  });
  // The new order is drawn: the rows are where they were shown, so the
  // room made for the drag goes away without motion.
  useLayoutEffect(() => {
    const ol = list.current;
    if (!ol?.hasAttribute("data-reordering") || reorder.current) return;
    ol.removeAttribute("data-reordering");
    for (const item of rowItems()) item.style.transform = "";
  }, [value]);

  const header =
    r.layout === "proof" ? (
      <div className="work-columns" aria-hidden="true">
        <span />
        <span>Statement</span>
        <span>Reason</span>
        <span />
      </div>
    ) : null;

  const body =
    r.mode === "order" ? (
      <ol
        ref={list}
        className="work-rows"
        data-layout={r.layout}
        data-mode="order"
        data-drop={locked ? undefined : "order"}
      >
        {order.map((rowId, position) => {
          const row = r.rows.find((x) => x.id === rowId)!;
          return (
            <li
              key={rowId}
              className="work-row"
              data-row={rowId}
              data-mark={markOf(position)}
              data-draggable={locked ? undefined : ""}
              onPointerDown={(event) => {
                const target = event.target as HTMLElement;
                // Touch drags from the grip, so a swipe elsewhere scrolls;
                // a mouse or pen drags the whole row. The arrows stay buttons.
                if (target.closest(".work-move")) return;
                if (
                  event.pointerType === "touch" &&
                  !target.closest(".work-grip")
                )
                  return;
                drag.start(rowId, event);
              }}
            >
              <span
                className="work-grip"
                data-drag-tile={locked ? undefined : ""}
                aria-hidden="true"
              >
                <span className="work-number">{position + 1}</span>
                {!locked && (
                  <svg viewBox="0 0 12 16" className="work-grip-dots">
                    <circle cx="4" cy="3" r="1.3" />
                    <circle cx="8" cy="3" r="1.3" />
                    <circle cx="4" cy="8" r="1.3" />
                    <circle cx="8" cy="8" r="1.3" />
                    <circle cx="4" cy="13" r="1.3" />
                    <circle cx="8" cy="13" r="1.3" />
                  </svg>
                )}
              </span>
              <span className="work-fields">
                {row.label && (
                  <span className="work-label">
                    <MathText text={row.label} />
                  </span>
                )}
                {row.fields.map((f, j) => (
                  <span key={j} className="work-cell" data-field={f.kind}>
                    <Given r={r} field={f} />
                  </span>
                ))}
              </span>
              <span className="work-move">
                <button
                  type="button"
                  className="work-move-button"
                  disabled={locked || position === 0}
                  aria-label={`Move ${noun.toLowerCase()} ${position + 1} up`}
                  onClick={() => move(position, -1)}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                    <path d="M2.5 7.5 6 4l3.5 3.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="work-move-button"
                  disabled={locked || position === order.length - 1}
                  aria-label={`Move ${noun.toLowerCase()} ${position + 1} down`}
                  onClick={() => move(position, 1)}
                >
                  <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  </svg>
                </button>
              </span>
              {markBadge(position)}
            </li>
          );
        })}
      </ol>
    ) : (
      <ol
        className="work-rows"
        data-layout={r.layout}
        data-mode={r.mode}
        data-compact={compact ? "" : undefined}
      >
        {rows.map((_, i) => {
          const row = rowShape(r, i);
          // An open list's row label names its item ("Pair"), not each row.
          const label = r.open ? undefined : row.label;
          return (
            <li key={i} className="work-row" data-mark={markOf(i)}>
              <span className="work-number" aria-hidden="true">
                {i + 1}
              </span>
              <span className="work-fields">
                {label && (
                  <span className="work-label">
                    <MathText text={label} />
                  </span>
                )}
                {compact ? (
                  <span className="work-cells">
                    {row.fields.map((f, j) => (
                      <span key={j} className="work-cell" data-field={f.kind}>
                        {fieldControl(i, j, f, row)}
                      </span>
                    ))}
                  </span>
                ) : (
                  row.fields.map((f, j) => (
                    <span key={j} className="work-cell" data-field={f.kind}>
                      {r.layout === "proof" && (
                        <span className="work-cell-caption" aria-hidden="true">
                          {f.label}
                        </span>
                      )}
                      {fieldControl(i, j, f, row)}
                    </span>
                  ))
                )}
              </span>
              {markBadge(i)}
            </li>
          );
        })}
      </ol>
    );

  return (
    <div
      className="work"
      data-layout={r.layout}
      data-keypad={keypadOpen ? "" : undefined}
      // Room for the keypad is reserved from the first frame, so opening
      // and closing it never changes the scroll extent under a finger.
      data-keypad-space={small && keys.length > 0 ? "" : undefined}
      role="group"
      aria-label={spokenMath(r.label)}
    >
      {r.start && (
        <p className="work-start">
          <span className="work-start-label">Start</span>
          <span>
            <MathText text={r.start} />
          </span>
        </p>
      )}
      {header}
      {body}
      {r.open && (
        <div className="work-list-actions">
          <button
            type="button"
            className="secondary work-add"
            disabled={locked || rows.length >= r.open.max}
            onClick={() => {
              const next = draftRows(r, value).map((x) => [...x]);
              next.push(r.rows[0]!.fields.map(() => ""));
              onChange(serializeDraft(next));
              pendingCaret.current = { key: `${next.length - 1}:0`, caret: 0 };
              setAnnounce(`${item} ${next.length} added.`);
            }}
          >
            Add a {item.toLowerCase()}
          </button>
          <button
            type="button"
            className="secondary work-remove"
            disabled={locked || rows.length <= 1}
            onClick={() => {
              const next = draftRows(r, value).map((x) => [...x]);
              next.pop();
              onChange(serializeDraft(next));
              setActive(null);
              setAnnounce(`${item} ${next.length + 1} removed.`);
            }}
          >
            Remove last {item.toLowerCase()}
          </button>
        </div>
      )}
      {r.goal && (
        <p className="work-goal">
          <span className="work-start-label">Prove</span>
          <span>
            <MathText text={r.goal} />
          </span>
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
      {keypadOpen && (
        <div
          ref={keypad}
          className="work-keypad"
          role="group"
          aria-label="Math keypad"
          onPointerDown={(event) => event.preventDefault()}
        >
          {[
            "7",
            "8",
            "9",
            keys[0],
            keys[1],
            "backspace",
            "4",
            "5",
            "6",
            keys[2],
            keys[3],
            keys[4],
            "1",
            "2",
            "3",
            keys[5],
            keys[6],
            keys[7],
            "0",
            ".",
            keys[8],
            keys[9],
            keys[10],
            "done",
          ].map((k, n) =>
            k === undefined ? (
              <span key={`blank-${n}`} className="work-key-blank" />
            ) : (
              <button
                key={k}
                type="button"
                tabIndex={-1}
                className="work-key"
                data-key={k}
                data-variable={/^[a-zA-Z]$/.test(k) ? "" : undefined}
                aria-label={
                  k === "backspace"
                    ? "Delete"
                    : k === "done"
                      ? "Done"
                      : keyLabel(k)
                }
                onClick={() => press(k)}
              >
                {k === "backspace" ? "⌫" : k === "done" ? "Done" : k}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** The dock: progress, Clear and Check. */
export function StructuredWorkAnswer({
  response: r,
  value,
  onChange,
  locked,
  busy,
  sending,
  resolved,
  submit,
}: {
  response: StructuredWorkResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  busy: boolean;
  /** An answer is on its way, so Check shows the wave. */
  sending: boolean;
  resolved: boolean;
  submit: () => void;
}) {
  const { done, total } = workProgress(r, value);
  // Exactly what the server accepts, so Check never offers a rejection.
  const complete = normalizeStructuredWork(r, value) !== null;
  const order = r.mode === "order";
  const shown = JSON.stringify(r.rows.map((x) => x.id));
  const rows = order ? [] : draftRows(r, value);
  const empty = order
    ? value === "" || value === shown
    : (!r.open || rows.length <= 1) &&
      rows.every((row) => row.every((v) => !v.trim()));
  return (
    <form
      className="work-form"
      aria-label={spokenMath(r.label)}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        if (!busy && !resolved && complete) submit();
      }}
    >
      <p className="work-count" role="status" aria-live="polite">
        {order
          ? `Drag or use the arrows to put the ${r.layout === "proof" ? "lines" : "steps"} in order`
          : `${done} of ${total} filled in`}
      </p>
      <div className="work-actions">
        <button
          type="button"
          className="secondary work-clear"
          disabled={locked || empty}
          onClick={() => onChange(order ? shown : "")}
        >
          {order ? "Reset" : "Clear"}
        </button>
        <button
          className="choice-submit work-check"
          type="submit"
          disabled={busy || resolved || !complete}
          aria-busy={sending}
        >
          Check
        </button>
      </div>
    </form>
  );
}

/** What one row is called: an open list's own label ("pair"), else a line
 * of a proof or a step. */
export function workItem(r: StructuredWorkResponse): string {
  return r.open && r.rows[0]?.label
    ? r.rows[0].label.toLowerCase()
    : r.layout === "proof"
      ? "line"
      : "step";
}

/** "2 of 4 steps correct", from the server's marks. */
export function workSummary(
  r: StructuredWorkResponse,
  parts: boolean[] | undefined,
): string {
  const what = `${workItem(r)}s`;
  if (!parts?.length) return `Your ${what} are marked above`;
  return `${parts.filter(Boolean).length} of ${parts.length} ${what} correct`;
}
