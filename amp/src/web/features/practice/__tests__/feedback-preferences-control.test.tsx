import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { FeedbackPreferences } from "../FeedbackPreferences";
import { useFeedbackPreferences } from "../feedback-preferences";

/* An answer's sound and haptics are one control everywhere they appear:
   switches, each taking effect at once, never a checkbox in one menu and a
   switch in another. */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("sound and haptics are switches that take effect at once", () => {
  vi.stubGlobal("navigator", { ...navigator, vibrate: () => true });
  render(<FeedbackPreferences />);
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  const sound = screen.getByRole("switch", { name: "Sound" });
  const haptics = screen.getByRole("switch", { name: "Haptics" });
  const before = useFeedbackPreferences.getState().haptics;
  fireEvent.click(haptics);
  expect(useFeedbackPreferences.getState().haptics).toBe(!before);
  expect(sound).toBeTruthy();
});

test("no haptics switch where the device can't vibrate", () => {
  vi.stubGlobal("navigator", { ...navigator, vibrate: undefined });
  render(<FeedbackPreferences />);
  expect(screen.getByRole("switch", { name: "Sound" })).toBeTruthy();
  expect(screen.queryByRole("switch", { name: "Haptics" })).toBeNull();
});
