import { afterEach, expect, test, vi } from "vitest";
import { mediaMatches, onMediaChange } from "../media-query";

afterEach(() => vi.unstubAllGlobals());

test("follows a query with addEventListener", () => {
  const add = vi.fn();
  const remove = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: add,
    removeEventListener: remove,
  }));
  const listener = () => {};
  const stop = onMediaChange("(max-width: 480px)", listener);
  expect(mediaMatches("(max-width: 480px)")).toBe(true);
  expect(add).toHaveBeenCalledWith("change", listener);
  stop();
  expect(remove).toHaveBeenCalledWith("change", listener);
});

test("falls back to addListener in older WebKit", () => {
  const add = vi.fn();
  const remove = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addListener: add,
    removeListener: remove,
  }));
  const listener = () => {};
  onMediaChange("(max-width: 480px)", listener)();
  expect(add).toHaveBeenCalledWith(listener);
  expect(remove).toHaveBeenCalledWith(listener);
});

test("a bare stub, a throwing or a missing matchMedia never matches or throws", () => {
  for (const stub of [
    () => ({ matches: false }),
    () => {
      throw new TypeError("not supported");
    },
    undefined,
  ]) {
    vi.stubGlobal("matchMedia", stub);
    expect(mediaMatches("(max-width: 480px)")).toBe(false);
    expect(() => onMediaChange("(max-width: 480px)", () => {})()).not.toThrow();
  }
});
