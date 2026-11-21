import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { liveTotals } from "../../../../schools/live/status";
import { LiveTotals } from "../LiveTotals";
import { row } from "./fixtures";

afterEach(cleanup);

test("five fixed tiles: here of the class, answering now, problems, percent correct, help used", () => {
  const totals = liveTotals([
    row("Ada", { problems: 10, correct: 9, hints: 2, videos: 1 }),
    row("Bram", { problems: 4, correct: 2, lessons: 1 }),
    row("Cal", { firstSeenAt: null, lastSeenAt: null, seenToday: false }),
  ]);
  const { container } = render(<LiveTotals totals={totals} answeringNow={1} />);
  const tiles = [...container.querySelectorAll("[data-tile]")].map((tile) =>
    tile.getAttribute("data-tile"),
  );
  expect(tiles).toEqual(["here", "answering", "problems", "correct", "help"]);
  for (const name of [
    "2 of 3 here",
    "1 answering now",
    "14 problems",
    "79% correct",
    "Help used 4 times",
  ])
    expect(screen.getByLabelText(name)).toBeTruthy();
});

test("before any answer, percent correct is a dash, said in words", () => {
  render(<LiveTotals totals={liveTotals([row("Ada")])} answeringNow={0} />);
  expect(screen.getByLabelText("No answers yet").textContent).toBe("—");
});
