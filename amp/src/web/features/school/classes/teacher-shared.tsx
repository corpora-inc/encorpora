import { closeSearch } from "../../../lib/return-to";
import { EntityLink } from "../../../nav/links";
import type { Entity } from "../../../nav/entities";
import {
  Link,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
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
import { usePopover } from "../../../ui/popover-owner";
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
  const router = useRouter();
  /** Closes what these keys opened (a sheet): Back to where it was opened,
   * as X and the browser's Back both do (lib/return-to.ts). */
  const close = (...keys: string[]) => closeSearch(router, ...keys);
  return [raw, set, close] as const;
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
/** A tip that is a small designed card rather than a line of text: a title,
 * one large figure, the distribution behind it, and a share with its bar.
 * Every part is optional; the same card serves every heat map. */
export type TipCard = {
  title: string;
  figure?: string;
  /** Under the figure: what it counts ("minutes per student, mean"). */
  unit?: string;
  stats?: { label: string; value: string }[];
  share?: { done: number; of: number; label: string };
  note?: string;
};
const cardText = (card: TipCard) =>
  [
    card.title,
    card.figure ? `${card.figure} ${card.unit ?? ""}`.trim() : "",
    card.stats?.map((stat) => `${stat.label} ${stat.value}`).join(" · ") ?? "",
    card.share?.label ?? "",
    card.note ?? "",
  ]
    .filter(Boolean)
    .join("\n");
/** The attributes that give an element a tip: a line, or a card. */
export const tipAttributes = (tip: string | TipCard | undefined) =>
  tip === undefined
    ? {}
    : typeof tip === "string"
      ? { "data-tip": tip }
      : { "data-tip": cardText(tip), "data-tip-card": JSON.stringify(tip) };

function TipCardView({ card }: { card: TipCard }) {
  return (
    <>
      <span className={styles.tipTitle}>{card.title}</span>
      {card.figure && (
        <span className={styles.tipFigure}>
          <b>{card.figure}</b>
          {card.unit && <span>{card.unit}</span>}
        </span>
      )}
      {card.stats && (
        <span className={styles.tipStats}>
          {card.stats.map((stat) => (
            <span key={stat.label}>
              <span>{stat.label}</span>
              <b>{stat.value}</b>
            </span>
          ))}
        </span>
      )}
      {card.share && (
        <span className={styles.tipShare}>
          <span>{card.share.label}</span>
          <span className={styles.tipBar} aria-hidden="true">
            <span
              style={{
                width: `${card.share.of ? (100 * card.share.done) / card.share.of : 0}%`,
              }}
            />
          </span>
        </span>
      )}
      {card.note && <span className={styles.tipNote}>{card.note}</span>}
    </>
  );
}

type OpenTip = {
  target: HTMLElement;
  text: string;
  card: TipCard | null;
  box: { left: number; top: number; bottom: number; width: number };
  /** A finger or mouse opened it, or keyboard focus. */
  via: "pointer" | "focus";
};
const boxOf = (target: HTMLElement) => {
  const box = target.getBoundingClientRect();
  return { left: box.left, top: box.top, bottom: box.bottom, width: box.width };
};

/** Hover (a mouse), tap (a finger) or keyboard focus shows an element's
 * `data-tip`, floating over the content without moving it: above the element,
 * or below it when there's more room there, never over it when either side
 * fits, and always inside the viewport. It is the app's one open popover
 * (`ui/popover-owner`): opening it closes any other, and a tap anywhere
 * outside, a scroll, Escape or Back closes it. A tap on the same element
 * again closes it; a tap on another moves it. */
export function TipZone({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<OpenTip | null>(null);
  const shown = useRef<OpenTip | null>(null);
  shown.current = tip;
  const floating = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ x: number; y: number } | null>(null);
  // The last press's pointer: a tap's click opens a tip, a mouse's hover does.
  const pressedWith = useRef("mouse");
  const tipId = useId();
  const open = tip !== null;
  usePopover(open, {
    contains: (node) => !!zone.current?.contains(node),
    anchor: () => zone.current,
    close: () => setTip(null),
    // Opened by focus, it follows its target as a keyboard walk scrolls.
    keepOnScroll: () => {
      const shownTip = shown.current;
      if (shownTip?.via !== "focus") return false;
      setPlace(null);
      setTip({ ...shownTip, box: boxOf(shownTip.target) });
      return true;
    },
  });
  // A tip opened by focus describes its target to a screen reader.
  const described = tip?.via === "focus" ? tip.target : null;
  useEffect(() => {
    if (!described) return;
    described.setAttribute("aria-describedby", tipId);
    return () => described.removeAttribute("aria-describedby");
  }, [described, tipId]);
  const show = (target: HTMLElement | null, via: OpenTip["via"]) => {
    if (!target?.dataset.tip) return setTip(null);
    const card = target.dataset.tipCard;
    setPlace(null);
    setTip({
      target,
      text: target.dataset.tip,
      card: card ? (JSON.parse(card) as TipCard) : null,
      box: boxOf(target),
      via,
    });
  };
  // Placed once its size is known, so it never shows anywhere else first.
  useLayoutEffect(() => {
    const element = floating.current;
    if (!tip || !element) return;
    const gap = 6;
    const edge = 8;
    const { width, height } = element.getBoundingClientRect();
    const centre = tip.box.left + tip.box.width / 2;
    const x = Math.min(
      innerWidth - edge - width,
      Math.max(edge, centre - width / 2),
    );
    const above = tip.box.top - gap - height;
    const below = tip.box.bottom + gap;
    const y =
      above >= edge
        ? above
        : below + height <= innerHeight - edge
          ? below
          : // Neither side fits: the roomier one, kept on screen.
            tip.box.top > innerHeight - tip.box.bottom
            ? Math.max(edge, above)
            : Math.min(below, innerHeight - edge - height);
    setPlace({ x, y });
  }, [tip]);
  const tipOf = (element: Element | null) =>
    element?.closest<HTMLElement>("[data-tip]") ?? null;
  return (
    <div
      ref={zone}
      className={className}
      onPointerDown={(event: PointerEvent) => {
        pressedWith.current = event.pointerType;
      }}
      onPointerOver={(event: PointerEvent) =>
        event.pointerType === "mouse" &&
        show(tipOf(event.target as Element), "pointer")
      }
      // A finger lifting also "leaves": only a mouse leaving puts it away.
      onPointerLeave={(event: PointerEvent) =>
        event.pointerType === "mouse" && setTip(null)
      }
      // A tap, not a press: a finger that goes on to scroll never opens one.
      onClick={(event: MouseEvent) => {
        if (pressedWith.current === "mouse" || event.detail === 0) return;
        const target = tipOf(event.target as Element);
        if (target && shown.current?.target === target) setTip(null);
        else show(target, "pointer");
      }}
      onFocus={(event: FocusEvent) => {
        const element = event.target as HTMLElement;
        // A tap focuses too; only the keyboard shows a tip by focus.
        if (!element.matches?.(":focus-visible")) return;
        show(
          element.matches("[data-tip]")
            ? element
            : element.querySelector<HTMLElement>("[data-tip]"),
          "focus",
        );
      }}
      onBlur={() => shown.current?.via === "focus" && setTip(null)}
    >
      {children}
      {tip && (
        <div
          ref={floating}
          className={tip.card ? styles.tipCard : styles.tip}
          style={{
            left: place?.x ?? 0,
            top: place?.y ?? 0,
            visibility: place ? undefined : "hidden",
          }}
          id={tipId}
          role="tooltip"
          aria-hidden={tip.via === "focus" ? undefined : true}
          data-tip-open=""
        >
          {tip.card ? <TipCardView card={tip.card} /> : tip.text}
        </div>
      )}
    </div>
  );
}

/**
 * A figure whose uncertainty is a tap away: the point value stays on the
 * page, quietly underlined, and its 95% range, n and spread open in the
 * shared tip (it must sit inside a `TipZone`). A real button, so a finger, a
 * mouse and the keyboard all reach it, and in a row that is a link it is its
 * own target, above the link. Its hit area reaches 44 px without moving the
 * line it sits on.
 */
export function FigureTip({
  tip,
  children,
  className = "",
}: {
  tip: TipCard;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.figureTip} ${className}`}
      aria-label={cardText(tip).replace(/\n/g, ". ")}
      data-figure-tip=""
      {...tipAttributes(tip)}
    >
      {children}
    </button>
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
const workChevron = (
  <svg className={styles.workChevron} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

export function WorkList({
  work,
  reader = "other",
  href,
}: {
  work: readonly WorkItem[];
  reader?: RecordReader;
  /** Where a row's replay lives, as a splat path and search. */
  href?: (item: WorkItem) =>
    | { path: string; search?: Record<string, string> }
    /** A layer over this page (nav/entities.ts). */
    | { entity: Entity };
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
            {target && "entity" in target ? (
              <EntityLink
                entity={target.entity}
                className={styles.workRow}
                data-work-item={item.id}
              >
                {body}
                {workChevron}
              </EntityLink>
            ) : target ? (
              <Link
                to="/$"
                params={{ _splat: target.path }}
                search={(target.search ?? {}) as never}
                className={styles.workRow}
                data-work-item={item.id}
              >
                {body}
                {workChevron}
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
