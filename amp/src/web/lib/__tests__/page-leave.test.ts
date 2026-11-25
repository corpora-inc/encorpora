import { beforeEach, expect, test, vi } from "vitest";
import { createPageLeave, readWhileHere, type PageLeave } from "../page-leave";
import { fakeWindow, type FakeWindow } from "./fake-window";

let win: FakeWindow;
let page: PageLeave;
beforeEach(() => {
  win = fakeWindow();
  page = createPageLeave(win);
});

/** A read the test answers; each call records the signal it was given. */
function reads() {
  const calls: {
    signal: AbortSignal;
    resolve: (value: string) => void;
  }[] = [];
  const read = vi.fn(
    (signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ signal, resolve });
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  );
  return { calls, read };
}
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

test("beforeunload or pagehide: leaving, until the page is shown or used", () => {
  expect(page.leaving()).toBe(false);
  win.fire("beforeunload");
  expect(page.leaving()).toBe(true);
  win.fire("pointerdown");
  expect(page.leaving()).toBe(false);
  win.fire("pagehide", true);
  expect(page.leaving()).toBe(true);
  // After pagehide only pageshow brings it back.
  win.fire("focus");
  win.fire("keydown");
  expect(page.leaving()).toBe(true);
  win.fire("pageshow", false);
  expect(page.leaving()).toBe(true);
  win.fire("pageshow", true);
  expect(page.leaving()).toBe(false);
});

test("the leave signal aborts before any handler runs, and renews on return", () => {
  const first = page.leaveSignal();
  const order: string[] = [];
  first.addEventListener("abort", () => order.push("signal"));
  page.subscribe({
    leave: () => order.push(`leave ${first.aborted}`),
    back: () => order.push("back"),
  });
  win.fire("beforeunload");
  win.fire("pagehide");
  expect(order).toEqual(["signal", "leave true"]);
  expect(page.leaveSignal().aborted).toBe(true);
  win.fire("pageshow", true);
  expect(order.at(-1)).toBe("back");
  expect(page.leaveSignal().aborted).toBe(false);
});

test("a read in flight is aborted by the leave, then read again when back", async () => {
  const { calls, read } = reads();
  const result = readWhileHere(undefined, read, page);
  await settled();
  expect(read).toHaveBeenCalledTimes(1);
  win.fire("beforeunload");
  expect(calls[0]!.signal.aborted).toBe(true);
  await settled();
  // Waits: not an error, and nothing read while leaving.
  expect(read).toHaveBeenCalledTimes(1);
  win.fire("focus");
  await settled();
  expect(read).toHaveBeenCalledTimes(2);
  calls[1]!.resolve("fresh");
  await expect(result).resolves.toBe("fresh");
});

test("a read asked for while the page is leaving starts nothing", async () => {
  const { read } = reads();
  win.fire("beforeunload");
  win.fire("pagehide");
  void readWhileHere(undefined, read, page);
  await settled();
  expect(read).not.toHaveBeenCalled();
});

test("the query's own abort still ends the read with its reason", async () => {
  const { read } = reads();
  const query = new AbortController();
  win.fire("beforeunload");
  const waiting = readWhileHere(query.signal, read, page);
  query.abort(new Error("unmounted"));
  await expect(waiting).rejects.toThrow("unmounted");
  win.fire("pointerdown");
  const live = readWhileHere(query.signal, read, page);
  await expect(live).rejects.toThrow("unmounted");
  expect(read).not.toHaveBeenCalled();
});

test("a read that fails while the page is here fails", async () => {
  const failing = vi.fn(() => Promise.reject(new Error("refused")));
  await expect(readWhileHere(undefined, failing, page)).rejects.toThrow(
    "refused",
  );
});
