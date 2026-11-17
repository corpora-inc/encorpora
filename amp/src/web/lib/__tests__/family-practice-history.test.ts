import { beforeEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({
  student: null as any,
  handed: false,
  cached: null as any,
}));
const parent = { accountId: "parent", token: "parent-session" };
const child = "11111111-1111-4111-8111-111111111111";
const returned = { learnerId: child, returnTo: "/family/example" };
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
    ensureQueryData: vi.fn(async () => ({
      signedIn: true,
      learners: [{ id: child }],
    })),
  },
}));
vi.mock("../student-device", () => ({
  studentSession: () => state.student,
  handedStudentDevice: () => state.handed,
  clearStudentDevice: () => {
    state.student = null;
    state.handed = false;
  },
  rememberStudentSession: (session: any) => {
    state.student = session;
    state.handed = true;
  },
}));
let history: typeof import("../family-practice-history");
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  state.student = null;
  state.handed = false;
  state.cached = parent;
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
