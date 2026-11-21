import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SessionControl, type SessionControlProps } from "../SessionControl";
import { iso, session, START } from "./fixtures";

afterEach(cleanup);

const base: SessionControlProps = {
  live: null,
  now: START,
  length: null,
  onLengthChange: () => undefined,
  onStart: () => undefined,
  onStop: () => undefined,
  canManage: true,
  startLabel: "Start class",
};

test("at rest: Start with the chosen length, and every length to choose from", () => {
  const start = vi.fn();
  const length = vi.fn();
  render(
    <SessionControl
      {...base}
      length={15}
      onStart={start}
      onLengthChange={length}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start class" }));
  expect(start).toHaveBeenCalledWith(15);
  const radios = screen.getAllByRole("radio").map((radio) => radio.textContent);
  expect(radios).toEqual(["No limit", "10 min", "15 min", "20 min", "30 min"]);
  fireEvent.click(screen.getByRole("radio", { name: "No limit" }));
  expect(length).toHaveBeenCalledWith(null);
  // The narrow form steps through the same lengths.
  const spin = screen.getByRole("spinbutton");
  expect(spin.getAttribute("aria-valuetext")).toBe("15 min");
  fireEvent.keyDown(spin, { key: "ArrowUp" });
  expect(length).toHaveBeenLastCalledWith(20);
});

test("starting shows the wave on Start and takes no second tap", () => {
  const start = vi.fn();
  render(<SessionControl {...base} onStart={start} starting />);
  const button = screen.getByRole("button", { name: "Start class" });
  expect(button.getAttribute("aria-busy")).toBe("true");
  fireEvent.click(button);
  expect(start).not.toHaveBeenCalled();
});

test("running: the clock counts down to a planned end, else up, in fixed figures", () => {
  const { rerender } = render(
    <SessionControl
      {...base}
      live={session({ plannedEndAt: iso(20 * 60_000) })}
      now={START + 65_000}
    />,
  );
  expect(screen.getByRole("timer").textContent).toBe("18:55left of 20 min");
  rerender(<SessionControl {...base} live={session()} now={START + 65_000} />);
  expect(screen.getByRole("timer").textContent).toBe("1:05elapsed");
});

test("Stop asks first, in the app's own dialog, never the browser's", () => {
  const stop = vi.fn();
  const confirm = vi.spyOn(window, "confirm");
  render(
    <SessionControl
      {...base}
      live={session()}
      now={START + 600_000}
      onStop={stop}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(confirm).not.toHaveBeenCalled();
  const dialog = screen.getByRole("dialog", { name: "Stop the session?" });
  expect(dialog.textContent).toContain("It has run for 10 minutes.");
  fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
  expect(stop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
  expect(stop).toHaveBeenCalledTimes(1);
});

test("an adult who can't manage sees the clock without Stop, and no Start at rest", () => {
  const { rerender } = render(
    <SessionControl {...base} canManage={false} live={session()} now={START} />,
  );
  expect(screen.getByRole("timer")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  rerender(<SessionControl {...base} canManage={false} />);
  expect(screen.queryByRole("button", { name: "Start class" })).toBeNull();
  expect(screen.getByText("No session running")).toBeTruthy();
});
