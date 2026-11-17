import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { FlowSteps } from "../FlowSteps";

afterEach(cleanup);

const steps = [
  { id: "", label: "Your kids" },
  { id: "ready", label: "First practice" },
  { id: "plan", label: "Plan" },
];

async function renderAt(current: number) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <FlowSteps
          steps={steps}
          current={current}
          href={(id) => (id ? `/start/parent/${id}` : "/start/parent")}
        />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText(`Step ${current + 1} of 3`);
}

test("a done step links to its own address; the current is marked; ahead is inert", async () => {
  await renderAt(1);
  const done = screen.getByRole("link", { name: "Your kids" });
  expect(done.getAttribute("href")).toBe("/start/parent");
  expect(screen.queryByRole("link", { name: "First practice" })).toBeNull();
  expect(
    screen
      .getByText("First practice")
      .closest("[aria-current]")
      ?.getAttribute("aria-current"),
  ).toBe("step");
  expect(screen.queryByRole("link", { name: "Plan" })).toBeNull();
  // Never a Back control: the stepper is the way back inside a flow.
  expect(screen.queryByRole("link", { name: /back/i })).toBeNull();
});

test("a flow of one step shows no stepper", () => {
  const { container } = render(<FlowSteps steps={[steps[0]!]} current={0} />);
  expect(container.firstChild).toBeNull();
});
