import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  forgetHelp,
  HELP_PER_SEND,
  HelpQueue,
  helpUsedBefore,
  MAX_QUEUED_HELP,
  noteHelp,
  onHelp,
  resetHelpForTests,
} from "../help-events";
import {
  noteActiveProblem,
  noteAttention,
  showHelpSurface,
  startActivity,
} from "../student-activity";

const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
);
const bodies = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string));
beforeEach(() => {
  vi.useFakeTimers();
  resetHelpForTests();
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("a queue sends oldest first, a heartbeat's worth at a time, as ages", () => {
  const queue = new HelpQueue();
  for (let i = 0; i < 25; i++)
    queue.push({ kind: "lesson", source: "lessons", ref: `t-${i}` }, i * 1000);
  const first = queue.take(30_000);
  expect(first).toHaveLength(HELP_PER_SEND);
  expect(first[0]).toEqual({
    kind: "lesson",
    source: "lessons",
    ref: "t-0",
    ageMs: 30_000,
  });
  expect(first.at(-1)!.ageMs).toBe(11_000);
  // Unsent (offline) events go back in front with their times.
  queue.restore(first, 30_000);
  const again = queue.take(32_000);
  expect(again[0]).toMatchObject({ ref: "t-0", ageMs: 32_000 });
  expect(queue.size).toBe(5);
});

test("a queue nobody sends keeps only the newest", () => {
  const queue = new HelpQueue();
  for (let i = 0; i < MAX_QUEUED_HELP + 10; i++)
    queue.push({ kind: "hint", source: "practice", ref: `t-${i}` }, i);
  expect(queue.size).toBe(MAX_QUEUED_HELP);
  expect(queue.take(MAX_QUEUED_HELP + 10)[0]!.ref).toBe("t-10");
});

test("a hint step counts once a problem; the answer names what came before", () => {
  const got: string[] = [];
  const off = onHelp((note) => got.push(`${note.kind}${note.step ?? ""}`));
  const hint = { kind: "hint", source: "practice", problemId: "p1" } as const;
  noteHelp({ ...hint, step: 1 });
  noteHelp({ ...hint, step: 1 });
  noteHelp({ ...hint, step: 2 });
  noteHelp({ kind: "video", source: "practice", problemId: "p1" });
  noteHelp({ kind: "lesson", source: "lessons", ref: "x" });
  off();
  expect(got).toEqual(["hint1", "hint2", "video", "lesson"]);
  expect(helpUsedBefore("p1")).toEqual(["hint", "video"]);
  forgetHelp("p1");
  expect(helpUsedBefore("p1")).toEqual([]);
});

test("help rides on the heartbeat, with time under the help's surface", async () => {
  const activity = startActivity(() => ({ url: "/beat", token: "t" }));
  noteActiveProblem("p1");
  // Practice, touched: 10 s.
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(10_000);
  // A hint opens: recorded, and its 5 s are hint time.
  noteHelp({
    kind: "hint",
    source: "practice",
    ref: "add-within-20",
    problemId: "p1",
    step: 1,
  });
  const close = showHelpSurface({ surface: "hint", problemId: "p1" });
  await vi.advanceTimersByTimeAsync(5_000);
  close();
  // A film plays for 50 s with no touch: still attention, as video time.
  const film = showHelpSurface({ surface: "video", problemId: "p1" });
  for (let s = 0; s < 50; s += 10) {
    noteAttention();
    await vi.advanceTimersByTimeAsync(10_000);
  }
  film();
  await vi.advanceTimersByTimeAsync(15_000);
  activity.stop();
  await vi.runOnlyPendingTimersAsync();
  const sent = bodies();
  const deltas = sent.flatMap((b) => b.deltas);
  const by = (surface: string) =>
    deltas
      .filter((d: { surface: string }) => d.surface === surface)
      .reduce((sum: number, d: { activeMs: number }) => sum + d.activeMs, 0);
  expect(by("hint")).toBe(5_000);
  expect(by("video")).toBe(50_000);
  expect(deltas.every((d: { problemId?: string }) => d.problemId === "p1")).toBe(
    true,
  );
  const events = sent.flatMap((b) => b.events ?? []);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    kind: "hint",
    problemId: "p1",
    step: 1,
  });
  // Sent with the first heartbeat (30 s), 20 s after it happened.
  expect(events[0].ageMs).toBe(20_000);
});

test("a learner whose time isn't recorded sends nothing, help included", async () => {
  const activity = startActivity(() => null);
  noteHelp({ kind: "lesson", source: "lessons", ref: "x" });
  await vi.advanceTimersByTimeAsync(60_000);
  activity.stop();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("offline: help waits for the next heartbeat", async () => {
  fetchMock.mockRejectedValueOnce(new Error("offline"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const activity = startActivity(() => ({ url: "/beat", token: "t" }));
  noteHelp({ kind: "lesson", source: "pathways", ref: "x" });
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.advanceTimersByTimeAsync(30_000);
  activity.stop();
  const sent = bodies();
  expect(sent[0].events).toHaveLength(1);
  expect(sent[1].events).toHaveLength(1);
  expect(sent[1].events[0].ageMs).toBe(60_000);
});
