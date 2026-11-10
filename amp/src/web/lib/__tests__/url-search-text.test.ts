import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { URL_FOLLOW_MS, useUrlSearchText } from "../url-search-text";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(url = "") {
  vi.useFakeTimers();
  const write = vi.fn();
  const hook = renderHook(({ url }) => useUrlSearchText(url, write), {
    initialProps: { url },
  });
  return { write, ...hook };
}

it("shows every keystroke at once and writes the URL once after a pause", () => {
  const { result, write } = setup();
  for (const text of ["s", "sl", "slo", "slope "])
    act(() => result.current.change(text));
  expect(result.current.text).toBe("slope ");
  expect(write).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(URL_FOLLOW_MS));
  expect(write.mock.calls).toEqual([["slope"]]);
});

it("ignores its own write coming back while newer typing waits", () => {
  const { result, write, rerender } = setup();
  act(() => result.current.change("sl"));
  act(() => result.current.flush());
  act(() => result.current.change("slo"));
  // The router commits "sl" after "slo" was typed.
  rerender({ url: "sl" });
  expect(result.current.text).toBe("slo");
  act(() => vi.advanceTimersByTime(URL_FOLLOW_MS));
  expect(write.mock.calls).toEqual([["sl"], ["slo"]]);
});

it("takes a URL from elsewhere (Back, a link) and drops the pending write", () => {
  const { result, write, rerender } = setup("slope");
  act(() => result.current.change("slopes"));
  rerender({ url: "area" });
  expect(result.current.text).toBe("area");
  act(() => vi.advanceTimersByTime(URL_FOLLOW_MS * 2));
  expect(write).not.toHaveBeenCalled();
});

it("writes at once when cleared, and not again for a carried value", () => {
  const { result, write } = setup("slope");
  act(() => result.current.set(""));
  expect(write.mock.calls).toEqual([[""]]);
  act(() => result.current.change("area"));
  expect(result.current.carry()).toBe("area");
  act(() => vi.advanceTimersByTime(URL_FOLLOW_MS));
  expect(write.mock.calls).toEqual([[""]]);
});
