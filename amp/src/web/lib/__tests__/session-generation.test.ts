import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import * as recoveryHandlers from "../app-recovery";
import {
  request,
  requestWith,
  requestFetch,
  SessionUnconfirmedError,
} from "../api";
import { onSignedOut, resetAppRecoveryForTest } from "../app-recovery";
import { queryClient, retireSession, sessionOptions } from "../query";
import {
  changeSession,
  confirmSession,
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

test.each([
  { body: {} },
  { method: "POST" },
  { method: "PUT", body: {} },
  { method: "patch", body: {} },
  { method: "DELETE" },
  { method: "HEAD" },
  { method: "OPTIONS" },
  { method: "CUSTOM" },
])(
  "renewal refuses mutations before transport until confirmed: %j",
  async (options) => {
    // Even a token confirmed on an earlier use must confirm this renewal.
    confirmSession(next.token);
    become(parent, next);
    await expect(
      request("/probe", z.unknown(), { ...options, token: next.token }),
    ).rejects.toMatchObject({ code: "session_unconfirmed" });
    expect(fetch).not.toHaveBeenCalled();
    await expect(
      request("/me", z.unknown(), { token: next.token }),
    ).resolves.toEqual({});
    confirmSession(next.token);
    await expect(
      request("/probe", z.unknown(), { ...options, token: next.token }),
    ).resolves.toEqual({});
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);

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

// Cookie-backed callers and callers with an omitted or unrelated bearer token
// cannot opt out of the current session's renewal boundary.
test.each([undefined, null, "unrelated-token"])(
  "requestWith gates the current renewal with token %s",
  async (token) => {
    become(parent, next);
    const send = vi.fn(async () => "saved");
    const error = await requestWith(send, { token, method: "POST" }).catch(
      (error: unknown) => error,
    );
    expect(error).toBeInstanceOf(SessionUnconfirmedError);
    expect(error).toMatchObject({
      code: "session_unconfirmed",
      retry: true,
      message: "One moment, confirming your sign-in",
    });
    expect(send).not.toHaveBeenCalled();
    confirmSession(next.token);
    await expect(requestWith(send, { token, method: "POST" })).resolves.toBe(
      "saved",
    );
    expect(send).toHaveBeenCalledOnce();
  },
);

test.each(["POST", "put", "PATCH", "DELETE", "HEAD", "OPTIONS", "CUSTOM"])(
  "raw transport refuses %s then succeeds after confirmation",
  async (method) => {
    become(parent, next);
    for (const headers of [
      undefined,
      { authorization: `Bearer ${next.token}` },
    ]) {
      await expect(
        requestFetch("/api/v1/probe", { method, headers }),
      ).rejects.toBeInstanceOf(SessionUnconfirmedError);
    }
    expect(fetch).not.toHaveBeenCalled();
    await expect(requestFetch("/api/v1/me")).resolves.toBeInstanceOf(Response);
    confirmSession(next.token);
    await expect(
      requestFetch("/api/v1/probe", { method }),
    ).resolves.toBeInstanceOf(Response);
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);

test("raw transport derives the method and bearer from a Request object", async () => {
  become(parent, next);
  const input = new Request("https://example.test/api/v1/probe", {
    method: "POST",
    headers: { Authorization: `Bearer ${next.token}` },
  });
  await expect(requestFetch(input)).rejects.toBeInstanceOf(
    SessionUnconfirmedError,
  );
  expect(fetch).not.toHaveBeenCalled();
  confirmSession(next.token);
  await expect(requestFetch(input)).resolves.toBeInstanceOf(Response);
});

test("legacy learning, purchase, PDF and keepalive transports preserve the typed refusal", async () => {
  const { learningRequest } = await import("../../learning-transport");
  const { purchaseFetch } = await import("../purchase-analytics");
  const { downloadPdf } = await import("../pdf-download");
  const { keepaliveFetch } = await import("../keepalive");
  become(parent, next);
  for (const send of [
    () => learningRequest("/learners/synthetic/attempts", next.token, {}),
    () => purchaseFetch("/api/v1/billing/checkout", { method: "POST" }),
    () =>
      downloadPdf({
        path: "/probe.pdf",
        token: next.token,
        body: {},
        name: "probe.pdf",
      }),
    () => keepaliveFetch("/api/v1/events", { method: "POST" }),
  ]) {
    await expect(send()).rejects.toBeInstanceOf(SessionUnconfirmedError);
  }
  expect(fetch).not.toHaveBeenCalled();
  confirmSession(next.token);
  await expect(
    learningRequest("/learners/synthetic/attempts", next.token, {}),
  ).resolves.toMatchObject({ ok: true });
  await expect(
    purchaseFetch("/api/v1/billing/checkout", { method: "POST" }),
  ).resolves.toBeInstanceOf(Response);
  await expect(
    keepaliveFetch("/api/v1/events", { method: "POST" }),
  ).resolves.toBeInstanceOf(Response);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("the account SDK gates cookie-authenticated settings but keeps sign-out available", async () => {
  const { accountClient } = await import("../../account-client");
  become(parent, next);
  const change = () =>
    accountClient.changePassword({
      currentPassword: "synthetic-old",
      newPassword: "synthetic-new",
    });
  await expect(change()).rejects.toBeInstanceOf(SessionUnconfirmedError);
  expect(fetch).not.toHaveBeenCalled();
  await accountClient.signOut();
  expect(fetch).toHaveBeenCalledOnce();
  expect(String(vi.mocked(fetch).mock.calls[0]![0])).toContain(
    "/api/auth/sign-out",
  );
  confirmSession(next.token);
  await change();
  expect(fetch).toHaveBeenCalledTimes(2);
});
