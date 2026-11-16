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
function answer(config: unknown, session: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url === "/api/v1/auth-config"
        ? Response.json(config)
        : url === "/api/auth/get-session"
          ? Response.json(session)
          : new Response(null, { status: 404 }),
    ),
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

  localStorage.setItem(
    "amp.student",
    JSON.stringify({ accountId: "school:student-1", token: "st_synthetic" }),
  );
  expect(mayShowPitch({}), "a student's device").toBe(false);
  localStorage.clear();

  document.cookie = "amp.provider=1";
  expect(mayShowPitch({}), "a school sign-in").toBe(false);
  document.cookie = "amp.provider=; Max-Age=0";

  expect(mayShowPitch({ "sign-in": "" }), "a sign-in link").toBe(false);
  expect(mayShowPitch({ "reset-password": "" }), "a reset link").toBe(false);

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
