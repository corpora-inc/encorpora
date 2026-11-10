import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import type {
  ClassTabId,
  WorkItem,
} from "../../../../schools/teacher-contracts";
import { MathText } from "../../../MathText";
import { Badge, type BadgeTone } from "../../../ui/Badge";
import { Button, buttonClass } from "../../../ui/Button";
import type { GridSort } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import "katex/dist/katex.min.css";
import styles from "./Teacher.module.css";

/** A class's screen, without the leading slash. */
export const classUrl = (
  org: string,
  id: string,
  tab: ClassTabId | "start" | "report-cards",
) => `school/${org}/classes/${id}/${tab}`;
export const studentUrl = (org: string, student: string) =>
  `school/${org}/students/${student}`;
export { buttonClass };

/** A screen's state lives in the URL, so refresh, Back and a shared link all
 * restore it. */
export function useClassSearch() {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const set = (
    patch: Record<string, string | number | undefined>,
    options: { replace?: boolean } = {},
  ) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      })) as never,
      replace: options.replace,
      resetScroll: false,
    });
  return [raw, set] as const;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A value from the address bar that may be nonsense: it recovers, not errors. */
export const uuidOr = (raw: unknown) =>
  typeof raw === "string" && UUID.test(raw) ? raw : undefined;
export function parseSort(raw: unknown): GridSort | undefined {
  if (typeof raw !== "string") return undefined;
  const [column, direction] = raw.split(":");
  if (!column || (direction !== "ascending" && direction !== "descending"))
    return undefined;
  return { column, direction };
}

const dayAt = (iso: string) => new Date(`${iso}T12:00:00Z`);
const inUtc = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
const SHORT = inUtc({ month: "short", day: "numeric" });
const LONG = inUtc({ month: "long", day: "numeric" });
const WEEKDAY = inUtc({ weekday: "long", month: "long", day: "numeric" });
export const shortDay = (iso: string) => SHORT.format(dayAt(iso));
export const longDay = (iso: string) => LONG.format(dayAt(iso));
export const fullDay = (iso: string) => WEEKDAY.format(dayAt(iso));
export const dayRange = (from: string, to: string) =>
  `${longDay(from)} to ${longDay(to)}`;
export const number = (value: number) => value.toLocaleString("en-US");
/** A hover and focus readout for anything inside with `data-tip`. It overlays
 * the page, so it moves nothing. */
export function TipZone({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [tip, setTip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const show = (element: Element | null) => {
    const target = element?.closest<HTMLElement>("[data-tip]");
    if (!target) return setTip(null);
    const box = target.getBoundingClientRect();
    setTip({
      text: target.dataset.tip!,
      x: Math.min(innerWidth - 150, Math.max(150, box.left + box.width / 2)),
      y: box.top,
    });
  };
  return (
    <div
      className={className}
      onPointerOver={(event: PointerEvent) =>
        event.pointerType === "mouse" && show(event.target as Element | null)
      }
      onPointerLeave={() => setTip(null)}
      onFocus={(event: FocusEvent) =>
        show(
          (event.target as HTMLElement).querySelector?.("[data-tip]") ?? null,
        )
      }
      onBlur={() => setTip(null)}
    >
      {children}
      {tip && (
        <div
          className={styles.tip}
          style={{ left: tip.x, top: tip.y }}
          aria-hidden="true"
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

/** A screen's data didn't arrive: what happened, and the step that works. */
export function LoadFailed({
  what,
  onRetry,
}: {
  what: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      title={`${what} didn’t load`}
      action={
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      }
    >
      Check your connection, then try again.
    </EmptyState>
  );
}

/** Who reads a record: a teacher or parent reads someone else's ("On their
 * own"); a learner reading their own work reads it to them ("On your own").
 * The other results read the same to both. */
export type RecordReader = "other" | "self";
const RESULTS: Record<WorkItem["result"], { label: string; tone: BadgeTone }> =
  {
    independent: { label: "On their own", tone: "success" },
    hint: { label: "With a hint", tone: "info" },
    paper: { label: "Marked on paper", tone: "neutral" },
    missed: { label: "Missed", tone: "danger" },
  };
export function resultLabel(
  result: WorkItem["result"],
  reader: RecordReader = "other",
) {
  return result === "independent" && reader === "self"
    ? "On your own"
    : RESULTS[result].label;
}
/** Real problems a student worked, as they read them. */
export function WorkList({
  work,
  reader = "other",
}: {
  work: readonly WorkItem[];
  reader?: RecordReader;
}) {
  return (
    <ul className={styles.problems}>
      {work.map((item) => (
        <li key={item.id}>
          <span className={styles.when}>{shortDay(item.day)}</span>
          <span className={styles.problem}>
            <span className={styles.prompt}>
              <MathText text={item.prompt} />
            </span>
            {item.answer !== null && (
              <span className={styles.answered}>
                {item.result === "missed" && item.response !== null ? (
                  <>
                    Answered <MathText text={item.response} />, correct answer{" "}
                    <MathText text={item.answer} />
                  </>
                ) : (
                  <>
                    Answered <MathText text={item.answer} />
                  </>
                )}
                {item.review ? ", spaced review" : ""}
              </span>
            )}
          </span>
          <Badge tone={RESULTS[item.result].tone}>
            {resultLabel(item.result, reader)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
