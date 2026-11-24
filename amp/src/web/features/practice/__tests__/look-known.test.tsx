import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryClient } from "../../../lib/query";
import { useLookKnown } from "../look-known";
import { practiceSettingsOptions } from "../practice-settings";

const server = vi.hoisted(() => ({
  reads: [] as string[],
  answer: null as null | ((value: unknown) => void),
  hold: false,
  state: { effectiveLook: "bold", lookLocked: false } as object,
}));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn((path: string) => {
    server.reads.push(path);
    return server.hold
      ? new Promise((resolve) => (server.answer = resolve))
      : Promise.resolve(server.state);
  }),
}));
let learner = 0;
let scope = { identity: "account-1", learnerId: "" };
beforeEach(() => {
  vi.useFakeTimers();
  queryClient.clear();
  server.reads = [];
  server.hold = false;
  server.state = { effectiveLook: "bold", lookLocked: false };
  scope = { identity: "account-1", learnerId: `kid-${++learner}` };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Menu({ open, whose = true }: { open: boolean; whose?: boolean }) {
  const shown = useLookKnown(open, whose ? scope : null);
  return (
    <>
      <button type="button" data-navigation-trigger="">
        Menu
      </button>
      {shown ? <div role="dialog" /> : null}
    </>
  );
}
const dialog = () => screen.queryByRole("dialog");
const known = () =>
  queryClient.getQueryData(practiceSettingsOptions(scope).queryKey);

test("a menu with no learner's look in it opens at once and reads nothing", () => {
  render(<Menu open whose={false} />);
  expect(dialog()).not.toBeNull();
  expect(server.reads).toEqual([]);
});

test("a learner's menu comes in once their look has been read for this opening", async () => {
  server.hold = true;
  const view = render(<Menu open={false} />);
  view.rerender(<Menu open />);
  expect(dialog()).toBeNull();
  expect(server.reads).toHaveLength(1);
  server.state = { effectiveLook: "calm", lookLocked: true };
  await act(async () => server.answer!(server.state));
  await act(async () => vi.advanceTimersByTime(1));
  // What every screen reads is current before the menu paints.
  expect(known()).toEqual(server.state);
  expect(dialog()).not.toBeNull();
  // Closed and opened again at once: a read of its own, and the wait.
  view.rerender(<Menu open={false} />);
  expect(dialog()).toBeNull();
  view.rerender(<Menu open />);
  expect(server.reads).toHaveLength(2);
  expect(dialog()).toBeNull();
  await act(async () => server.answer!(server.state));
  await act(async () => vi.advanceTimersByTime(1));
  expect(dialog()).not.toBeNull();
});

test("a press on the menu's button reads ahead of its click: one read for the press and the opening", async () => {
  const view = render(<Menu open={false} />);
  await act(async () => {
    screen
      .getByRole("button", { name: "Menu" })
      .dispatchEvent(new Event("pointerdown", { bubbles: true }));
  });
  expect(server.reads).toHaveLength(1);
  await act(async () => view.rerender(<Menu open />));
  await act(async () => vi.advanceTimersByTime(1));
  expect(server.reads).toHaveLength(1);
  expect(dialog()).not.toBeNull();
});

test("a network slower than the menu waits for: it opens from what was last read", async () => {
  server.hold = true;
  const view = render(<Menu open={false} />);
  view.rerender(<Menu open />);
  await act(async () => vi.advanceTimersByTime(399));
  expect(dialog()).toBeNull();
  await act(async () => vi.advanceTimersByTime(2));
  expect(dialog()).not.toBeNull();
});

test("a read that fails doesn't keep the menu shut", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  server.hold = true;
  const view = render(<Menu open={false} />);
  view.rerender(<Menu open />);
  const { request } = await import("../../../lib/api");
  expect(request).toHaveBeenCalled();
  await act(async () => server.answer!(Promise.reject(new Error("offline"))));
  await act(async () => vi.advanceTimersByTime(1));
  expect(dialog()).not.toBeNull();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});
