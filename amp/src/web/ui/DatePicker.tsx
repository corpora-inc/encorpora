import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePopover } from "./popover-owner";
import styles from "./DatePicker.module.css";

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const shown = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const monthName = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 15)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** A date, picked on a month grid. Arrows move by day and week, Page keys by
 * month, Home and End to the ends of the week, Enter chooses, Escape closes. The
 * dates are plain calendar days: no timezone can move them. */
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  error,
  placeholder = "Choose a date",
}: {
  label: string;
  /** Empty: nothing chosen yet, and the month opens on today. */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  error?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const startingDay = () => value || toIso(Date.now());
  const [active, setActive] = useState(startingDay);
  const grid = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // A picker is modal: it dismisses itself, and joins the app's popover
  // layer so opening it closes a tip or menu elsewhere.
  usePopover(open, {
    contains: (node) => !!grid.current?.closest("[role=dialog]")?.contains(node),
    anchor: () => trigger.current,
    close: () => setOpen(false),
    modal: true,
  });
  useEffect(() => {
    if (open) setActive(startingDay());
  }, [open, value]);
  // Focus follows the active day, also when the month changes under it.
  useEffect(() => {
    if (open)
      grid.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${active}"]`)
        ?.focus();
  }, [open, active]);
  const allowed = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  const activeDate = new Date(toTime(active));
  const year = activeDate.getUTCFullYear();
  const month = activeDate.getUTCMonth();
  const first = Date.UTC(year, month, 1);
  const lead = new Date(first).getUTCDay();
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const shiftMonth = (by: number) => {
    const target = new Date(Date.UTC(year, month + by, 1));
    const last = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    setActive(
      toIso(
        Date.UTC(
          target.getUTCFullYear(),
          target.getUTCMonth(),
          Math.min(activeDate.getUTCDate(), last),
        ),
      ),
    );
  };
  const choose = (iso: string) => {
    if (!allowed(iso)) return;
    onChange(iso);
    setOpen(false);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const time = toTime(active);
    const move: Record<string, number> = {
      ArrowLeft: time - DAY,
      ArrowRight: time + DAY,
      ArrowUp: time - 7 * DAY,
      ArrowDown: time + 7 * DAY,
      Home: time - activeDate.getUTCDay() * DAY,
      End: time + (6 - activeDate.getUTCDay()) * DAY,
    };
    if (event.key in move) {
      event.preventDefault();
      setActive(toIso(move[event.key]!));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      shiftMonth(event.key === "PageUp" ? -1 : 1);
    }
  };
  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${id}-label`}>
        {label}
      </span>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            className={styles.trigger}
            aria-labelledby={`${id}-label ${id}-value`}
            aria-invalid={!!error}
          >
            <span id={`${id}-value`}>{value ? shown(value) : placeholder}</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 5.5h12v11H4v-11Zm0 3.5h12M7.5 3v3.5M12.5 3v3.5" />
            </svg>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={styles.calendar}
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <Dialog.Title className={styles.title}>{label}</Dialog.Title>
            <div className={styles.header}>
              <button
                type="button"
                className={styles.step}
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m12 5-5 5 5 5" />
                </svg>
              </button>
              <span className={styles.month} aria-live="polite">
                {monthName(year, month)}
              </span>
              <button
                type="button"
                className={styles.step}
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m8 5 5 5-5 5" />
                </svg>
              </button>
            </div>
            <div
              ref={grid}
              className={styles.grid}
              role="grid"
              aria-label={monthName(year, month)}
              onKeyDown={onKeyDown}
            >
              <div className={styles.week} role="row">
                {WEEKDAYS.map((day) => (
                  <span
                    key={day}
                    className={styles.weekday}
                    role="columnheader"
                  >
                    {day}
                  </span>
                ))}
              </div>
              {Array.from(
                { length: Math.ceil((lead + length) / 7) },
                (_, row) => (
                  <div key={row} className={styles.week} role="row">
                    {Array.from({ length: 7 }, (_, column) => {
                      const day = row * 7 + column - lead + 1;
                      if (day < 1 || day > length)
                        return (
                          <span
                            key={column}
                            className={styles.blank}
                            role="gridcell"
                          />
                        );
                      const iso = toIso(Date.UTC(year, month, day));
                      return (
                        <span key={column} role="gridcell">
                          <button
                            type="button"
                            className={styles.day}
                            data-date={iso}
                            data-selected={iso === value || undefined}
                            aria-pressed={iso === value}
                            aria-label={shown(iso)}
                            aria-disabled={!allowed(iso) || undefined}
                            tabIndex={iso === active ? 0 : -1}
                            onClick={() => choose(iso)}
                          >
                            {day}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ),
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <span className={styles.error} role={error ? "alert" : undefined}>
        {error ?? ""}
      </span>
    </div>
  );
}
