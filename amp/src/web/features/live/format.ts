import type { LiveRow } from "../../../schools/live/contracts";
import { shortGrade } from "../../ui/level-range/scale";

/* Numbers and times as the cockpit shows them. Every figure is short and
   of a bounded width, so a cell sized for its widest value never moves. */

/** "83%", or a dash before any answer. */
export function percentText(correct: number, problems: number) {
  return problems > 0 ? `${Math.round((correct / problems) * 100)}%` : "—";
}

/** Percent right, for sorting: no answers sort below 0%. */
export const percentValue = (row: Pick<LiveRow, "correct" | "problems">) =>
  row.problems > 0 ? row.correct / row.problems : -1;

/** A level in the grade words the class map and the gradebook use: "K",
 * "Gr 4", "Alg 1". The stored decimal (3.6, even a negative) is only for
 * sorting; nobody reads it. */
export const levelText = (level: number | null) =>
  level === null ? "—" : shortGrade(level);

/** How long ago, in at most six characters: "now", "45s", "3 min", "2 h". */
export function agoText(at: string | null, now: number) {
  if (at === null) return "—";
  const seconds = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h`;
}

/** The same, said in full for assistive technology. */
export function agoWords(at: string | null, now: number) {
  if (at === null) return "never";
  const seconds = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/** A row's last sign of life: an answer, help opened, or being seen. */
export function lastActive(row: LiveRow): string | null {
  const times = [row.lastAnswerAt, row.lastHelpAt, row.lastSeenAt].filter(
    (at): at is string => at !== null,
  );
  if (times.length === 0) return null;
  return times.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
}

/** A clock: "4:05", "12:30", "1:02:03". Minutes and seconds never drop a
 * digit once shown, so the figures hold their place. */
export function clockText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${ss}`
    : `${minutes}:${ss}`;
}

/** Help opened, all kinds together. */
export const helpCount = (row: {
  hints: number;
  lessons: number;
  examples: number;
  videos: number;
}) => row.hints + row.lessons + row.examples + row.videos;

/** "1 hint", "3 hints". */
export const counted = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
