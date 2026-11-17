import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { router } from "../../../app/router";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";

const session = { accountId: "returning-parent", token: "fixture-session" };
const trial = { entry: "pitch-try", return: "free-practice" };
const parent: SignedInMe = {
  signedIn: true,
  account: { id: session.accountId, email: null, emailVerified: true },
  consent: { status: "none", method: null },
  learners: [],
  family: {
    consent: {
      status: "not-recorded",
      policyVersion: null,
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [],
    retained: {
      identity: "",
      financial: "",
      backups: "",
      privacyAuditDays: 30,
    },
  },
  familyClass: {
    orgId: "family-org",
    classId: "family-class",
    className: "Family",
    notice: false,
  },
  next: "practice",
};

let current = parent;
/** The family's own address: where a returning parent goes, never `/`. */
const HOME = "/family/family-org";

// Exercise the registered route guard, including its account query and actual
// redirects. Destination rendering is covered by verify-returning-trial-ui.ts.
const beforeLoad = router.routesById["/start"].options.beforeLoad as (input: {
  params: { choice?: string };
  location: { pathname: string; search: Record<string, unknown> };
}) => Promise<unknown>;
const enter = (search: Record<string, unknown> = trial, choice?: string) =>
  beforeLoad({
    params: { choice },
    location: { pathname: choice ? `/start/${choice}` : "/start", search },
  });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  queryClient.clear();
  current = parent;
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, parent);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(current)),
  );
});
afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});

test.each(["pitch-try", "pitch-workbook", undefined])(
  "a returning account goes straight to its place from a free entry (%s)",
  async (entry) => {
    await expect(
      enter({ return: "free-practice", entry }),
    ).rejects.toMatchObject({
      options: { href: HOME, replace: true },
    });
  },
);

test("a new account keeps first-run setup", async () => {
  current = { ...parent, familyClass: undefined, next: "start" };
  queryClient.setQueryData(meOptions(session).queryKey, current);
  await expect(enter()).resolves.toBeUndefined();
});

test("Add a place and selected setup steps stay open", async () => {
  await expect(enter({})).resolves.toBeUndefined();
  await expect(enter({ ...trial, from: "/me" })).resolves.toBeUndefined();
  await expect(enter(trial, "myself")).resolves.toBeUndefined();
  await expect(enter(trial, "parent")).resolves.toBeUndefined();
});

test("funded purchase entry keeps its setup route", async () => {
  await expect(enter({ return: "arkansas-efa" })).resolves.toBeUndefined();
});

test("a signed-out trial link keeps its intent through sign-in", async () => {
  queryClient.setQueryData(sessionOptions.queryKey, null);
  await expect(
    enter({ ...trial, program: "az-esa", token: "discard" }),
  ).rejects.toMatchObject({
    options: { to: "/sign-in", search: { ...trial, program: "az-esa" } },
  });
});

test("a remembered place from a different account cannot skip new setup", async () => {
  localStorage.setItem("amp.place.another-account", "me");
  current = { ...parent, familyClass: undefined, next: "start" };
  queryClient.setQueryData(meOptions(session).queryKey, current);
  await expect(enter()).resolves.toBeUndefined();
});

test("trial entry waits for an in-flight refresh of a stale new-account snapshot", async () => {
  queryClient.setQueryData(meOptions(session).queryKey, {
    ...parent,
    familyClass: undefined,
    next: "start",
  });
  let respond!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        respond = resolve;
      }),
  );
  const refresh = queryClient.fetchQuery({
    ...meOptions(session),
    staleTime: 0,
  });
  const result = enter();
  const assertion = expect(result).rejects.toMatchObject({
    options: { href: HOME, replace: true },
  });
  respond(Response.json(parent));
  await refresh;
  await assertion;
  // The one /me read, shared; then the family's places for its address.
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/me"))
      .length,
  ).toBe(1);
});

test("a failed trial account read stays in route error recovery instead of setup", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: "unavailable" }, { status: 503 }),
  );
  await expect(enter()).rejects.toBeInstanceOf(Error);
});

test.each(["/sign-in", "/sign-up"] as const)(
  "%s resumes an existing session straight to its place",
  async (path) => {
    const enterAuth = router.routesById[path].options.beforeLoad as (input: {
      search: Record<string, unknown>;
    }) => Promise<unknown>;
    await expect(enterAuth({ search: {} })).rejects.toMatchObject({
      options: { href: HOME, replace: true },
    });
    await expect(enterAuth({ search: trial })).rejects.toMatchObject({
      options: { href: HOME, replace: true },
    });
    for (const search of [
      { return: "security", next: "/account/security/delete" },
      { return: "school", next: "/school/connect" },
      { return: "school-invite" },
      { return: "family-approval" },
      { ...trial, error: "access_denied", provider: "google" },
    ])
      await expect(enterAuth({ search })).resolves.toBeUndefined();
    queryClient.setQueryData(sessionOptions.queryKey, null);
    await expect(enterAuth({ search: trial })).resolves.toBeUndefined();
  },
);
