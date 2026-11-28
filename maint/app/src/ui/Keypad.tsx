import { Delete } from "lucide-react";
import { cx } from "./kit.tsx";

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "-", "0", "."] as const;

/**
 * A numeric keypad for a measured value, with the unit always shown. Large
 * keys for gloved hands; the display keeps its size whatever is typed. The
 * keypad only edits text; the engine decides what the value means.
 */
export function Keypad({ value, unit, onChange, label }: { value: string; unit: string; onChange(v: string): void; label: string }) {
  const press = (k: string) => {
    if (k === "-") return onChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
    if (k === "." && value.includes(".")) return;
    if (value.replace(/[-.]/g, "").length >= 8) return;
    onChange(value === "0" && k !== "." ? k : value + k);
  };
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      <output aria-live="polite" aria-label={`${label}: ${value || "empty"} ${unit}`} className="flex h-[72px] items-center justify-end gap-3 rounded-control border-2 border-ink bg-sheet px-4">
        <span className={cx("min-w-0 truncate text-h2 font-bold tabular", !value && "text-ink-3")}>{value || "0"}</span>
        <span className="shrink-0 text-lead font-semibold text-ink-2">{unit}</span>
      </output>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} aria-label={k === "-" ? "Plus or minus" : k === "." ? "Decimal point" : k} className="min-h-16 rounded-control border-2 border-line-strong bg-surface text-h3 font-bold tabular active:bg-surface-3">
            {k === "-" ? "±" : k}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onChange(value.slice(0, -1))} disabled={!value} className="flex min-h-tap items-center justify-center gap-2 rounded-control border-2 border-line-strong bg-surface text-small font-semibold disabled:opacity-40">
        <Delete aria-hidden size={22} />
        Delete
      </button>
    </div>
  );
}
