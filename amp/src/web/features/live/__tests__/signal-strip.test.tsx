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
  // A 390 px phone names two requests side by side, and only a third
  // brings the "+N" button.
  expect(stripFit(358, 1)).toEqual({ shown: 1, chip: 175 });
  expect(stripFit(358, 2)).toEqual({ shown: 2, chip: 175 });
  expect(stripFit(358, 3)).toEqual({ shown: 1, chip: 175 });
  // A 320 px phone holds one, always clear of the button's place.
  expect(stripFit(288, 1)).toEqual({ shown: 1, chip: 224 });
  expect(stripFit(288, 2)).toEqual({ shown: 1, chip: 224 });
  // A tablet: two, and still two beside the button.
  expect(stripFit(720, 2)).toEqual({ shown: 2, chip: 264 });
  expect(stripFit(720, 5)).toEqual({ shown: 2, chip: 264 });
  // A desktop: four fit, three beside the button.
  expect(stripFit(1120, 3)).toEqual({ shown: 3, chip: 244 });
  expect(stripFit(1120, 4)).toEqual({ shown: 4, chip: 244 });
  expect(stripFit(1120, 6)).toEqual({ shown: 3, chip: 244 });
  expect(stripFit(1120, 0)).toEqual({ shown: 0, chip: 244 });
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
  expect(screen.getByRole("listitem").style.width).toBe("175px");
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

test("a request's width never depends on how many are open, and shown ones always fit", () => {
  for (let width = 240; width <= 1440; width += 7) {
    const { chip } = stripFit(width, 1);
    const room = width - (width >= 560 ? 120 : 0);
    for (let count = 0; count <= 12; count++) {
      const fit = stripFit(width, count);
      expect(fit.chip, `${width}px, ${count} open`).toBe(chip);
      const more = fit.shown < count ? 64 : 0;
      expect(
        fit.shown * chip + Math.max(0, fit.shown - 1) * 8 + more,
        `${width}px, ${count} open`,
      ).toBeLessThanOrEqual(room);
      // Never a "+N" while another whole request would fit without it.
      if (fit.shown < count)
        expect(count * chip + (count - 1) * 8).toBeGreaterThan(room);
      if (count > 0) expect(fit.shown).toBeGreaterThan(0);
    }
  }
});

test("two requests on a phone both show their names, with no “+1”", () => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  render(
    <SignalStrip
      signals={[
        signal(gia, "forgot_picture", 20_000, now),
        signal(hugo, "hand", 10_000, now),
      ]}
      now={now}
      onAcknowledge={vi.fn()}
      onResetPictures={vi.fn()}
    />,
  );
  const strip = screen.getByRole("region", { name: "Needs you" });
  expect(within(strip).getAllByRole("listitem")).toHaveLength(2);
  expect(strip.textContent).toMatch(/Gia Tran.*Hugo Bell/);
  expect(
    within(strip).queryByRole("button", { name: /more request/ }),
  ).toBeNull();
});
