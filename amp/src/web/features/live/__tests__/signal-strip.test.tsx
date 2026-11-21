import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SignalStrip, stripFit } from "../SignalStrip";
import { row, signal, START } from "./fixtures";

afterEach(cleanup);

const now = START + 600_000;
const gia = row("Gia Tran");
const hugo = row("Hugo Bell");
const mara = row("Mara Quill");

test("with nothing open the strip stays, quietly", () => {
  render(
    <SignalStrip
      signals={[]}
      now={now}
      onAcknowledge={vi.fn()}
      onResetPictures={vi.fn()}
    />,
  );
  const strip = screen.getByRole("region", { name: "Needs you" });
  expect(strip.textContent).toContain("No requests");
  expect(within(strip).queryByRole("button")).toBeNull();
});

test("each request names the student, how long ago, and its one action", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  const acknowledge = vi.fn();
  const reset = vi.fn();
  const hand = signal(gia, "hand", 90_000, now);
  const picture = signal(hugo, "forgot_picture", 30_000, now);
  render(
    <SignalStrip
      signals={[hand, picture]}
      now={now}
      onAcknowledge={acknowledge}
      onResetPictures={reset}
      pending={new Set([picture.id])}
    />,
  );
  const strip = screen.getByRole("region", { name: "Needs you" });
  // Oldest first.
  expect(strip.textContent).toMatch(/Gia Tran.*1 min.*Hugo Bell.*30s/);
  fireEvent.click(
    screen.getByRole("button", { name: "Got it: Gia Tran, hand raised" }),
  );
  expect(acknowledge).toHaveBeenCalledWith(hand);
  const busy = screen.getByRole("button", {
    name: "Reset: Hugo Bell, forgot picture",
  });
  expect(busy.getAttribute("aria-busy")).toBe("true");
  expect(busy).toHaveProperty("disabled", true);
  expect(reset).not.toHaveBeenCalled();
});

test("as many requests as fit show; the rest are one tap away in a sheet", () => {
  // A phone shows one; a desktop as many of 264 px as fit.
  expect(stripFit(358, 3)).toEqual({ shown: 1, chip: 264 });
  expect(stripFit(1120, 3)).toEqual({ shown: 3, chip: 264 });
  expect(stripFit(1120, 6)).toEqual({ shown: 3, chip: 264 });
  // A 320 px phone: one request, narrowed to leave room for "+N".
  expect(stripFit(288, 2)).toEqual({ shown: 1, chip: 216 });
  expect(stripFit(1120, 0)).toEqual({ shown: 0, chip: 264 });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  const reset = vi.fn();
  const signals = [
    signal(gia, "hand", 10_000, now),
    signal(hugo, "forgot_picture", 20_000, now),
    signal(mara, "hand", 30_000, now),
  ];
  render(
    <SignalStrip
      signals={signals}
      now={now}
      onAcknowledge={vi.fn()}
      onResetPictures={reset}
    />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  fireEvent.click(
    screen.getByRole("button", { name: "2 more requests: show all" }),
  );
  const sheet = screen.getByRole("dialog", { name: "Needs you" });
  expect(within(sheet).getAllByRole("listitem")).toHaveLength(3);
  fireEvent.click(
    within(sheet).getByRole("button", { name: /Reset pictures: Hugo Bell/ }),
  );
  expect(reset).toHaveBeenCalledWith(signals[1]);
});
