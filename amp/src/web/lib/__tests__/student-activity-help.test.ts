import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HELP_PER_SEND, noteHelp, resetHelpForTests } from "../help-events";
import { HELP_SEND_AFTER_MS, startActivity } from "../student-activity";

/* L6: help opened reaches the server within about 1.5 s, in the same
   heartbeat request, without changing what a learner is credited. */
const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
);
const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string));
const events = () => bodies().flatMap((b) => b.events ?? []);
const activeMs = () =>
  bodies()
    .flatMap((b) => b.deltas)
    .reduce((sum: number, d: { activeMs: number }) => sum + d.activeMs, 0);
const lesson = (ref: string) =>
  noteHelp({ kind: "lesson", source: "lessons", ref });
const touch = () => window.dispatchEvent(new Event("pointerdown"));
const start = () => startActivity(() => ({ url: "/beat", token: "t" }));

beforeEach(() => {
  vi.useFakeTimers();
  resetHelpForTests();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a help event is sent about 1.5 s later, to the heartbeat's own address", async () => {
  const activity = start();
  await vi.advanceTimersByTimeAsync(10_000);
  lesson("a");
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS - 1);
  expect(fetchMock).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]![0]).toBe("/beat");
  expect(events()).toMatchObject([{ kind: "lesson", ref: "a", ageMs: 1_500 }]);
  activity.stop();
});

test("opens within the window go in one request", async () => {
  const activity = start();
  lesson("a");
  await vi.advanceTimersByTimeAsync(500);
  lesson("b");
  await vi.advanceTimersByTimeAsync(500);
  lesson("c");
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(events().map((e) => e.ref)).toEqual(["a", "b", "c"]);
  // Nothing left for the regular heartbeat to repeat.
  await vi.advanceTimersByTimeAsync(60_000);
  activity.stop();
  expect(events()).toHaveLength(3);
});

test("more help than one request carries follows in the next early send", async () => {
  const activity = start();
  for (let i = 0; i < HELP_PER_SEND + 5; i++) lesson(`t-${i}`);
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  expect(bodies().map((b) => (b.events ?? []).length)).toEqual([
    HELP_PER_SEND,
    5,
  ]);
  activity.stop();
});

test("early sends never change the active time sent: the same total as heartbeats alone", async () => {
  const run = async (withHelp: boolean) => {
    fetchMock.mockClear();
    const activity = start();
    for (let s = 0; s < 70; s += 5) {
      touch();
      if (withHelp && s % 10 === 0) lesson(`t-${s}`);
      await vi.advanceTimersByTimeAsync(5_000);
    }
    activity.stop();
    await vi.runOnlyPendingTimersAsync();
    return {
      total: activeMs(),
      requests: fetchMock.mock.calls.length,
      help: events().length,
    };
  };
  const quiet = await run(false);
  const busy = await run(true);
  expect(busy.total).toBe(quiet.total);
  expect(busy.requests).toBeGreaterThan(quiet.requests);
  expect(busy.help).toBe(7);
});

test("a help event is neither lost nor counted twice when the early send and the heartbeat meet", async () => {
  const activity = start();
  // Opened 500 ms before the 30 s heartbeat: the heartbeat takes it, and the
  // early send that was waiting has nothing to add.
  await vi.advanceTimersByTimeAsync(29_500);
  lesson("a");
  await vi.advanceTimersByTimeAsync(500);
  expect(events()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(events()).toHaveLength(1);
  // A request still in flight when the next note arrives: one each.
  let release!: () => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        release = () => resolve(new Response(null, { status: 204 }));
      }),
  );
  lesson("b");
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  lesson("c");
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  release();
  await vi.advanceTimersByTimeAsync(40_000);
  activity.stop();
  expect(events().map((e) => e.ref)).toEqual(["a", "b", "c"]);
});

test("a failed early send keeps its help for the next send, once", async () => {
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  const activity = start();
  lesson("a");
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  lesson("b");
  await vi.advanceTimersByTimeAsync(HELP_SEND_AFTER_MS);
  expect(events().map((e) => e.ref)).toEqual(["a", "a", "b"]);
  // After the failure it waits for the heartbeat or the next note; no loop.
  await vi.advanceTimersByTimeAsync(60_000);
  activity.stop();
  const sent = events().map((e) => e.ref);
  expect(sent.filter((r) => r === "a")).toHaveLength(2); // failed try + success
  expect(sent.filter((r) => r === "b")).toHaveLength(1);
});

test("stopping sends what waits and leaves no timer behind", async () => {
  const activity = start();
  lesson("a");
  activity.stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(events()).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(events()).toHaveLength(1);
});
