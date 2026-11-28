import { CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import type { Applicability, AttrDef, AttrValue, ValueSource } from "../engine/types.ts";
import { Button, cx, inputClass } from "./kit.tsx";

/** Where a unit's attribute value came from, as the technician reads it. */
export const SOURCE_LABEL: Record<ValueSource, string> = { typed: "Typed", plate: "Data plate", vehicle: "Vehicle" };

const INPUT_MODE: Record<AttrDef["type"], "text" | "decimal"> = { number: "decimal", version: "decimal", text: "text", serial: "text" };
/** Why a typed value was refused, in plain words for its type. */
export const REFUSED: Record<AttrDef["type"], string> = {
  number: "That is not a number. Type the number only.",
  version: "That does not read as a version. Type it as shown on the unit, numbers and dots, for example 2.4.",
  text: "That could not be kept. Type it as recorded.",
  serial: "That does not read as a serial number. Type it as stamped, letters then digits.",
};

const HINT: Record<AttrDef["type"], string> = { number: "Number", version: "For example 2.4", text: "As recorded", serial: "As stamped" };

/** The manual's printed statements, quoted in manual type. */
function Statements({ a }: { a: Applicability }) {
  const texts = [...new Set(a.statements.map((s) => s.text))];
  return <p className="font-manual text-body">{texts.map((t, i) => <span key={t}>{i > 0 && "; "}{t}</span>)}</p>;
}

export interface UndeterminedProps {
  a: Applicability;
  /** The unit's declared attributes; absent when no unit is in hand (the marker only). */
  declared?: AttrDef[];
  saving?: boolean;
  /** Attributes whose last value the engine refused. */
  refused?: Record<string, true>;
  onAnswer?(attr: string, value: string): void;
}

/**
 * An item whose applicability to this unit is not known: never hidden, never
 * shown as plain content. A calm marker quotes the manual's statement and
 * asks, in place, for the attribute it needs.
 */
export function Undetermined({ a, declared, saving = false, refused = {}, onAnswer }: UndeterminedProps) {
  const asks = (declared && onAnswer ? a.missing.map((id) => declared.find((d) => d.id === id)).filter((d): d is AttrDef => !!d) : []);
  return (
    <div className="flex flex-col gap-2 rounded-control border-2 border-dashed border-line-strong bg-surface px-4 py-3 font-sans" data-applicability="unknown">
      <div className="flex items-start gap-2">
        <CircleHelp aria-hidden size={20} className="mt-0.5 shrink-0 text-ink-2" />
        <div className="min-w-0">
          <p className="text-meta font-semibold text-ink-2">Depends on</p>
          <Statements a={a} />
          <p className="mt-1 text-meta text-ink-2">{asks.length > 0 || !declared ? "Not yet known for this unit." : "The manual does not say how to tell."}</p>
        </div>
      </div>
      {asks.map((d) => (
        <AttrAnswer key={d.id} def={d} saving={saving} refused={!!refused[d.id]} onAnswer={(v) => onAnswer!(d.id, v)} />
      ))}
    </div>
  );
}

function AttrAnswer({ def, saving, onAnswer, initial = "", action = "Save", refused = false }: { def: AttrDef; saving: boolean; onAnswer(v: string): void; initial?: string; action?: string; refused?: boolean }) {
  const [v, setV] = useState(initial);
  const ok = v.trim().length > 0;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onAnswer(v.trim());
      }}
    >
      <label className="min-w-0 flex-[1_1_12rem]">
        <span className="mb-1 block text-meta font-semibold text-ink-2">{def.label}</span>
        <input aria-invalid={refused || undefined} className={cx(inputClass, "font-code placeholder:font-sans", refused && "border-error")} value={v} inputMode={INPUT_MODE[def.type]} autoComplete="off" spellCheck={false} placeholder={HINT[def.type]} onChange={(e) => setV(e.target.value)} />
      </label>
      <Button type="submit" disabled={!ok || saving}>
        {action}
      </Button>
      {refused && (
        <p role="alert" className="basis-full text-meta font-semibold text-error">
          {REFUSED[def.type]}
        </p>
      )}
    </form>
  );
}

/** A quiet line for an item whose statements were evaluated: it applies, or not to this unit. */
export function Applies({ a }: { a: Applicability | null }) {
  if (!a || a.statements.length === 0 || a.status === "unknown") return null;
  return (
    <p className="font-sans text-meta text-ink-2">
      {a.status === "applies" ? "Applies to this unit: " : "Not for this unit: "}
      <span className="font-manual">{[...new Set(a.statements.map((s) => s.text))].join("; ")}</span>
    </p>
  );
}

export interface AttrListProps {
  declared: AttrDef[];
  values: AttrValue[];
  saving?: boolean;
  refused?: Record<string, true>;
  /** Absent: read only (identify before the unit is saved). */
  onChange?(attr: string, value: string | null): void;
}

/** The unit's attribute values and where each came from; each one can be changed or cleared. */
export function AttrList({ declared, values, saving = false, refused = {}, onChange }: AttrListProps) {
  const [editing, setEditing] = useState<string | null>(null);
  // A saved value closes its field; a refused one keeps it open with what was typed.
  useEffect(() => setEditing(null), [values]);
  if (declared.length === 0) return null;
  return (
    <dl className="m-0 flex flex-col divide-y divide-line" aria-label="Attributes">
      {declared.map((d) => {
        const v = values.find((x) => x.attr === d.id) ?? null;
        return (
          <div key={d.id} className="flex flex-col gap-2 py-2.5" data-attr={d.id}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <dt className="min-w-0 flex-[1_1_9rem] text-meta font-semibold text-ink-2">{d.label}</dt>
              <dd className="m-0 flex min-w-0 flex-[2_1_12rem] flex-wrap items-center gap-x-3 gap-y-1">
                {v ? <span className="code text-body">{v.value}</span> : <span className="text-body text-ink-3">Not known</span>}
                {v && <span className="rounded-full border border-line px-2 py-0.5 text-meta text-ink-2">{SOURCE_LABEL[v.source]}</span>}
                {onChange && editing !== d.id && (
                  <button type="button" onClick={() => setEditing(d.id)} className="ml-auto inline-flex min-h-11 items-center px-2 text-meta font-semibold underline underline-offset-4">
                    {v ? "Change" : "Add"}
                  </button>
                )}
              </dd>
            </div>
            {onChange && editing === d.id && (
              <div className="flex flex-col gap-2">
                <AttrAnswer
                  def={d}
                  saving={saving}
                  initial={v?.value ?? ""}
                  refused={!!refused[d.id]}
                  onAnswer={(x) => onChange(d.id, x)}
                />
                <div className="flex flex-wrap gap-2">
                  {v && (
                    <Button
                      variant="quiet"
                      disabled={saving}
                      onClick={() => {
                        onChange(d.id, null);
                        setEditing(null);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                  <Button variant="quiet" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </dl>
  );
}
