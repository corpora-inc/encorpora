import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

const recovery = vi.hoisted(() => ({
  stale: false,
  reload: vi.fn(() => new Promise<never>(() => {})),
}));
vi.mock("../../lib/app-recovery", () => ({
  buildIsStale: () => Promise.resolve(recovery.stale),
  reloadIntoCurrentRelease: recovery.reload,
}));
import { RouteError } from "../LoadingScreen";

const cssFailure = new Error(
  "Unable to preload CSS for /assets/SignInScreen-ABCdef12.css",
);
let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  recovery.stale = false;
  recovery.reload.mockClear();
  reload = vi.fn();
  vi.stubGlobal("location", {
    ...window.location,
    pathname: "/sign-in",
    reload,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a tab whose release was replaced loads the current one, showing only the wave", async () => {
  recovery.stale = true;
  render(<RouteError error={cssFailure} reset={() => {}} />);
  await act(() => Promise.resolve());
  expect(recovery.reload).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status", { name: "Loading AMP" })).toBeTruthy();
  expect(screen.queryByText("This screen could not be loaded.")).toBeNull();
});

test("a file that failed on the current release offers a reload, not a retry in place", async () => {
  const reset = vi.fn();
  render(<RouteError error={cssFailure} reset={reset} />);
  await screen.findByText("This screen could not be loaded.");
  expect(recovery.reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(reset).not.toHaveBeenCalled();
});

test("any other failure retries in place", () => {
  const reset = vi.fn();
  render(<RouteError error={new TypeError("x is undefined")} reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
});
