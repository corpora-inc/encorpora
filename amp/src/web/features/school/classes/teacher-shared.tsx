import { Link, useNavigate, useSearch } from "@tanstack/react-router";
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
import { spokenMath } from "../../../MathText";
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
/** A student's record. From a class it opens inside that class, over its
 * map (`map/<student>`), so the class's tabs stay (docs/design/ia.md); only
 * an admin coming from the school uses the school-level page. */
export const studentUrl = (org: string, student: string, classId?: string) =>
  classId
    ? `school/${org}/classes/${classId}/map/${student}`
    : `school/${org}/students/${student}`;
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
/** A hover, tap and focus readout for anything inside with `data-tip`. It
 * overlays the page, so it moves nothing. A tip may hold line breaks. A tap
 * on a touch screen shows it; a second tap, or one elsewhere, puts it away. */
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
      onPointerDown={(event: PointerEvent) => {
        if (event.pointerType === "mouse") return;
        const target = (event.target as Element | null)?.closest<HTMLElement>(
          "[data-tip]",
        );
        if (target && tip?.text === target.dataset.tip) setTip(null);
        else show(target ?? null);
      }}
      // A finger lifting also "leaves": only a mouse leaving puts it away.
      onPointerLeave={(event: PointerEvent) =>
        event.pointerType === "mouse" && setTip(null)
      }
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
export const resultTone = (result: WorkItem["result"]) => RESULTS[result].tone;
export function resultLabel(
  result: WorkItem["result"],
  reader: RecordReader = "other",
) {
  return result === "independent" && reader === "self"
    ? "On your own"
    : RESULTS[result].label;
}
/** The time of day an answer was given, in the reader's clock. */
export const clockTime = (iso: string) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
/** A prompt as one line of plain text: TeX read out, lines joined. */
export const promptLine = (prompt: string) =>
  spokenMath(prompt).replace(/\s+/g, " ").trim();

/** Real problems a student worked, newest first: when, the skill, the prompt
 * on one line, the answer and how it went. With `href`, each row opens its
 * replay (`WorkReplay`). */
export function WorkList({
  work,
  reader = "other",
  href,
}: {
  work: readonly WorkItem[];
  reader?: RecordReader;
  /** Where a row's replay lives, as a splat path and search. */
  href?: (item: WorkItem) => { path: string; search?: Record<string, string> };
}) {
  return (
    <ul className={styles.problems}>
      {work.map((item) => {
        const answered =
          item.answer === null
            ? null
            : `Answered ${promptLine(
                item.result === "missed" && item.response !== null
                  ? `${item.response}, correct answer ${item.answer}`
                  : item.answer,
              )}${item.review ? ", spaced review" : ""}`;
        const body = (
          <>
            <span className={styles.when}>
              <span>{shortDay(item.day)}</span>
              <span>{clockTime(item.at)}</span>
            </span>
            <span className={styles.workSkill}>{item.skill}</span>
            <span className={styles.workResult}>
              <Badge tone={RESULTS[item.result].tone}>
                {resultLabel(item.result, reader)}
              </Badge>
            </span>
            {item.prompt ? (
              <span className={styles.prompt} title={promptLine(item.prompt)}>
                {promptLine(item.prompt)}
              </span>
            ) : (
              <span className={styles.promptMissing}>
                Problem text not stored
              </span>
            )}
            {answered && (
              <span className={styles.answered} title={answered}>
                {answered}
              </span>
            )}
          </>
        );
        const target = href?.(item);
        return (
          <li key={item.id}>
            {target ? (
              <Link
                to="/$"
                params={{ _splat: target.path }}
                search={(target.search ?? {}) as never}
                className={styles.workRow}
                data-work-item={item.id}
              >
                {body}
                <svg
                  className={styles.workChevron}
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </Link>
            ) : (
              <div className={styles.workRow}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
