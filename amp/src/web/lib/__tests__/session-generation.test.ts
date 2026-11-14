import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import * as recoveryHandlers from "../app-recovery";
import { request } from "../api";
import { onSignedOut, resetAppRecoveryForTest } from "../app-recovery";
import { queryClient, retireSession, sessionOptions } from "../query";
import {
  changeSession,
  forgetRetiredSessions,
  isRetired,
} from "../session-generation";

// docs/architecture/spaces.md, "Session identity": nothing a replaced
// session asked acts in the session that replaced it.
const parent = { accountId: "amp|generation", token: "parent" };
const child = { accountId: "school:generation", token: "st_generation" };
const next = { ...parent, token: "next" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
function become(previous: typeof parent, session: typeof parent) {
  retireSession(previous, session);
  queryClient.setQueryData(sessionOptions.queryKey, session);
}

beforeEach(() => {
  queryClient.clear();
  forgetRetiredSessions();
  resetAppRecoveryForTest();
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
});
afterEach(() => {
  document.head.innerHTML = "";
  queryClient.clear();
  forgetRetiredSessions();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([
  { status: 401, stale: false },
  { status: 401, stale: true },
  { status: 404, stale: true },
])(
  "retirement during a release check prevents recovery ($status, stale=$stale)",
  async ({ status, stale }) => {
    document.head.innerHTML =
      '<script type="module" src="/assets/app-synthetic.js"></script>';
    const build = deferred<Response>();
    const started = deferred<void>();
    vi.mocked(fetch).mockImplementation((url) => {
      if (url === "/") {
        started.resolve();
        return build.promise;
      }
      return Promise.resolve(
        new Response('{"error":"sign_in_required"}', { status }),
      );
    });
    const signedOut = vi.fn(() => false);
    onSignedOut(signedOut);
    const reload = vi
      .spyOn(recoveryHandlers, "reloadIntoCurrentRelease")
      .mockReturnValue(null);
    const old = request("/probe-mutation", z.unknown(), {
      token: parent.token,
      body: {},
    }).catch((error: unknown) => error);
    await started.promise;
    become(parent, next);
    build.resolve(
      new Response(
        `<script type="module" src="/assets/app-${stale ? "replacement" : "synthetic"}.js"></script>`,
      ),
    );
    const result = await old;
    expect(signedOut).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(result).toMatchObject({ code: "session_replaced" });
  },
);

test("the current session and a parent handed back to both work", async () => {
  await expect(
    request("/probe", z.unknown(), { token: parent.token }),
  ).resolves.toEqual({});
  become(parent, child);
  await expect(
    request("/probe", z.unknown(), { token: parent.token }),
  ).rejects.toMatchObject({ code: "session_replaced" });
  become(child, parent);
  await expect(
    request("/probe", z.unknown(), { token: parent.token }),
  ).resolves.toEqual({});
  expect(isRetired(child.token)).toBe(true);
});

test("CP-2 r4 M1: a replaced session's late 401 never signs the new one out", async () => {
  const gate = deferred<Response>();
  vi.mocked(fetch).mockImplementation(() => gate.promise);
  const recovery = vi.fn(() => false);
  onSignedOut(recovery);
  const old = request("/probe-mutation", z.unknown(), {
    token: parent.token,
    body: {},
  }).catch((error: unknown) => error);
  become(parent, next);
  gate.resolve(new Response('{"error":"sign_in_required"}', { status: 401 }));
  expect(await old).toMatchObject({ code: "session_replaced" });
  expect(recovery).not.toHaveBeenCalled();
});

test("CP-2 r4 M1: cancelling the session check doesn't bring the old session back", async () => {
  const gate = deferred<typeof parent | null>();
  const checking = queryClient
    .fetchQuery({
      ...sessionOptions,
      staleTime: 0,
      queryFn: () => gate.promise,
    })
    .catch(() => null);
  retireSession(parent, next);
  await queryClient.cancelQueries({ queryKey: sessionOptions.queryKey });
  queryClient.setQueryData(sessionOptions.queryKey, next);
  await checking;
  expect(isRetired(parent.token)).toBe(true);
  await expect(
    request("/probe", z.unknown(), { token: parent.token }),
  ).rejects.toMatchObject({ code: "session_replaced" });
});

test("CP-2 r4 M1: a session replaced long ago stays replaced", async () => {
  changeSession(parent.token, "old-0");
  for (let i = 0; i < 64; i++) changeSession(`old-${i}`, `old-${i + 1}`);
  await expect(
    request("/probe", z.unknown(), { token: parent.token }),
  ).rejects.toMatchObject({ code: "session_replaced" });
});
