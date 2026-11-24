import { beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({
  student: null as any,
  handed: false,
  cached: null as any,
  me: null as any,
  returnTo: undefined as string | undefined,
}));
const parent = { accountId: "parent", token: "parent-session" };
const child = "11111111-1111-4111-8111-111111111111";
const returned = { learnerId: child, returnTo: "/family/example" };
const FAMILY = "22222222-2222-4222-8222-222222222222";
const request = vi.hoisted(() => vi.fn());
const publish = vi.hoisted(() =>
  vi.fn((session: any) => {
    state.cached = session;
  }),
);
vi.mock("../../auth", () => ({
  accessSession: vi.fn(async () => parent),
  notifyDeviceSessionChanged: publish,
}));
vi.mock("../api", () => ({ request }));
vi.mock("../../features/profiles/practice-mode", () => ({
  isLearningPath: (path: string) =>
    /^\/(practice|pathways|lessons)(\/|$)/.test(path),
}));
vi.mock("../query", () => ({
  sessionOptions: { queryKey: ["session"] },
  meOptions: (session: any) => session,
  queryClient: {
    getQueryData: () => state.cached,
    // The session, or the account it names.
    ensureQueryData: vi.fn(async (options: any) =>
      options?.queryKey?.[0] === "session" ? state.cached : state.me,
    ),
  },
}));
vi.mock("../student-device", () => ({
  studentSession: () => state.student,
  handedStudentDevice: () => state.handed,
  clearStudentDevice: () => {
    state.student = null;
    state.handed = false;
  },
  rememberStudentSession: (
    session: any,
    _mode: string,
    _handed: boolean,
    returnTo?: string,
  ) => {
    state.student = session;
    state.handed = true;
    state.returnTo = returnTo;
  },
}));
let history: typeof import("../family-practice-history");
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  state.student = null;
  state.handed = false;
  state.cached = parent;
  state.me = {
    signedIn: true,
    learners: [{ id: child }],
    familyClass: { orgId: FAMILY },
  };
  state.returnTo = undefined;
  request.mockResolvedValue({
    accountId: "school:child",
    token: "new-child-session",
    mode: "shared",
  });
  history = await import("../family-practice-history");
});
const entry = (key: string) => ({
  href: "/practice",
  pathname: "/practice",
  state: { ampFamilyPractice: returned, key },
});

test("Back restores the parent before the family route runs", async () => {
  state.student = { accountId: "school:child", token: "child" };
  state.handed = true;
  state.cached = state.student;
  await history.restoreFamilyPractice({
    href: "/family/example",
    pathname: "/family/example",
    state: { key: "parent" },
  });
  expect(state.student).toBeNull();
  // A family handoff: the parent takes back the device (app/providers.tsx).
  expect(publish).toHaveBeenCalledExactlyOnceWith(parent, { handoff: true });
  expect(request).not.toHaveBeenCalled();
});
test("Forward authorizes the named child once even when the session switch remounts the router", async () => {
  await Promise.all([
    history.restoreFamilyPractice(entry("child")),
    history.restoreFamilyPractice(entry("child")),
  ]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe(
    `/family/learners/${child}/practice-here`,
  );
  expect(state.student.accountId).toBe("school:child");
  expect(publish.mock.calls.at(-1)?.[0]).toEqual(state.student);
});
test("a refused child never falls back to the adult; the same history entry can retry", async () => {
  request.mockRejectedValueOnce(new Error("Access refused"));
  await expect(history.restoreFamilyPractice(entry("denied"))).rejects.toThrow(
    "Access refused",
  );
  expect(state.student).toBeNull();
  await history.restoreFamilyPractice(entry("denied"));
  expect(state.student.accountId).toBe("school:child");
});
test("a school's independent student session does not restore a parent cookie", async () => {
  state.student = { accountId: "school:other", token: "other-child" };
  state.cached = state.student;
  await history.restoreFamilyPractice({
    href: "/family/example",
    pathname: "/family/example",
    state: {},
  });
  expect(state.student.accountId).toBe("school:other");
  expect(publish).not.toHaveBeenCalled();
  await expect(
    history.restoreFamilyPractice(entry("unrelated")),
  ).rejects.toThrow("different learner");
  expect(request).not.toHaveBeenCalled();
});
test("a newer navigation cancels a pending Forward before it can change the answering identity", async () => {
  let finish!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const moving = history.restoreFamilyPractice(entry("slow"));
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  await history.restoreFamilyPractice({
    href: "/family/example",
    pathname: "/family/example",
    state: { key: "back" },
  });
  finish({ accountId: "school:child", token: "late", mode: "shared" });
  await expect(moving).rejects.toMatchObject({ name: "AbortError" });
  expect(state.student).toBeNull();
});

/** An address with nothing recorded in history: typed, a bookmark, a link. */
const address = (pathname: string) => ({
  href: pathname,
  pathname,
  state: { key: pathname },
});

test("a child's practice opened by its address alone is handed over, as the button does", async () => {
  await Promise.all([
    history.restoreFamilyPractice(address(`/practice/${child}`)),
    // The remount a new identity causes waits on the same hand-over.
    history.restoreFamilyPractice(address(`/practice/${child}`)),
  ]);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe(
    `/family/learners/${child}/practice-here`,
  );
  expect(request.mock.calls[0][2]).toMatchObject({ token: parent.token });
  expect(state.student).toEqual({
    accountId: "school:child",
    token: "new-child-session",
  });
  expect(state.handed).toBe(true);
  // Its way back is the child's family.
  expect(state.returnTo).toBe(`/family/${FAMILY}`);
  // Nothing was taken back first: the tab was the adult's all along.
  expect(publish).toHaveBeenCalledExactlyOnceWith(state.student, {
    handoff: true,
  });
});
test("practice held to a skill, opened by address, is the child's too", async () => {
  await history.restoreFamilyPractice(
    address(`/practice/${child}/skills/add-within-20`),
  );
  expect(request).toHaveBeenCalledTimes(1);
  expect(state.student?.accountId).toBe("school:child");
});
test("the second parent's address for a child of the family they joined is handed over", async () => {
  const joined = "33333333-3333-4333-8333-333333333333";
  state.me = {
    signedIn: true,
    learners: [],
    secondParentOf: [
      {
        orgId: joined,
        classId: "c",
        className: "Family",
        learners: [{ id: child }],
      },
    ],
  };
  await history.restoreFamilyPractice(address(`/practice/${child}`));
  expect(request).toHaveBeenCalledTimes(1);
  expect(state.returnTo).toBe(`/family/${joined}`);
});
test("the adult's own practice, a practice profile and a learner they don't read are left as they are", async () => {
  const own = "44444444-4444-4444-8444-444444444444";
  state.me = {
    ...state.me,
    adultPractice: { eligible: true, learner: { id: own } },
    practiceProfiles: [{ id: "55555555-5555-4555-8555-555555555555" }],
  };
  for (const learner of [
    own,
    "55555555-5555-4555-8555-555555555555",
    "66666666-6666-4666-8666-666666666666",
  ])
    await history.restoreFamilyPractice(address(`/practice/${learner}`));
  // Bare practice names nobody; a child's page is the parent's own screen.
  await history.restoreFamilyPractice(address("/practice"));
  await history.restoreFamilyPractice(
    address(`/family/${FAMILY}/kids/${child}`),
  );
  expect(request).not.toHaveBeenCalled();
  expect(publish).not.toHaveBeenCalled();
  expect(state.student).toBeNull();
});
test("a tab that is already a student's keeps its sign-in at a practice address", async () => {
  state.student = { accountId: "school:child", token: "own" };
  state.cached = state.student;
  await history.restoreFamilyPractice(address(`/practice/${child}`));
  expect(request).not.toHaveBeenCalled();
  expect(state.student.token).toBe("own");
});
test("an adult who may not hand over yet: the screen opens on their sign-in, which says so", async () => {
  const { AppError } = await import("../AppError");
  const refusal = (code: string) =>
    new AppError("permission", "Refused", false, null, code, 409);
  for (const code of ["learner_cannot_practice", "learner_not_found"]) {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    request.mockRejectedValueOnce(refusal(code));
    await history.restoreFamilyPractice(address(`/practice/${child}/${code}`));
    expect(state.student).toBeNull();
    expect(publish).not.toHaveBeenCalled();
  }
  // Anything else is a failure the route shows, never the adult answering.
  request.mockRejectedValueOnce(new Error("offline"));
  await expect(
    history.restoreFamilyPractice(address(`/practice/${child}`)),
  ).rejects.toThrow("offline");
  expect(state.student).toBeNull();
});
test("nobody signed in at a child's practice address: the sign-in gate's, not a hand-over", async () => {
  state.cached = null;
  await history.restoreFamilyPractice(address(`/practice/${child}`));
  expect(request).not.toHaveBeenCalled();
});
