import { type ButtonHTMLAttributes, type ReactNode, type Ref, useId } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "quiet";
const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-surface border-ink",
  secondary: "bg-surface text-ink border-line-strong",
  quiet: "bg-transparent text-ink border-transparent",
};
type Size = "md" | "lg";
const SIZE: Record<Size, string> = { md: "min-h-tap text-small", lg: "min-h-result text-lead" };

const base = "inline-flex items-center justify-center gap-2 rounded-control border-2 font-semibold whitespace-nowrap no-underline select-none disabled:opacity-40 active:translate-y-px";

/** `icon`: a square icon-only button (give it an aria-label). */
export function Button({
  variant = "secondary",
  size = "md",
  icon = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button type="button" {...rest} className={cx(base, SIZE[size], icon ? "w-14 shrink-0" : "px-5", VARIANT[variant], className)}>
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant = "secondary", size = "md", className, children }: { to: string; variant?: Variant; size?: Size; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={cx(base, SIZE[size], "px-5", VARIANT[variant], className)}>
      {children}
    </Link>
  );
}

/** A designed single choice. Labels never break mid-word. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel = false,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange(v: T): void;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="min-w-0">
      <div id={id} className={cx("mb-1.5 text-meta font-semibold text-ink-2", hideLabel && "sr-only")}>
        {label}
      </div>
      <div className="inline-flex max-w-full rounded-control border-2 border-line-strong bg-surface p-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cx("min-h-11 rounded-[7px] px-4 text-small font-semibold whitespace-nowrap", on ? "bg-ink text-surface" : "text-ink-2")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Panel({ children, className, label }: { children: ReactNode; className?: string; label?: ReactNode }) {
  return (
    <section className={cx("rounded-panel border border-line bg-surface p-4 sm:p-5", className)}>
      {label && <h2 className="mb-3 text-small font-bold text-ink-2">{label}</h2>}
      {children}
    </section>
  );
}

/** A list row that navigates. 56 px tall at minimum. */
export function Row({ to, title, meta, leading, trailing }: { to: string; title: ReactNode; meta?: ReactNode; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-tap items-center gap-3 border-b border-line px-4 py-3 text-ink no-underline last:border-b-0 active:bg-surface-2">
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {meta && <span className="block text-meta text-ink-3">{meta}</span>}
      </span>
      {trailing}
      <ChevronRight aria-hidden size={22} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export function List({ children, label, action }: { children: ReactNode; label?: string; action?: ReactNode }) {
  return (
    <section>
      {(label || action) && (
        <div className="mb-2 flex min-h-11 items-end justify-between gap-3">
          {label && <h2 className="text-h3">{label}</h2>}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-panel border border-line bg-surface">{children}</div>
    </section>
  );
}

/** Same size as what it stands in for. */
export function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

/** A screen's frame inside the shell: title row, then a readable column (or a wide one). */
export function Page({ title, kicker, actions, wide = false, children }: { title: ReactNode; kicker?: ReactNode; actions?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cx("mx-auto w-full px-4 pt-5 pb-10 sm:px-6 lg:px-8", wide ? "max-w-[1280px]" : "max-w-[820px]")}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {kicker && <div className="mb-1 text-small font-semibold text-ink-3">{kicker}</div>}
          <h1 className="text-h2 sm:text-h1">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

const STATUS = {
  local: { label: "Saved on this device", tone: "border-line-strong text-ink-2" },
  queued: { label: "Waiting to sync", tone: "border-line-strong text-ink-2" },
  uploaded: { label: "Sent to hub", tone: "border-field text-field-ink bg-field-wash" },
  approved: { label: "Approved", tone: "border-ok text-ok bg-ok-wash" },
  returned: { label: "Returned with edits", tone: "border-caution text-ink bg-caution-wash" },
} as const;

export type Status = keyof typeof STATUS;

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={cx("inline-flex min-h-8 items-center rounded-full border-2 px-3 text-meta font-semibold whitespace-nowrap", s.tone)}>{s.label}</span>;
}

/** Fault code: a fixed-width chip, read exactly. */
export function CodeChip({ code, title }: { code: string; title?: string }) {
  return (
    <span className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-plate border-2 border-ink px-2.5">
      <span className="code text-small">{code}</span>
      {title && <span className="truncate text-meta text-ink-2">{title}</span>}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  // The label wraps its control, so the two are associated without ids.
  return (
    <label className="block">
      <span className="mb-1.5 block text-meta font-semibold text-ink-2">{label}</span>
      <span className="block">{children}</span>
      {hint && <span className="mt-1 block text-meta text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "block w-full min-h-tap rounded-control border-2 border-line-strong bg-surface px-4 text-body text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none";
