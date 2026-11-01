import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test } from "vitest";
import { workbooksEnabled } from "../config";
import { WorkbookEntry } from "../WorkbookEntry";
import { localDate } from "../model";

afterEach(cleanup);
const learner = { id: "learner-1", name: "Maya", canPractice: true };

function renderEntry(props: Parameters<typeof WorkbookEntry>[0]) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <WorkbookEntry {...props} />,
    }),
    history: createMemoryHistory({ initialEntries: ["/family"] }),
  });
  return render(<RouterProvider router={router} />);
}

test("entry points stay hidden until the release flag is turned on", () => {
  expect(workbooksEnabled).toBe(false);
  const { container } = render(<WorkbookEntry learner={learner} />);
  expect(container.innerHTML).toBe("");
});

test("a learner without practice gets no workbook entry", () => {
  const { container } = render(
    <WorkbookEntry learner={{ ...learner, canPractice: false }} enabled />,
  );
  expect(container.innerHTML).toBe("");
});

test("enabled, it links to today's workbook and the history", async () => {
  renderEntry({ learner, enabled: true });
  const today = await screen.findByRole("link", {
    name: "Download today's workbook",
  });
  expect(today.getAttribute("href")).toBe(
    `/learners/learner-1/workbooks/${localDate()}`,
  );
  expect(
    screen.getByRole("link", { name: "Past workbooks" }).getAttribute("href"),
  ).toBe("/learners/learner-1/workbooks");
});
