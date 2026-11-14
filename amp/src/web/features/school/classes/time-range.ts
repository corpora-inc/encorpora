import { AppError } from "../../../lib/AppError";

/** The longest range any Time read serves, in inclusive calendar days
 * (the server's `time_range_too_long` bound, docs/schools.md). */
export const TIME_SPAN_DAYS = 400;

const DAY = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

/** A start never more than the limit before `to`: what every read that
 * names a start sends, so none asks for an unbounded range. */
export function boundedFrom(from: string, to: string): string {
  const earliest = shift(to, -(TIME_SPAN_DAYS - 1));
  return from < earliest ? earliest : from;
}

/** The start of the latest stretch a too-long range can show, ending today.
 * A day short of the limit each way, so the server's today (in the class's
 * timezone) a day either side of this device's still reads within it. */
export const latestFrom = (today: string) =>
  shift(today, -(TIME_SPAN_DAYS - 3));

/** This device's calendar day. */
export function localDay(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whether a read failed because its range is longer than the limit. */
export const tooLong = (error: unknown) =>
  error instanceof AppError && error.code === "time_range_too_long";
