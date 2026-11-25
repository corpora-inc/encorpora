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
  startLearnerActivity,
  startStudentActivity,
} from "../student-activity";
import { meKey, queryClient, sessionOptions } from "../query";
import { selectLearner } from "../../learner-store";

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
  expect(
    deltas.every((d: { problemId?: string }) => d.problemId === "p1"),
  ).toBe(true);
  const events = sent.flatMap((b) => b.events ?? []);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    kind: "hint",
    problemId: "p1",
    step: 1,
  });
  // Sent early, 1.5 s after it happened, not with the 30 s heartbeat.
  expect(events[0].ageMs).toBe(1_500);
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
  const said = vi.spyOn(console, "error").mockImplementation(() => {});
  const activity = startActivity(() => ({ url: "/beat", token: "t" }));
  noteHelp({ kind: "lesson", source: "pathways", ref: "x" });
  // The early send fails; the next heartbeat carries it, once.
  await vi.advanceTimersByTimeAsync(30_000);
  await vi.advanceTimersByTimeAsync(30_000);
  activity.stop();
  const sent = bodies();
  expect(sent[0].events).toHaveLength(1);
  expect(sent[0].events[0].ageMs).toBe(1_500);
  expect(sent[1].events).toHaveLength(1);
  expect(sent[1].events[0].ageMs).toBe(30_000);
  expect(sent.slice(2).flatMap((b) => b.events ?? [])).toHaveLength(0);
  expect(said).toHaveBeenCalled();
});

test("a student signed in after boot is counted, without a reload", async () => {
  // "Let Aug practice here": the app booted as the parent's, then the child's
  // session began in place. Its time goes to the school's activity route.
  sessionStorage.clear();
  localStorage.clear();
  const activity = startStudentActivity();
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock).not.toHaveBeenCalled();
  sessionStorage.setItem(
    "amp.student",
    JSON.stringify({ accountId: "school:p1", token: "st_fixture" }),
  );
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(10_000);
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(25_000);
  activity.stop();
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe("/api/v1/school/student/activity");
  expect((init.headers as Record<string, string>).Authorization).toBe(
    "Bearer st_fixture",
  );
  sessionStorage.clear();
});

test("a refused heartbeat is logged with its reason", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "request_origin_invalid" }), {
      status: 403,
    }),
  );
  const said = vi.spyOn(console, "error").mockImplementation(() => {});
  const activity = startActivity(() => ({ url: "/beat", token: "t" }));
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(30_000);
  activity.stop();
  expect(said).toHaveBeenCalledWith(
    "Active time not saved",
    403,
    "request_origin_invalid",
  );
});

const OWN = {
  signedIn: true,
  learners: [{ id: "child-a" }, { id: "child-b" }],
  adultPractice: {
    eligible: true,
    learner: { id: "adult-a", name: "Fixture", active: true },
  },
  practiceProfiles: [{ id: "profile-b" }],
};

test("an account sends its own learners' time: the adult's and a practice profile's", async () => {
  // An adult's sign-in is the adult: their own practice, then practice as
  // a profile of theirs. Each one's time goes to that learner.
  sessionStorage.clear();
  localStorage.clear();
  const account = "amp|parent-fixture";
  queryClient.setQueryData(sessionOptions.queryKey, {
    accountId: account,
    token: "parent-token",
  } as never);
  queryClient.setQueryData(meKey(account), OWN as never);
  selectLearner("adult-a", account);
  const activity = startLearnerActivity();
  activity.navigate("/practice");
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(12_000);
  // Choosing the profile sends the adult's own time first.
  selectLearner("profile-b", account);
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(7_000);
  // A child of theirs, or anyone else, gets nothing from this sign-in.
  for (const other of ["child-a", "someone-else"]) {
    selectLearner(other, account);
    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(5_000);
  }
  activity.stop();
  const sent = fetchMock.mock.calls.map(([url, init]) => ({
    url,
    auth: (init.headers as Record<string, string>).Authorization,
    ms: (JSON.parse(init.body as string).deltas as { activeMs: number }[])
      .map((d) => d.activeMs)
      .reduce((a, b) => a + b, 0),
  }));
  expect(sent).toEqual([
    {
      url: "/api/v1/learners/adult-a/activity",
      auth: "Bearer parent-token",
      ms: 12_000,
    },
    {
      url: "/api/v1/learners/profile-b/activity",
      auth: "Bearer parent-token",
      ms: 7_000,
    },
  ]);
  queryClient.clear();
});

test("a switch sends all of the first learner's time and help to them", async () => {
  sessionStorage.clear();
  localStorage.clear();
  const account = "amp|parent-fixture";
  queryClient.setQueryData(sessionOptions.queryKey, {
    accountId: account,
    token: "parent-token",
  } as never);
  queryClient.setQueryData(meKey(account), OWN as never);
  selectLearner("adult-a", account);
  const activity = startLearnerActivity();
  activity.navigate("/practice");
  // More deltas and help than one heartbeat carries.
  for (let i = 0; i < 14; i++) {
    noteActiveProblem(`p${i}`);
    window.dispatchEvent(new Event("pointerdown"));
    noteHelp({ kind: "lesson", source: "lessons", ref: `t-${i}` });
    await vi.advanceTimersByTimeAsync(1_000);
  }
  for (let i = 0; i < 10; i++)
    noteHelp({ kind: "lesson", source: "lessons", ref: `u-${i}` });
  selectLearner("profile-b", account);
  await vi.advanceTimersByTimeAsync(0);
  const toA = fetchMock.mock.calls.filter(([url]) =>
    String(url).includes("adult-a"),
  );
  const bodiesA = toA.map(([, init]) => JSON.parse(init.body as string));
  // Early sends split the time into more requests; none of it is lost.
  expect(
    bodiesA
      .flatMap((b) => b.deltas)
      .reduce((sum: number, d: { activeMs: number }) => sum + d.activeMs, 0),
  ).toBe(14_000);
  expect(bodiesA.flatMap((b) => b.events ?? [])).toHaveLength(24);
  // Nothing of the adult's own waits for the profile's heartbeat.
  window.dispatchEvent(new Event("pointerdown"));
  await vi.advanceTimersByTimeAsync(30_000);
  activity.stop();
  const toB = fetchMock.mock.calls
    .filter(([url]) => String(url).includes("profile-b"))
    .map(([, init]) => JSON.parse(init.body as string));
  expect(toB.flatMap((b) => b.events ?? [])).toHaveLength(0);
  expect(
    toB
      .flatMap((b) => b.deltas)
      .every(
        (d: { problemId?: string }) => !d.problemId || d.problemId === "p13",
      ),
  ).toBe(true);
  queryClient.clear();
});

test("an adult's tab with a child chosen sends nothing: not the app's address, Pathways, a lesson or a film", async () => {
  // The parent reads their child's pages on their own sign-in. Whatever the
  // address counts as, and whatever help they open, none of it is the
  // child's: a child's time is sent only from a tab that is the child's.
  sessionStorage.clear();
  localStorage.clear();
  const account = "amp|parent-fixture";
  queryClient.setQueryData(sessionOptions.queryKey, {
    accountId: account,
    token: "parent-token",
  } as never);
  queryClient.setQueryData(meKey(account), OWN as never);
  selectLearner("child-a", account);
  const activity = startLearnerActivity();
  for (const path of ["/", "/pathways", "/lessons/counting", "/practice"]) {
    activity.navigate(path);
    noteActiveProblem(`problem-on-${path}`);
    window.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(31_000);
  }
  // A film: help showing over the route, playing.
  const done = showHelpSurface({ surface: "video" });
  noteHelp({ kind: "video", source: "pathways", ref: "add-within-20" });
  noteAttention();
  await vi.advanceTimersByTimeAsync(31_000);
  done();
  window.dispatchEvent(new Event("pagehide"));
  activity.stop();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([]);
  // The same tab, handed to the child, is the child's: their own sign-in
  // sends, to the student's own address.
  sessionStorage.setItem(
    "amp.student",
    JSON.stringify({
      accountId: "school:child-a",
      token: `st_${"a".repeat(43)}`,
    }),
  );
  sessionStorage.setItem("amp.student.handed", "1");
  const handed = startStudentActivity();
  handed.navigate("/practice");
  window.dispatchEvent(new Event("pointerdown"));
  noteHelp({ kind: "hint", source: "practice", ref: "add-within-20", step: 1 });
  await vi.advanceTimersByTimeAsync(31_000);
  handed.stop();
  await vi.advanceTimersByTimeAsync(0);
  const urls = [...new Set(fetchMock.mock.calls.map(([url]) => url))];
  expect(urls).toEqual(["/api/v1/school/student/activity"]);
  expect(bodies().flatMap((body) => body.events ?? [])).toHaveLength(1);
  sessionStorage.clear();
  queryClient.clear();
});
