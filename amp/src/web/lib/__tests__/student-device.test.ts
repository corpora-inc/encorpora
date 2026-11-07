import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createGoogleAnalytics } from "../../../analytics/google-analytics";
import { accessSession, signOut } from "../../auth";
import { trialSessionOptions } from "../../features/trial/api";
import { analyticsAllowed, track } from "../analytics";
import { startEngagement } from "../engagement";
import { queryClient } from "../query";
import {
  clearStudentDevice,
  isStudentDevice,
  rememberStudentSession,
  studentSession,
  studentSignInEnded,
  STUDENT_IDLE_MS,
  watchStudentIdle,
} from "../student-device";

const student = {
  accountId: "school:6f0a1c7e-1111-4222-8333-444455556666",
  token: `st_${"a".repeat(43)}`,
};
const fetched = vi.fn((_url: string, _init?: RequestInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
);
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fetched.mockClear();
  vi.stubGlobal("fetch", fetched);
});
afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

test("shared stays in this tab's session storage, personal in local storage", () => {
  expect(isStudentDevice()).toBe(false);
  rememberStudentSession(student, "shared");
  expect(sessionStorage.getItem("amp.student")).toBeTruthy();
  expect(localStorage.getItem("amp.student")).toBeNull();
  expect(studentSession()).toEqual(student);
  expect(isStudentDevice()).toBe(true);
  rememberStudentSession(student, "personal");
  expect(sessionStorage.getItem("amp.student")).toBeNull();
  expect(localStorage.getItem("amp.student")).toBeTruthy();
  expect(studentSession()).toEqual(student);
});

test("anything else in that slot is not a student sign-in", () => {
  for (const saved of [
    "not json",
    "null",
    "{}",
    JSON.stringify({ accountId: "amp|parent", token: student.token }),
    JSON.stringify({ accountId: student.accountId, token: "parent-token" }),
  ]) {
    localStorage.setItem("amp.student", saved);
    expect(studentSession()).toBeNull();
  }
});

test("the sign-in screens count as a student device before any token exists", () => {
  const at = (path: string) =>
    vi.stubGlobal("location", new URL(`https://amp.corpora.inc${path}`));
  for (const path of ["/join", "/join/ABC123", "/c/card-secret", "/p"]) {
    at(path);
    expect(isStudentDevice()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
  }
  for (const path of ["/", "/joinery", "/class", "/practice", "/pathways"]) {
    at(path);
    expect(isStudentDevice()).toBe(false);
  }
});

test("a stored student token wins over a parent session, without asking the server", async () => {
  rememberStudentSession(student, "shared");
  expect(await accessSession()).toEqual(student);
  expect(fetched).not.toHaveBeenCalled();
});

test("sign-out clears the token, the chosen learner and the trial, then goes to /join", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", {
    ...new URL("https://amp.corpora.inc/practice"),
    pathname: "/practice",
    assign,
  });
  rememberStudentSession(student, "personal");
  localStorage.setItem("amp.learner", "chosen");
  localStorage.setItem("amp.trial", "trial-token");
  localStorage.setItem("amp.curriculum-details", "kept");
  await signOut();
  expect(studentSession()).toBeNull();
  expect(localStorage.getItem("amp.learner")).toBeNull();
  expect(localStorage.getItem("amp.trial")).toBeNull();
  expect(localStorage.getItem("amp.curriculum-details")).toBe("kept");
  expect(assign).toHaveBeenCalledWith("/join");
});

test("clearing is safe with nothing stored", () => {
  clearStudentDevice();
  expect(studentSession()).toBeNull();
});

test("a student asks nothing about trials: the root query never reaches the parent route", async () => {
  rememberStudentSession(student, "shared");
  expect(await queryClient.fetchQuery(trialSessionOptions)).toBeNull();
  expect(fetched).not.toHaveBeenCalled();
});

test("analytics and engagement don't start on a student device", async () => {
  expect(analyticsAllowed()).toBe(navigator.doNotTrack !== "1");
  rememberStudentSession(student, "shared");
  expect(analyticsAllowed()).toBe(false);
  const engagement = startEngagement();
  engagement.navigate("/practice");
  engagement.stop();
  track("session_start", { daysSinceFirstVisit: 0 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(fetched).not.toHaveBeenCalled();
});

test("Google Analytics stays off on a public page when blocked", () => {
  vi.stubGlobal("location", new URL("https://amp.corpora.inc/"));
  const gaWindow = window as unknown as Record<string, unknown>;
  gaWindow.dataLayer = undefined;
  createGoogleAnalytics({ blocked: () => true }).navigate();
  expect(gaWindow.dataLayer).toBeUndefined();
  expect(gaWindow["ga-disable-G-TGEK0ZGHMD"]).toBe(true);
});

test("only /me decides that a student's sign-in has ended", async () => {
  fetched.mockResolvedValueOnce(new Response(null, { status: 401 }));
  expect(await studentSignInEnded(student)).toBe(true);
  expect(fetched.mock.calls[0]![0]).toBe("/api/v1/me");
  expect(
    new Headers(fetched.mock.calls[0]![1]!.headers).get("authorization"),
  ).toBe(`Bearer ${student.token}`);
  fetched.mockResolvedValueOnce(new Response("{}", { status: 200 }));
  expect(await studentSignInEnded(student)).toBe(false);
});

test("a shared device signs out when left alone, and use restarts the clock", () => {
  const signOut = vi.fn();
  rememberStudentSession(student, "shared");
  const stop = watchStudentIdle(signOut);
  expect(signOut).not.toHaveBeenCalled();
  sessionStorage.setItem(
    "amp.student.active",
    String(Date.now() - STUDENT_IDLE_MS + 60_000),
  );
  window.dispatchEvent(new Event("pointerdown"));
  document.dispatchEvent(new Event("visibilitychange"));
  expect(signOut).not.toHaveBeenCalled();
  expect(
    Date.now() - Number(sessionStorage.getItem("amp.student.active")),
  ).toBeLessThan(1000);
  sessionStorage.setItem(
    "amp.student.active",
    String(Date.now() - STUDENT_IDLE_MS),
  );
  document.dispatchEvent(new Event("visibilitychange"));
  expect(signOut).toHaveBeenCalledTimes(1);
  stop();
});

test("a session with no clock yet starts one, rather than signing out", () => {
  const signOut = vi.fn();
  sessionStorage.setItem("amp.student", JSON.stringify(student));
  const stop = watchStudentIdle(signOut);
  expect(signOut).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("amp.student.active")).not.toBeNull();
  stop();
});

test("a personal device, or no student, is never signed out for being idle", () => {
  const signOut = vi.fn();
  rememberStudentSession(student, "personal");
  sessionStorage.setItem("amp.student.active", "0");
  const stop = watchStudentIdle(signOut);
  document.dispatchEvent(new Event("visibilitychange"));
  clearStudentDevice();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(signOut).not.toHaveBeenCalled();
  stop();
});
