import { useState } from "react";
import { Check } from "lucide-react";
import type { Outcome, StepRecord, TaskView } from "../engine/types.ts";
import { Button, cx, inputClass } from "./kit.tsx";
import { Guards } from "./manual.tsx";

export interface TaskStepsProps {
  task: TaskView;
  /** What the run recorded, by step. Null: show the task only (print, preview). */
  records: StepRecord[] | null;
  busy?: boolean;
  onRecord?(ord: number, outcome: Outcome, value?: string): void;
}

/**
 * A task's steps in the manual's words, each with its guards before it, and
 * the control its check calls for: pass or fail, or a recorded value.
 */
export function TaskSteps({ task, records, busy = false, onRecord }: TaskStepsProps) {
  return (
    <ol className="m-0 list-none border-t border-line p-0">
      {task.steps.map((s) => {
        const rec = records?.find((r) => r.ord === s.ord) ?? null;
        return (
          <li key={s.ord} className={cx("flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0 sm:px-5", !s.applies && "opacity-60")}>
            <Guards guards={s.guards} />
            <div className="flex items-start gap-3">
              <span className="w-7 shrink-0 pt-0.5 font-sans text-body font-bold tabular">{s.ord}.</span>
              <p className="min-w-0 flex-1 text-body">
                {s.text}
                {!s.applies && <span className="ml-2 font-sans text-meta text-ink-3">Not for this variant</span>}
              </p>
            </div>
            {records && onRecord && s.applies && <StepControl kind={s.check_kind} rec={rec} busy={busy} onRecord={(o, v) => onRecord(s.ord, o, v)} />}
          </li>
        );
      })}
    </ol>
  );
}

function StepControl({ kind, rec, busy, onRecord }: { kind: string; rec: StepRecord | null; busy: boolean; onRecord(o: Outcome, v?: string): void }) {
  const [value, setValue] = useState(rec?.value ?? rec?.note ?? "");
  if (kind === "note" || kind === "value")
    return (
      <form
        className="flex gap-2 pl-10 font-sans"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onRecord(kind === "note" ? "note" : "value", value.trim());
        }}
      >
        <input aria-label="Recorded value" value={value} onChange={(e) => setValue(e.target.value)} className={cx(inputClass, "min-w-0 flex-1")} />
        <Button type="submit" variant={rec ? "secondary" : "primary"} disabled={busy || !value.trim()}>
          {rec ? <Check aria-hidden size={20} /> : null}
          {rec ? "Recorded" : "Record"}
        </Button>
      </form>
    );
  const opt = (o: Outcome, label: string) => (
    <button
      type="button"
      aria-pressed={rec?.outcome === o}
      disabled={busy}
      onClick={() => onRecord(o)}
      className={cx("flex min-h-tap flex-1 items-center justify-center gap-2 rounded-control border-2 px-4 text-small font-semibold", rec?.outcome === o ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface text-ink")}
    >
      {rec?.outcome === o && <Check aria-hidden size={20} />}
      {label}
    </button>
  );
  return (
    <div className="flex gap-2 pl-10 font-sans">
      {opt("pass", "Pass")}
      {opt("fail", "Fail")}
    </div>
  );
}
