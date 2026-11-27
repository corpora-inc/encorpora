import { type ButtonHTMLAttributes, type ReactNode, useId } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Minus, Plus, Settings as Gear } from "lucide-react";
import { useT } from "./useT.ts";

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "quiet" | "pass" | "fail";
const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-surface border-ink",
  secondary: "bg-surface text-ink border-line-strong",
  quiet: "bg-transparent text-ink border-transparent",
  pass: "bg-pass text-surface border-pass",
  fail: "bg-fail text-surface border-fail",
};

/**
 * `icon`: a square, icon-only button (give it an aria-label). Shape is a prop,
 * not a className override, because two padding utilities resolve by CSS
 * order, not by the order they are written.
 */
export function Button({ variant = "secondary", icon = false, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        "inline-flex min-h-tap items-center justify-center gap-2 rounded-control border-2 font-display text-small font-semibold whitespace-nowrap",
        icon ? "w-14 shrink-0" : "px-5",
        "disabled:opacity-40 active:translate-y-px",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant = "secondary", className, children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex min-h-tap items-center justify-center gap-2 rounded-control border-2 px-5 font-display text-small font-semibold whitespace-nowrap no-underline",
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** A designed single-choice control. Wraps to rows on narrow screens; labels never break mid-word. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: T | null;
  options: readonly { value: T; label: string; hint?: string }[];
  onChange(v: T): void;
  columns?: 1 | 2 | 3 | 4;
}) {
  const id = useId();
  const grid = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-1 min-[420px]:grid-cols-3", 4: "grid-cols-2 min-[560px]:grid-cols-4" }[columns ?? 3];
  return (
    <div role="radiogroup" aria-labelledby={id}>
      <div id={id} className="mb-2 text-small font-semibold text-ink-2">
        {label}
      </div>
      <div className={cx("grid gap-2", grid)}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cx(
                "flex min-h-tap flex-col items-start justify-center rounded-control border-2 px-4 py-2 text-left",
                on ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink",
              )}
            >
              <span className="font-display text-small font-semibold">{o.label}</span>
              {o.hint && <span className={cx("text-meta", on ? "text-surface/80" : "text-ink-3")}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Steps through a fixed list of values (load chart lengths, radii). */
export function Stepper({
  label,
  values,
  value,
  onChange,
  format,
}: {
  label: string;
  values: readonly number[];
  value: number;
  onChange(v: number): void;
  format(v: number): string;
}) {
  const t = useT();
  const i = values.indexOf(value);
  return (
    <div>
      <div className="mb-2 text-small font-semibold text-ink-2">{label}</div>
      <div className="flex items-stretch overflow-hidden rounded-control border-2 border-line bg-surface">
        <button type="button" aria-label={t("stepper.less", { label })} disabled={i <= 0} onClick={() => onChange(values[i - 1]!)} className="flex min-h-tap w-14 items-center justify-center disabled:opacity-30">
          <Minus aria-hidden size={22} />
        </button>
        <output aria-live="polite" className="flex flex-1 items-center justify-center border-x-2 border-line font-display text-h3 font-semibold tabular">
          {format(value)}
        </output>
        <button type="button" aria-label={t("stepper.more", { label })} disabled={i >= values.length - 1} onClick={() => onChange(values[i + 1]!)} className="flex min-h-tap w-14 items-center justify-center disabled:opacity-30">
          <Plus aria-hidden size={22} />
        </button>
      </div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-panel border border-line bg-surface p-4 sm:p-5", className)}>{children}</section>;
}

/** A list row that navigates. 56 px tall at minimum. */
export function Row({ to, title, meta, trailing }: { to: string; title: ReactNode; meta?: ReactNode; trailing?: ReactNode }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 border-b border-line px-4 py-3 text-ink no-underline last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {meta && <span className="block text-meta text-ink-3">{meta}</span>}
      </span>
      {trailing}
      <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-3" />
    </Link>
  );
}

export function List({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div>
      {label && <h2 className="mb-2 text-h3">{label}</h2>}
      <div className="overflow-hidden rounded-panel border border-line bg-surface">{children}</div>
    </div>
  );
}

/** Screen frame: a fixed-height header row, then content in a readable column. */
export function Page({
  title,
  up,
  actions,
  children,
}: {
  title: string;
  up?: { to: string; label: string } | "back";
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useT();
  // "default" is the first entry of this session: nothing in-app to go back to.
  const canGoBack = location.key !== "default";
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 sm:px-6">
      <header className="flex h-16 items-center gap-2">
        {up && (
          <button
            type="button"
            onClick={() => (up === "back" ? (canGoBack ? navigate(-1) : navigate("/learn/rules")) : navigate(up.to))}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 font-semibold text-ink-2"
          >
            <ChevronLeft aria-hidden size={22} />
            <span>{up === "back" ? t("nav.back") : up.label}</span>
          </button>
        )}
        <div className="flex-1" />
        {actions}
        <Link to="/settings" aria-label={t("nav.settings")} className="inline-flex size-11 items-center justify-center rounded-control text-ink-2 md:hidden">
          <Gear aria-hidden size={24} />
        </Link>
      </header>
      <h1 className="mb-5 text-h2 sm:text-display">{title}</h1>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

export function Meter({ value, low, high, label }: { value: number; low?: number; high?: number; label: string }) {
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
      {low !== undefined && high !== undefined && (
        <div className="absolute inset-y-0 bg-line-strong/40" style={{ left: `${low * 100}%`, width: `${Math.max(0, high - low) * 100}%` }} />
      )}
      <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

export { cx };
