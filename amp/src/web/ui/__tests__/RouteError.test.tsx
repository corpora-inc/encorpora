import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const recovery = vi.hoisted(() => ({
  recover: vi.fn(() => true),
  dismiss: vi.fn(),
}));
vi.mock("../../lib/chunk-recovery", () => ({
  recoverChunkError: recovery.recover,
  chunkReloading: () => false,
  dismissChunkNotice: recovery.dismiss,
}));
import { RouteError } from "../LoadingScreen";

const cssFailure = new Error(
  "Unable to preload CSS for /assets/SignInScreen-ABCdef12.css",
);
let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  recovery.recover.mockClear();
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

test("a file that failed on the current release offers a reload, not a retry in place", async () => {
  const reset = vi.fn();
  render(<RouteError error={cssFailure} reset={reset} />);
  await screen.findByText("This screen could not be loaded.");
  expect(recovery.recover).toHaveBeenCalledWith(cssFailure, false);
  fireEvent.click(screen.getByRole("button", { name: "Reload" }));
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
