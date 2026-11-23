// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  clearInitialConsentChallenge,
  rememberConsentChallenge,
} from "../../../consent-entry";
import { noteSignedIn } from "../../../lib/session-hint";
import { mayShowPitch, signedOutVisitor } from "../home-decision";

const accounts = {
  mode: "accounts",
  passwords: true,
  providers: [],
};
/** The API's answers; `failed` makes a call fail as a dropped request. */
const failed = Symbol("failed");
function answer(config: unknown, session: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const value =
        url === "/api/v1/auth-config"
          ? config
          : url === "/api/auth/get-session"
            ? session
            : undefined;
      if (value === failed) throw new TypeError("Failed to fetch");
      return value === undefined
        ? new Response(null, { status: 404 })
        : Response.json(value);
    }),
  );
}
beforeEach(() => {
  history.replaceState(null, "", "/");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  clearInitialConsentChallenge();
  document.cookie = "amp.provider=; Max-Age=0";
});

test("a new visitor at / may get the light pitch", () => {
  expect(mayShowPitch({})).toBe(true);
  expect(mayShowPitch({ program: "ar-efa", utm_source: "google" })).toBe(true);
});

test("anyone the app decides for goes straight to the app", () => {
  noteSignedIn(true);
  expect(mayShowPitch({}), "a returning account").toBe(false);
  noteSignedIn(false);
  expect(mayShowPitch({})).toBe(true);

  // A student's device, as its page loads: a tab looks for the sign-in this
  // browser remembers once per load (lib/student-device.ts).
  sessionStorage.clear();
  localStorage.setItem(
    "amp.student",
    JSON.stringify({ accountId: "school:student-1", token: "st_synthetic" }),
  );
  expect(mayShowPitch({}), "a student's device").toBe(false);
  localStorage.clear();
  sessionStorage.clear();

  document.cookie = "amp.provider=1";
  expect(mayShowPitch({}), "a school sign-in").toBe(false);
  document.cookie = "amp.provider=; Max-Age=0";

  expect(mayShowPitch({ "sign-in": "" }), "a sign-in link").toBe(false);
  expect(mayShowPitch({ "reset-password": "" }), "a reset link").toBe(false);
  expect(mayShowPitch({ "signed-in": "" }), "a provider's return").toBe(false);

  rememberConsentChallenge(
    {
      requestId: "a0000000-0000-4000-8000-000000000001",
      stage: "initial",
      token: "synthetic-proof",
      noticeDigest: "synthetic-notice",
    },
    null,
  );
  expect(mayShowPitch({}), "a consent email's link").toBe(false);
  clearInitialConsentChallenge();

  history.replaceState(null, "", "/sign-up");
  expect(mayShowPitch({}), "another route").toBe(false);
});

test("the pitch paints only when the API says no one is signed in", async () => {
  answer(accounts, null);
  expect(await signedOutVisitor()).toBe(true);
  answer(accounts, { session: { token: "t" }, user: { id: "u" } });
  expect(await signedOutVisitor(), "signed in").toBe(false);
  expect(
    vi.mocked(fetch).mock.calls.map(([url]) => url),
    "the configuration is asked once per page, the app's answer too",
  ).toEqual(["/api/auth/get-session"]);
});

test("a deployment that signs in elsewhere is the app's to decide", async () => {
  vi.resetModules();
  const fresh = await import("../home-decision");
  answer({ mode: "oidc" }, null);
  expect(await fresh.signedOutVisitor()).toBe(false);
});

// A blocker, a dropped request or a server hiccup on the sign-in methods
// left `/` on a full-screen error, with no Try it free. Whether to show the
// pitch is the session's answer; only the sign-in screens need the methods.
test("the pitch doesn't wait on the sign-in configuration", async () => {
  vi.resetModules();
  const fresh = await import("../home-decision");
  answer(failed, null);
  expect(await fresh.signedOutVisitor(), "no one signed in").toBe(true);
  vi.resetModules();
  const again = await import("../home-decision");
  answer(failed, { session: { token: "t" }, user: { id: "u" } });
  expect(await again.signedOutVisitor(), "signed in").toBe(false);
});

test("a session that can't be read is the app's to decide", async () => {
  vi.resetModules();
  const fresh = await import("../home-decision");
  answer(accounts, failed);
  await expect(fresh.signedOutVisitor()).rejects.toThrow("Failed to fetch");
});
