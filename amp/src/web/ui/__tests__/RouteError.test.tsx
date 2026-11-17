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
  await screen.findByText("This page didn’t finish loading. Check your connection, then reload.");
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
  // A way out that always works, whatever state the screen was in.
  expect(
    screen.getByRole("link", { name: "Go home" }).getAttribute("href"),
  ).toBe("/");
});

test("a family child's map that fails offers its own map back and a reload, never a retry", () => {
  const family = "5b9f0f70-3d8e-45e4-a5f1-bbb98ee213d5";
  vi.stubGlobal("location", {
    ...window.location,
    pathname: `/family/${family}/kids/pip/pathways`,
    reload,
  });
  const reset = vi.fn();
  render(
    <RouteError
      error={new TypeError("x is undefined")}
      reset={reset}
      map={`/family/${family}/kids/pip/pathways`}
    />,
  );
  expect(
    screen.getByRole("link", { name: "Back to map" }).getAttribute("href"),
  ).toBe(`/family/${family}/kids/pip/pathways`);
  fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
  expect(reload).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});
