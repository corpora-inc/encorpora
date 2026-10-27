import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { request } from "../api";
import { onSignedOut, resetAppRecoveryForTest } from "../app-recovery";

const html = (entry: string) =>
  `<!doctype html><html><head><script type="module" src="${entry}"></script></head><body><div id="root"></div></body></html>`;
const pending = Symbol("pending");
const settled = (promise: Promise<unknown>) =>
  Promise.race([
    promise.then(
      () => "resolved",
      () => "rejected",
    ),
    new Promise((resolve) => setTimeout(() => resolve(pending), 20)),
  ]);

let reload: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetAppRecoveryForTest();
  sessionStorage.clear();
  document.head.innerHTML =
    '<script type="module" src="/assets/index-loaded.js"></script>';
  reload = vi.fn();
  vi.stubGlobal("location", {
    origin: "https://amp.example",
    href: "https://amp.example/try",
    reload,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.innerHTML = "";
});

/** The API answers `apiStatus`; the live page names `liveEntry`. */
function serve(apiStatus: number, liveEntry: string, body: object) {
  const fetch = vi.fn((input: string) =>
    Promise.resolve(
      input === "/"
        ? new Response(html(liveEntry), { status: 200 })
        : new Response(JSON.stringify(body), { status: apiStatus }),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

test("an ended parent sign-in goes to sign-in and shows no error", async () => {
  serve(401, "/assets/index-loaded.js", { error: "Sign in to continue" });
  const handler = vi.fn(() => true);
  onSignedOut(handler);
  const result = request("/trials", z.unknown(), { body: { birthYear: 2016 } });
  expect(await settled(result)).toBe(pending);
  expect(handler).toHaveBeenCalledOnce();
  expect(console.error).not.toHaveBeenCalled();
});

test("a 401 nothing can recover says the session ended, never a generic failure", async () => {
  serve(401, "/assets/index-loaded.js", { error: "Sign in to continue" });
  onSignedOut(() => false);
  await expect(
    request("/trials", z.unknown(), { body: { birthYear: 2016 } }),
  ).rejects.toMatchObject({
    kind: "authentication",
    message: "Your session ended. Sign in again to continue.",
  });
});

test("an ended free trial is left to the practice screens", async () => {
  serve(401, "/assets/index-loaded.js", { error: "This free trial has ended" });
  const handler = vi.fn(() => true);
  onSignedOut(handler);
  await expect(
    request("/learners", z.unknown(), { trial: "device-token" }),
  ).rejects.toMatchObject({ kind: "authentication" });
  expect(handler).not.toHaveBeenCalled();
});

test("free practice whose parent sign-in ended goes to sign-in, keeping the trial", async () => {
  serve(401, "/assets/index-loaded.js", { error: "Sign in to continue" });
  const handler = vi.fn(() => true);
  onSignedOut(handler);
  const result = request("/learners", z.unknown(), { trial: "device-token" });
  expect(await settled(result)).toBe(pending);
  expect(handler).toHaveBeenCalledOnce();
});

test("a tab running an older release reloads instead of reporting the failure", async () => {
  serve(401, "/assets/index-current.js", { error: "Sign in to continue" });
  const handler = vi.fn(() => true);
  onSignedOut(handler);
  const result = request("/trials", z.unknown(), { body: { birthYear: 2016 } });
  expect(await settled(result)).toBe(pending);
  expect(reload).toHaveBeenCalledOnce();
  expect(handler).not.toHaveBeenCalled();
  expect(console.error).not.toHaveBeenCalled();
});

test("a current tab still reports a genuine missing record", async () => {
  const fetch = serve(404, "/assets/index-loaded.js", { error: "Not Found" });
  await expect(
    request("/learners/gone", z.unknown(), { token: "t" }),
  ).rejects.toMatchObject({ kind: "validation" });
  expect(reload).not.toHaveBeenCalled();
  // The release check runs at most once a short while, not per failure.
  await expect(
    request("/learners/gone", z.unknown(), { token: "t" }),
  ).rejects.toMatchObject({ kind: "validation" });
  expect(fetch.mock.calls.filter(([input]) => input === "/")).toHaveLength(1);
});

test("a development build without a hashed entry is never stale", async () => {
  document.head.innerHTML =
    '<script type="module" src="/src/main.tsx"></script>';
  const fetch = serve(400, "/assets/index-current.js", { error: "Bad" });
  await expect(
    request("/learners", z.unknown(), { body: {}, token: "t" }),
  ).rejects.toMatchObject({ kind: "validation" });
  expect(reload).not.toHaveBeenCalled();
  expect(fetch.mock.calls.some(([input]) => input === "/")).toBe(false);
});

test("a stale tab still shows a validation error, so a filled form survives", async () => {
  serve(400, "/assets/index-current.js", { error: "Bad" });
  await expect(
    request("/invoices", z.unknown(), { body: {}, token: "t" }),
  ).rejects.toMatchObject({ kind: "validation" });
  expect(reload).not.toHaveBeenCalled();
});

test("a release reload never repeats within a minute", async () => {
  serve(404, "/assets/index-current.js", { error: "Not Found" });
  sessionStorage.setItem("amp.release-reload", String(Date.now() - 5_000));
  await expect(
    request("/learners", z.unknown(), { token: "t" }),
  ).rejects.toMatchObject({ kind: "validation" });
  expect(reload).not.toHaveBeenCalled();
});
