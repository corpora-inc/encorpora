import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFundingRefresh } from "./useFundingRefresh";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("refreshes pending purchases, skips hidden and busy tabs, and stops on completion", async () => {
  vi.useFakeTimers();
  let hidden = false,
    busy = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  const refresh = vi.fn(async () => {});
  const { rerender } = renderHook(
    ({ pending }) => useFundingRefresh("parent", pending, refresh, () => busy),
    { initialProps: { pending: true } },
  );
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(refresh).toHaveBeenCalledTimes(1);
  hidden = true;
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(refresh).toHaveBeenCalledTimes(1);
  hidden = false;
  busy = true;
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(refresh).toHaveBeenCalledTimes(1);
  busy = false;
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(refresh).toHaveBeenCalledTimes(2);
  rerender({ pending: false });
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(refresh).toHaveBeenCalledTimes(2);
});
it("does not overlap requests and uses the new account callback after switching", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  let finish!: () => void;
  const oldRefresh = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const newRefresh = vi.fn(async () => {});
  const { rerender, unmount } = renderHook(
    ({ identity, refresh }) =>
      useFundingRefresh(identity, true, refresh, () => false),
    { initialProps: { identity: "old", refresh: oldRefresh } },
  );
  await act(() => vi.advanceTimersByTimeAsync(90_000));
  expect(oldRefresh).toHaveBeenCalledTimes(1);
  rerender({ identity: "new", refresh: newRefresh });
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(newRefresh).toHaveBeenCalledTimes(1);
  await act(async () => finish());
  unmount();
  await act(() => vi.advanceTimersByTimeAsync(30_000));
  expect(newRefresh).toHaveBeenCalledTimes(1);
});
