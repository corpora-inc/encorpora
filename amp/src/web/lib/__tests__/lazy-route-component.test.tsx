import { Component, Suspense, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { lazyRouteComponent } from "../lazy-route-component";

class Boundary extends Component<
  { children: ReactNode; caught: (error: unknown) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.caught(error);
  }
  render() {
    return this.state.failed ? <p>Manual recovery</p> : this.props.children;
  }
}

let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sessionStorage.clear();
  reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each(["available", "unavailable", "throws"])(
  "%s storage: route import failures reach the boundary without a loader-owned reload",
  async (mode) => {
    if (mode === "unavailable") vi.stubGlobal("sessionStorage", undefined);
    if (mode === "throws")
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("disabled", "SecurityError");
      });
    // The loader must leave all recovery decisions to the application boundary;
    // real payment/input/storage guards are exercised in the browser harness.
    const error = new TypeError(
      "Failed to fetch dynamically imported module: /assets/route.js",
    );
    const caught = vi.fn();
    const Route = lazyRouteComponent(() => Promise.reject(error));
    await Route.preload?.();
    render(
      <Boundary caught={caught}>
        <Suspense fallback="Waiting">
          <Route />
        </Suspense>
      </Boundary>,
    );
    await screen.findByText("Manual recovery");
    expect(caught).toHaveBeenCalledWith(error);
    expect(reload).not.toHaveBeenCalled();
  },
);

test("preload shares the import with rendering and preserves named-export props", async () => {
  const importer = vi.fn(async () => ({
    Screen: ({ label }: { label: string }) => <p>{label}</p>,
  }));
  const Route = lazyRouteComponent(importer, "Screen");
  await Promise.all([Route.preload?.(), Route.preload?.()]);
  render(
    <Suspense fallback="Waiting">
      <Route label="Loaded screen" />
    </Suspense>,
  );
  await screen.findByText("Loaded screen");
  expect(importer).toHaveBeenCalledOnce();
});

test("a failed speculative preload can retry before rendering", async () => {
  const importer = vi
    .fn()
    .mockRejectedValueOnce(new Error("temporary preload failure"))
    .mockResolvedValue({ default: () => <p>Retried screen</p> });
  const Route = lazyRouteComponent(importer);
  await Route.preload?.();
  await Route.preload?.();
  render(
    <Suspense fallback="Waiting">
      <Route />
    </Suspense>,
  );
  await screen.findByText("Retried screen");
  expect(importer).toHaveBeenCalledTimes(2);
});
