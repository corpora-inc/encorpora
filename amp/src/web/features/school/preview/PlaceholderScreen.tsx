import { Link, useParams } from "@tanstack/react-router";
import { buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { PreviewFrame } from "./PreviewFrame";

const screens: Record<
  string,
  { title: string; body: string; tab?: string; nav?: string }
> = {
  time: {
    title: "Time reports come next",
    body: "Active minutes by student, day and skill.",
    tab: "time",
  },
  workbooks: {
    title: "The workbook stack comes next",
    body: "Printable practice for the whole class, chosen student by student.",
    tab: "workbooks",
  },
  roster: {
    title: "The roster comes next",
    body: "Add students, print sign-in cards and move students between classes.",
    tab: "roster",
  },
  overview: {
    title: "The school overview comes next",
    body: "Seats, usage by class and who needs attention.",
    nav: "overview",
  },
  staff: {
    title: "Staff comes next",
    body: "Teachers and admins, and the classes each one sees.",
    nav: "staff",
  },
  calendar: {
    title: "The calendar comes next",
    body: "Terms and pacing, which the gradebook reads.",
    nav: "calendar",
  },
};

/** A screen the design covers and this preview has not reached: its URL works
 * and it says what will be here. */
export function PlaceholderScreen() {
  const { screen } = useParams({ strict: false }) as { screen?: string };
  const entry = screens[screen ?? ""] ?? {
    title: "This class comes next",
    body: "The preview draws one class for now.",
    nav: screen === "math-support" ? "support" : "club",
  };
  const place = {
    overview: "Overview",
    staff: "Staff",
    calendar: "Calendar",
    support: "Math Support",
    club: "Math Club",
  }[entry.nav ?? ""];
  return (
    <PreviewFrame tab={entry.tab} nav={entry.nav} title={place}>
      <EmptyState
        title={entry.title}
        action={
          <Link
            to="/$"
            params={{ _splat: "school/preview/today" }}
            className={buttonClass("secondary")}
          >
            Back to Today
          </Link>
        }
      >
        {entry.body}
      </EmptyState>
    </PreviewFrame>
  );
}
