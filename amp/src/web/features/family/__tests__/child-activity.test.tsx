import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, test, vi } from "vitest";
import { ChildActivity } from "../ChildActivity";

// The day's practice time never arrives in this test: the wait itself.
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(() => new Promise(() => {})),
}));
afterEach(cleanup);

test("while a child's practice time loads, the chart's room is held, so nothing below moves", () => {
  const client = new QueryClient();
  const place = {
    session: { accountId: "amp|parent", token: "t" },
    family: "fam",
    data: { today: { date: "2026-11-17" } },
  } as unknown as Parameters<typeof ChildActivity>[0]["place"];
  render(
    <QueryClientProvider client={client}>
      <ChildActivity
        place={place}
        learner="kid"
        record={{ weeks: [{ week: "2026-11-09", minutes: 12 }] } as never}
      />
    </QueryClientProvider>,
  );
  const reserve = document.querySelector("[data-activity-reserve]");
  expect(reserve).not.toBeNull();
  expect(reserve!.className).toMatch(/reserve/);
  expect(reserve!.textContent).toContain("Loading practice time");
  expect(screen.queryByRole("group")).toBeNull();
});

test("a child who has never practiced shows their line at once, in the chart's height", () => {
  const client = new QueryClient();
  const place = {
    session: { accountId: "amp|parent", token: "t" },
    family: "fam",
    data: { today: { date: "2026-11-17" } },
  } as unknown as Parameters<typeof ChildActivity>[0]["place"];
  render(
    <QueryClientProvider client={client}>
      <ChildActivity
        place={place}
        learner="kid"
        record={{ weeks: [{ week: "2026-11-09", minutes: 0 }] } as never}
      />
    </QueryClientProvider>,
  );
  expect(document.querySelector("[data-activity-reserve]")).toBeNull();
  // It holds the chart's height: a first practice arriving later moves
  // nothing below (the child page's Skills earned).
  expect(
    screen.getByText("No practice in the past two weeks.").className,
  ).toMatch(/reserve/);
});
