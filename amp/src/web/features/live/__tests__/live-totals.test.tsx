import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { liveTotals } from "../../../../schools/live/status";
import { answeringNow, hereNow, liveStatuses } from "../LiveRoster";
import { LiveTotals } from "../LiveTotals";
import { iso, row, START } from "./fixtures";

afterEach(cleanup);

test("five fixed tiles: here of the class, answering now, problems, percent correct, help used", () => {
  const rows = [
    row("Ada", { problems: 10, correct: 9, hints: 2, videos: 1 }),
    row("Bram", { problems: 4, correct: 2, lessons: 1 }),
    row("Cal", { firstSeenAt: null, lastSeenAt: null }),
  ];
  const totals = liveTotals(rows, { now: START, startedAt: iso(0) });
  const here = hereNow(liveStatuses(rows, { now: START, startedAt: iso(0) }));
  expect(here).toBe(totals.present);
  const { container } = render(
    <LiveTotals totals={totals} hereNow={here} answeringNow={1} />,
  );
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
  render(
    <LiveTotals
      totals={liveTotals([row("Ada")], { now: START, startedAt: iso(0) })}
      hereNow={1}
      answeringNow={0}
    />,
  );
  expect(screen.getByLabelText("No answers yet").textContent).toBe("—");
});

test("Here turns with the clock: seen before the session, then nothing in it", () => {
  // Signed in five minutes before Start and did nothing since.
  const rows = [
    row("Ada", { problems: 1, correct: 1, lastAnswerAt: iso(30_000) }),
    row("Dov", { firstSeenAt: null, lastSeenAt: iso(-5 * 60_000) }),
  ];
  const here = (ms: number) =>
    hereNow(liveStatuses(rows, { now: START + ms, startedAt: iso(0) }));
  expect(here(4 * 60_000)).toBe(2);
  // Here by a sighting before the session is never "answering now".
  expect(
    answeringNow(
      liveStatuses(rows, { now: START + 60_000, startedAt: iso(0) }),
    ),
  ).toBe(1);
  expect(
    liveStatuses(rows, { now: START + 1000, startedAt: iso(0) }).get(
      rows[1]!.personId,
    ),
  ).toBe("idle");
  expect(here(5 * 60_000)).toBe(1);
  expect(
    liveTotals(rows, { now: START + 4 * 60_000, startedAt: iso(0) }).present,
  ).toBe(2);
  expect(
    liveTotals(rows, { now: START + 5 * 60_000, startedAt: iso(0) }).present,
  ).toBe(1);
  render(
    <LiveTotals
      totals={liveTotals(rows, { now: START, startedAt: iso(0) })}
      hereNow={here(5 * 60_000)}
      answeringNow={0}
    />,
  );
  expect(screen.getByLabelText("1 of 2 here")).toBeTruthy();
});
