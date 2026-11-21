import { expect, test } from "vitest";
import type { LiveStatus } from "../../../../schools/live/contracts";
import {
  DEFAULT_LIVE_SORT,
  nextSort,
  signalsByPerson,
  sortedIds,
  type SortContext,
} from "../sort";
import { helped, iso, right, row, signal, START, wrong } from "./fixtures";

const ada = row("Ada", {
  problems: 12,
  correct: 12,
  level: 6.1,
  recent: [right, right, right, right, right],
});
const bram = row("bram", { problems: 7, correct: 4, level: 4.9 });
const calla = row("Calla", {
  problems: 5,
  correct: 1,
  level: null,
  recent: [helped, wrong, wrong, wrong],
});
const dev = row("Dev", {
  firstSeenAt: null,
  lastSeenAt: null,
  seenToday: false,
});
const finn = row("Finn", {
  problems: 2,
  correct: 2,
  lastAnswerAt: iso(10_000),
});
const gia = row("Gia", { problems: 7, correct: 7, level: 5.2 });
const rows = [gia, finn, dev, calla, bram, ada];
const names = (ids: string[]) =>
  ids.map((id) => rows.find((r) => r.personId === id)!.name);

const statuses = new Map<string, LiveStatus>([
  [ada.personId, "flying"],
  [bram.personId, "working"],
  [calla.personId, "struggling"],
  [dev.personId, "not_signed_in"],
  [finn.personId, "idle"],
  [gia.personId, "working"],
]);
const context: SortContext = { statuses, signals: new Map() };

test("each sort, with ties read A to Z whatever the direction", () => {
  expect(
    names(sortedIds(rows, { key: "name", direction: "ascending" }, context)),
  ).toEqual(["Ada", "bram", "Calla", "Dev", "Finn", "Gia"]);
  expect(
    names(sortedIds(rows, { key: "name", direction: "descending" }, context)),
  ).toEqual(["Gia", "Finn", "Dev", "Calla", "bram", "Ada"]);
  // Bram and Gia tie on 7: A to Z in both directions.
  expect(
    names(
      sortedIds(rows, { key: "problems", direction: "descending" }, context),
    ),
  ).toEqual(["Ada", "bram", "Gia", "Calla", "Finn", "Dev"]);
  expect(
    names(
      sortedIds(rows, { key: "problems", direction: "ascending" }, context),
    ),
  ).toEqual(["Dev", "Finn", "Calla", "bram", "Gia", "Ada"]);
  // No answers sorts below 0%.
  expect(
    names(
      sortedIds(rows, { key: "correct", direction: "descending" }, context),
    ),
  ).toEqual(["Ada", "Finn", "Gia", "bram", "Calla", "Dev"]);
  // No level sorts last when highest is first.
  expect(
    names(
      sortedIds(rows, { key: "level", direction: "descending" }, context),
    ).slice(0, 2),
  ).toEqual(["Ada", "Gia"]);
  expect(
    names(
      sortedIds(rows, { key: "level", direction: "descending" }, context),
    ).at(-1),
  ).toBe("Calla");
});

test("needs-you order: open requests oldest first, then needs help, quiet, not signed in, working, on a roll", () => {
  const now = START + 300_000;
  const asks = signalsByPerson([
    signal(gia, "hand", 30_000, now),
    signal(bram, "forgot_picture", 90_000, now),
  ]);
  expect(
    names(
      sortedIds(
        rows,
        { key: "attention", direction: "ascending" },
        { statuses, signals: asks },
      ),
    ),
  ).toEqual(["bram", "Gia", "Calla", "Finn", "Dev", "Ada"]);
  expect(
    names(
      sortedIds(rows, { key: "attention", direction: "ascending" }, context),
    ),
  ).toEqual(["Calla", "Finn", "Dev", "bram", "Gia", "Ada"]);
});

test("a tap on a new sort takes its first direction; the same one again reverses it, except needs-you, which re-sorts", () => {
  const problems = nextSort(DEFAULT_LIVE_SORT, "problems");
  expect(problems).toEqual({
    key: "problems",
    direction: "descending",
    version: 1,
  });
  expect(nextSort(problems, "problems")).toEqual({
    key: "problems",
    direction: "ascending",
    version: 2,
  });
  const attention = nextSort(problems, "attention");
  expect(attention).toEqual({
    key: "attention",
    direction: "ascending",
    version: 2,
  });
  expect(nextSort(attention, "attention")).toEqual({
    key: "attention",
    direction: "ascending",
    version: 3,
  });
  expect(nextSort(DEFAULT_LIVE_SORT, "name").direction).toBe("descending");
});
