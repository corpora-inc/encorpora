import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createGoogleAnalytics } from "../../../analytics/google-analytics";
import { accessSession, signOut } from "../../auth";
import { analyticsAllowed, track } from "../analytics";
import { startEngagement } from "../engagement";
import { queryClient } from "../query";
import {
  clearStudentDevice,
  isStudentDevice,
  rememberStudentSession,
  settleTab,
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
    // Each a page load of its own: a tab looks once (below).
    sessionStorage.clear();
    localStorage.setItem("amp.student", saved);
    expect(studentSession()).toBeNull();
  }
});

// One tab, one person. Local storage is every tab's at once, so "another
// tab signs in" is a write to it that this tab never made.
const sibling = {
  accountId: "school:9d2b4e10-aaaa-4bbb-8ccc-ddddeeeeffff",
  token: `st_${"b".repeat(43)}`,
};
const parent = { accountId: "amp|parent" };
const anotherTabSignsIn = (session: typeof student) =>
  localStorage.setItem("amp.student", JSON.stringify(session));
/** The same tab, loaded again: its session storage stays, its page is new. */
const reload = () =>
  vi.stubGlobal("performance", {
    now: () => Date.now(),
    timeOrigin: performance.timeOrigin + 1,
  });

test("an adult's tab never becomes the child another tab signs in, reloaded or not", () => {
  expect(studentSession()).toBeNull();
  settleTab(parent);
  anotherTabSignsIn(student);
  expect(studentSession()).toBeNull();
  expect(isStudentDevice()).toBe(false);
  reload();
  expect(studentSession()).toBeNull();
  // The browser still remembers the child, for the tab they open next.
  expect(localStorage.getItem("amp.student")).toBeTruthy();
});

test("a new tab starts as the child this browser remembers, and stays them", () => {
  anotherTabSignsIn(student);
  expect(studentSession()).toEqual(student);
  anotherTabSignsIn(sibling);
  expect(studentSession()).toEqual(student);
  reload();
  expect(studentSession()).toEqual(student);
});

test("a tab that found nobody stays nobody until it loads again", () => {
  expect(studentSession()).toBeNull();
  anotherTabSignsIn(student);
  expect(studentSession()).toBeNull();
  reload();
  expect(studentSession()).toEqual(student);
});

test("the tab a child signed in on stays theirs when a sibling signs in on another", () => {
  rememberStudentSession(student, "personal");
  anotherTabSignsIn(sibling);
  expect(studentSession()).toEqual(student);
  reload();
  expect(studentSession()).toEqual(student);
});

test("a hand-over in the parent's tab is that tab's alone, and hands back to the parent", () => {
  settleTab(parent);
  anotherTabSignsIn(student);
  rememberStudentSession(sibling, "shared", true);
  expect(studentSession()).toEqual(sibling);
  // The child on the other tab is still remembered.
  expect(JSON.parse(localStorage.getItem("amp.student")!)).toEqual(student);
  clearStudentDevice();
  expect(studentSession()).toBeNull();
  reload();
  expect(studentSession()).toBeNull();
  expect(JSON.parse(localStorage.getItem("amp.student")!)).toEqual(student);
});

test("signing out ends this tab's sign-in, and the browser's only when it is the same one", () => {
  rememberStudentSession(student, "personal");
  clearStudentDevice();
  expect(studentSession()).toBeNull();
  expect(localStorage.getItem("amp.student")).toBeNull();

  rememberStudentSession(student, "personal");
  anotherTabSignsIn(sibling);
  clearStudentDevice();
  // Signed out here, never the sibling instead; the sibling stays signed in.
  expect(studentSession()).toBeNull();
  reload();
  expect(studentSession()).toBeNull();
  expect(JSON.parse(localStorage.getItem("amp.student")!)).toEqual(sibling);
});

test("a new sign-in in a tab that is nobody yet replaces the one the browser remembers", () => {
  anotherTabSignsIn(student);
  rememberStudentSession(sibling, "shared");
  expect(studentSession()).toEqual(sibling);
  expect(localStorage.getItem("amp.student")).toBeNull();
});

test("a sign-in made in an adult's tab makes it the child's", () => {
  settleTab(parent);
  rememberStudentSession(student, "personal");
  expect(studentSession()).toEqual(student);
  // In their own tab the student still wins over the parent's session.
  settleTab(parent);
  expect(studentSession()).toEqual(student);
  reload();
  expect(studentSession()).toEqual(student);
});

test("a student's session settles nothing: only an adult's makes a tab an adult's", () => {
  settleTab(null);
  settleTab(student);
  anotherTabSignsIn(student);
  reload();
  expect(studentSession()).toEqual(student);
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

test("sign-out clears the token, keeps other accounts' learner choices, then goes to /join", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", {
    ...new URL("https://amp.corpora.inc/practice"),
    pathname: "/practice",
    assign,
  });
  rememberStudentSession(student, "personal");
  const parentChoice = JSON.stringify({
    state: { learners: { "amp|parent": "chosen" } },
    version: 2,
  });
  localStorage.setItem("amp.learner", parentChoice);
  localStorage.setItem("amp.curriculum-details", "kept");
  await signOut();
  expect(studentSession()).toBeNull();
  // A student's own choice is never stored (learner-store.ts); a parent's
  // stays theirs.
  expect(localStorage.getItem("amp.learner")).toBe(parentChoice);
  expect(localStorage.getItem("amp.curriculum-details")).toBe("kept");
  expect(assign).toHaveBeenCalledWith("/join");
});

test("a child handed their parent's device hands it back on sign-out", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", {
    ...new URL("https://amp.corpora.inc/practice"),
    pathname: "/practice",
    assign,
  });
  rememberStudentSession(student, "shared", true);
  expect(sessionStorage.getItem("amp.student.handed")).toBe("1");
  await signOut();
  expect(studentSession()).toBeNull();
  expect(sessionStorage.getItem("amp.student.handed")).toBeNull();
  expect(assign).toHaveBeenCalledWith("/");
  // The next sign-in on a class's own device is not a handed one.
  rememberStudentSession(student, "shared");
  expect(sessionStorage.getItem("amp.student.handed")).toBeNull();
});

test("clearing is safe with nothing stored", () => {
  clearStudentDevice();
  expect(studentSession()).toBeNull();
});

test("analytics and engagement don't start on a student device", async () => {
  expect(analyticsAllowed()).toBe(true);
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
