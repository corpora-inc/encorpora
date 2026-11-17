import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { sheetOf, sheetState, useSheet } from "../sheet";

afterEach(cleanup);

let api: ReturnType<typeof useSheet> | null = null;
let other: ReturnType<typeof useSheet> | null = null;
function Screen() {
  api = useSheet("devices");
  other = useSheet("add-children");
  return (
    <p>
      {api.open ? "devices open" : "devices closed"} ·{" "}
      {other.open ? "add open" : "add closed"}
    </p>
  );
}

async function mount(initial: { href: string; state?: object }) {
  const history = createMemoryHistory({ initialEntries: ["/family/f"] });
  const router = createRouter({
    routeTree: createRootRoute({ component: Screen }),
    history,
  });
  if (initial.state) history.replace(initial.href, initial.state as never);
  render(<RouterProvider router={router} />);
  await screen.findByText(/devices/);
  return { router, history };
}

test("opening pushes the same address with the sheet in state; Back closes it", async () => {
  const { router, history } = await mount({ href: "/family/f" });
  expect(history.length).toBe(1);
  await act(async () => api!.show());
  expect(screen.getByText(/devices open/)).toBeTruthy();
  expect(router.state.location.href).toBe("/family/f");
  expect(history.length).toBe(2);
  // The browser's Back is the close.
  await act(async () => history.back());
  expect(screen.getByText(/devices closed/)).toBeTruthy();
  expect(router.state.location.href).toBe("/family/f");
});

test("✕ after opening goes Back: no entry is left for Back to reopen", async () => {
  const { history } = await mount({ href: "/family/f" });
  await act(async () => api!.show());
  await act(async () => api!.close());
  expect(screen.getByText(/devices closed/)).toBeTruthy();
  expect(history.location.state).not.toHaveProperty("sheet");
  // Forward would reopen it; Back has nothing of it left.
  expect(sheetOf(history.location.state)).toBeNull();
});

test("a sheet opened on arrival (a legacy hop) closes in place, never Back off the screen", async () => {
  const { router, history } = await mount({
    href: "/family/f",
    state: sheetState("devices"),
  });
  expect(screen.getByText(/devices open/)).toBeTruthy();
  const length = history.length;
  await act(async () => api!.close());
  expect(screen.getByText(/devices closed/)).toBeTruthy();
  expect(router.state.location.href).toBe("/family/f");
  expect(history.length).toBe(length);
});

test("one sheet at a time: opening another takes the open one's entry", async () => {
  const { history } = await mount({ href: "/family/f" });
  await act(async () => api!.show());
  await act(async () => other!.show());
  expect(screen.getByText(/devices closed · add open/)).toBeTruthy();
  expect(history.length).toBe(2);
  await act(async () => other!.close());
  expect(screen.getByText(/devices closed · add closed/)).toBeTruthy();
});
