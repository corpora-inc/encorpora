import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LiveRow, LiveSnapshot } from "../../../../schools/live/contracts";
import { LIVE_RULES, liveTotals } from "../../../../schools/live/status";
import type { AuthSession } from "../../../auth";
import type { LiveStreamOptions } from "../../../lib/live-stream";
import { sessionOptions } from "../../../lib/query";
import { applyLiveMessage, liveKey, studentLiveKey } from "../api";
import { useLiveClass } from "../useLiveClass";
import { useStudentLive } from "../useStudentLive";

const opened: (LiveStreamOptions & { close: ReturnType<typeof vi.fn> })[] = [];
vi.mock("../../../lib/live-stream", () => ({
  openLiveStream: (options: LiveStreamOptions) => {
    const close = vi.fn();
    opened.push({ ...options, close });
    return { close, mode: "connecting" };
  },
}));

afterEach(cleanup);
beforeEach(() => {
  opened.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const ORG = "11111111-1111-4111-8111-111111111111";
const CLASS = "22222222-2222-4222-8222-222222222222";
const SESSION = "33333333-3333-4333-8333-333333333333";
const person = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const NOW = "2026-11-20T15:00:00.000Z";
const row = (
  n: number,
  name: string,
  extra: Partial<LiveRow> = {},
): LiveRow => ({
  personId: person(n),
  name,
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  skill: null,
  level: null,
  recent: [],
  firstSeenAt: null,
  firstAnswerAt: null,
  lastAnswerAt: null,
  lastHelpAt: null,
  lastSeenAt: null,
  seenToday: false,
  ...extra,
});
const snapshot = (rows: LiveRow[]): LiveSnapshot => ({
  serverNow: NOW,
  session: {
    id: SESSION,
    classId: CLASS,
    startedAt: NOW,
    plannedEndAt: null,
    endsAt: "2026-11-20T19:00:00.000Z",
    endedAt: null,
    endReason: null,
    startedBy: null,
    endedBy: null,
    rulesVersion: 1,
  },
  rules: LIVE_RULES,
  rows,
  totals: liveTotals(rows),
  signals: [],
  can: { manage: true },
});
const answered = row(1, "Ana", {
  problems: 3,
  correct: 2,
  independent: 2,
  recent: [
    { correct: true, assisted: false },
    { correct: false, assisted: false },
    { correct: true, assisted: false },
  ],
  firstSeenAt: NOW,
  lastAnswerAt: NOW,
  seenToday: true,
});

test("a snapshot replaces; rows merge by person and the totals follow", () => {
  const held = snapshot([row(1, "Ana"), row(2, "Ben")]);
  const next = applyLiveMessage(held, "rows", {
    serverNow: "2026-11-20T15:00:05.000Z",
    sessionId: SESSION,
    rows: [answered],
  })!;
  expect(next.rows.map((r) => [r.name, r.problems])).toEqual([
    ["Ana", 3],
    ["Ben", 0],
  ]);
  expect(next.totals).toMatchObject({ students: 2, present: 1, problems: 3 });
  expect(next.serverNow).toBe("2026-11-20T15:00:05.000Z");
  // The same message twice changes nothing more.
  expect(
    applyLiveMessage(next, "rows", {
      serverNow: "2026-11-20T15:00:05.000Z",
      sessionId: SESSION,
      rows: [answered],
    }),
  ).toEqual(next);
  // A student who joined mid-session takes their place by name.
  const joined = applyLiveMessage(next, "rows", {
    serverNow: NOW,
    sessionId: SESSION,
    rows: [row(3, "Aby")],
  })!;
  expect(joined.rows.map((r) => r.name)).toEqual(["Aby", "Ana", "Ben"]);
  expect(joined.totals.students).toBe(3);
  const replaced = snapshot([row(2, "Ben")]);
  expect(applyLiveMessage(next, "snapshot", replaced)).toEqual(replaced);
});

test("stale, unknown or unreadable messages leave the cache alone", () => {
  const held = snapshot([row(1, "Ana")]);
  const other = applyLiveMessage(held, "rows", {
    serverNow: NOW,
    sessionId: "44444444-4444-4444-8444-444444444444",
    rows: [answered],
  });
  expect(other).toBe(held);
  expect(applyLiveMessage(held, "rows", { rows: "nope" })).toBe(held);
  expect(applyLiveMessage(held, "snapshot", { session: 1 })).toBe(held);
  expect(applyLiveMessage(held, "bye", { reason: "rotate" })).toBe(held);
  expect(console.error).toHaveBeenCalledTimes(2);
  // Nothing held yet: rows wait for the snapshot.
  expect(
    applyLiveMessage(undefined, "rows", {
      serverNow: NOW,
      sessionId: SESSION,
      rows: [answered],
    }),
  ).toBeUndefined();
});

test("signals replace the list", () => {
  const signal = {
    id: "55555555-5555-4555-8555-555555555555",
    personId: person(1),
    name: "Ana",
    kind: "hand" as const,
    createdAt: NOW,
  };
  const held = snapshot([row(1, "Ana")]);
  expect(
    applyLiveMessage(held, "signals", { signals: [signal] })!.signals,
  ).toEqual([signal]);
  expect(applyLiveMessage(held, "signals", { signals: [] })!.signals).toEqual(
    [],
  );
});

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
const queries = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

test("useLiveClass patches the one cache entry and closes its stream on unmount", async () => {
  const client = queries();
  const session = { accountId: "amp|teacher", token: "t-1" };
  client.setQueryData(sessionOptions.queryKey, session);
  const place = { org: ORG, class: CLASS };
  client.setQueryData(liveKey(session, place), snapshot([row(1, "Ana")]));
  const hook = renderHook(() => useLiveClass(place), { wrapper: wrap(client) });
  expect(opened).toHaveLength(1);
  expect(opened[0]!.path).toBe(`/school/classes/${CLASS}/live/stream`);
  expect(opened[0]!.token).toBe("t-1");
  act(() =>
    opened[0]!.onEvent("rows", {
      serverNow: NOW,
      sessionId: SESSION,
      rows: [answered],
    }),
  );
  expect(
    client.getQueryData<LiveSnapshot>(liveKey(session, place))!.rows[0]!
      .problems,
  ).toBe(3);
  // Every reader of the entry sees it (Query notifies on its own tick).
  await waitFor(() =>
    expect(hook.result.current.data!.rows[0]!.problems).toBe(3),
  );
  expect(
    client.getQueryData<LiveSnapshot>(liveKey(session, place))!.totals.problems,
  ).toBe(3);
  hook.unmount();
  expect(opened[0]!.close).toHaveBeenCalledTimes(1);
});

test("useStudentLive: a student's own state; nothing for an adult", async () => {
  const client = queries();
  const student = { accountId: "school:abc", token: "st_token" };
  client.setQueryData(sessionOptions.queryKey, student);
  client.setQueryData(studentLiveKey(student), {
    serverNow: NOW,
    sessions: [],
    signals: [],
  });
  const hook = renderHook(() => useStudentLive(), { wrapper: wrap(client) });
  expect(hook.result.current.inSession).toBe(false);
  expect(opened.map((o) => o.path)).toEqual(["/school/student/live/stream"]);
  act(() =>
    opened[0]!.onEvent("snapshot", {
      serverNow: NOW,
      sessions: [{ id: SESSION, classId: CLASS, startedAt: NOW, endsAt: NOW }],
      signals: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          classId: CLASS,
          personId: person(1),
          kind: "hand",
          createdAt: NOW,
          resolvedAt: NOW,
          resolution: "acknowledged",
        },
      ],
    }),
  );
  await waitFor(() => expect(hook.result.current.inSession).toBe(true));
  expect(hook.result.current.signals[0]!.resolution).toBe("acknowledged");
  hook.unmount();
  expect(opened[0]!.close).toHaveBeenCalledTimes(1);

  const adults = queries();
  const parent: AuthSession = { accountId: "amp|parent", token: "t-2" };
  adults.setQueryData(sessionOptions.queryKey, parent);
  const adult = renderHook(() => useStudentLive(), { wrapper: wrap(adults) });
  expect(opened).toHaveLength(1);
  expect(adult.result.current.sessions).toEqual([]);
  adult.unmount();
});
