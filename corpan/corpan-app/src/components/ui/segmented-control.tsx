import * as React from "react";
import { cn } from "@/lib/utils";

// A slim, premium single-row selector — the calm replacement for the old
// stacks of fat wrapping pills. It NEVER wraps to a second row: segments live
// in one flex track and the track scrolls horizontally if a set of localized
// labels ever gets too wide for the viewport. Squared-off 8px corners per the
// design standard; the track is a quiet inset well, the active segment lifts
// out on a card. Reused by text-size, speech-rate and theme so those surfaces
// can never drift apart.

export interface SegmentOption<T extends string> {
  value: T;
  /** Visible content — a short label, an icon, or a sized glyph. */
  label: React.ReactNode;
  /** A11y label; required when `label` carries no text of its own (icon/glyph). */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  ariaLabel?: string;
  dir?: string;
  className?: string;
  /** Equal-width segments that fill the row (default). */
  fill?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  dir,
  className,
  fill = true,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      dir={dir}
      className={cn(
        "no-scrollbar flex w-full items-stretch gap-1 overflow-x-auto rounded-md border border-border bg-muted/40 p-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.ariaLabel}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-2 md:py-2.5",
              "select-none whitespace-nowrap text-xs font-medium transition-colors cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              fill ? "flex-1 min-w-0" : "flex-none",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
