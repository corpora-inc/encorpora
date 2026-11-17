import { beforeEach, expect, test } from "vitest";
import {
  changeWorkbookDay,
  useWorkbookDrafts,
  workbookDayKey,
} from "../draft-store";

beforeEach(() => useWorkbookDrafts.setState({ days: {} }));

const day = workbookDayKey("amp|a", "pip", "2026-11-17");

test("a day's draft is kept per account, learner and date", () => {
  changeWorkbookDay(day, { minutes: 60, draft: "d1" });
  changeWorkbookDay(workbookDayKey("amp|b", "pip", "2026-11-17"), {
    minutes: 30,
  });
  expect(useWorkbookDrafts.getState().days[day]).toEqual({
    minutes: 60,
    draft: "d1",
  });
});

test("a change merges, and undefined clears a field", () => {
  changeWorkbookDay(day, { minutes: 60, draft: "d1", paper: "a4" });
  // Issuing the draft: the day shows that workbook, its draft gone.
  changeWorkbookDay(day, { draft: undefined, number: 2 });
  expect(useWorkbookDrafts.getState().days[day]).toEqual({
    minutes: 60,
    paper: "a4",
    number: 2,
  });
});

test("only the most recent days are remembered", () => {
  for (let at = 0; at < 45; at++)
    changeWorkbookDay(workbookDayKey("amp|a", "pip", `d${at}`), {
      minutes: 30,
    });
  const days = Object.keys(useWorkbookDrafts.getState().days);
  expect(days).toHaveLength(40);
  expect(days.at(-1)).toBe(workbookDayKey("amp|a", "pip", "d44"));
  expect(days).not.toContain(workbookDayKey("amp|a", "pip", "d0"));
});
