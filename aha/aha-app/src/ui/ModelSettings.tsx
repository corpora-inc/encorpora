import { useId, useState } from "react";
import { logError } from "../diagnostics/log";
import type { StudioProps } from "./types";

const AUTO = "auto";
/** User-visible model notes, keyed so a translation table can replace them. */
export const MODEL_NOTES = { reasoning: "thinks longer, costs more" } as const;
/** Per activity (#929): a set is now 10 activities, so the per-activity figure is the comparable one. */
const cost = (o?: { batch2z?: string; activity2z?: string }) => (o?.activity2z ? ` · ≈ ${o.activity2z} 2Z per activity` : o?.batch2z ? ` · ≈ ${o.batch2z} 2Z per set` : "");
const note = (reasoning?: boolean) => (reasoning ? ` · ${MODEL_NOTES.reasoning}` : "");

/** Settings row: which Free2Z model writes activities. "Best (auto)" or any eligible model, each with its estimate. */
export function ModelChoice({ menu, busy, onChoose }: { menu: NonNullable<StudioProps["modelMenu"]>; busy?: boolean; onChoose?: (choice: string) => void }) {
  const id = useId();
  return (
    <div className="model-choice">
      <label htmlFor={id}>AI model</label>
      <select id={id} value={menu.choice} disabled={busy || !onChoose} onChange={(e) => onChoose?.(e.target.value)}>
        <option value={AUTO}>{`Best (auto)${cost(menu.auto)}`}</option>
        {menu.options.map((o) => <option key={o.id} value={o.id}>{`${o.name}${cost(o)}${note(o.reasoning)}`}</option>)}
      </select>
    </div>
  );
}

/** Per-model counts from this device, loaded when opened. For comparing models; the same lines go into a problem report. */
export function ModelStats({ load }: { load: () => Promise<string[]> }) {
  const [lines, setLines] = useState<string[]>();
  const [failed, setFailed] = useState(false);
  return (
    <details className="model-stats" onToggle={(e) => {
      if (!(e.currentTarget as HTMLDetailsElement).open) return;
      setFailed(false);
      load().then(setLines, (error) => { logError("model-stats", error); setFailed(true); });
    }}>
      <summary>Model stats</summary>
      {failed ? <p>Stats aren’t available right now.</p>
        : lines ? <ul>{lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
        : <p>Loading…</p>}
    </details>
  );
}
