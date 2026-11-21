import "./css-stub";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { holdBold } from "../dress";
import { arriveAfterPaint } from "../hue";

const root = document.documentElement;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame"],
  });
});
afterEach(() => {
  vi.useRealTimers();
  root.removeAttribute("data-look");
  root.removeAttribute("data-look-arriving");
  root.removeAttribute("style");
});

it("the dress goes on without a turn, and the world turns once the first problem has painted", () => {
  const release = holdBold("kid-1");
  expect(root.getAttribute("data-look")).toBe("bold");
  expect(root.hasAttribute("data-look-arriving")).toBe(true);
  arriveAfterPaint();
  vi.advanceTimersToNextFrame();
  expect(root.hasAttribute("data-look-arriving")).toBe(true);
  vi.advanceTimersToNextFrame();
  expect(root.hasAttribute("data-look-arriving")).toBe(false);
  release();
  expect(root.hasAttribute("data-look")).toBe(false);
});

it("a screen with no problem has arrived after a moment; a second host changes nothing", () => {
  const first = holdBold("kid-1");
  vi.advanceTimersByTime(1500);
  expect(root.hasAttribute("data-look-arriving")).toBe(false);
  const second = holdBold("kid-1");
  expect(root.hasAttribute("data-look-arriving")).toBe(false);
  first();
  expect(root.getAttribute("data-look")).toBe("bold");
  second();
  expect(root.hasAttribute("data-look")).toBe(false);
});

it("taking the dress off mid-arrival leaves nothing behind", () => {
  const release = holdBold("kid-1");
  release();
  expect(root.hasAttribute("data-look-arriving")).toBe(false);
  vi.advanceTimersByTime(2000);
  expect(root.hasAttribute("data-look-arriving")).toBe(false);
});
