import { isRedirect } from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { meOptions, queryClient } from "../../lib/query";
import { admit, knowStudentFirst } from "../sign-in-gate";

const STUDENT = { accountId: "school:student-1", token: "st_test" };
const LEARNER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const state = vi.hoisted(() => ({ student: null as null | object }));
vi.mock("../../lib/student-device", async (original) => ({
  ...(await original<typeof import("../../lib/student-device")>()),
  studentSession: () => state.student,
}));

afterEach(() => {
  state.student = null;
  queryClient.clear();
  vi.restoreAllMocks();
});

const hrefOf = (attempt: () => void) => {
  try {
    attempt();
  } catch (thrown) {
    if (isRedirect(thrown)) return thrown.options.href;
    throw thrown;
  }
  return undefined;
};

test("a school student sent home lands on their practice in one hop, /me not cached before", async () => {
  state.student = STUDENT;
  const ME = {
    signedIn: true,
    account: { id: STUDENT.accountId, kind: "student", email: null },
    learners: [{ id: LEARNER, name: "Ada" }],
  };
  const ensure = vi
    .spyOn(queryClient, "ensureQueryData")
    .mockImplementation(async (options) => {
      queryClient.setQueryData(options.queryKey, ME as never);
      return ME as never;
    });
  // Before: only bare /practice is known (a second hop).
  expect(hrefOf(() => admit({ adults: true }))).toBe("/practice");
  await knowStudentFirst();
  expect(ensure).toHaveBeenCalledWith(
    expect.objectContaining({ queryKey: meOptions(STUDENT).queryKey }),
  );
  expect(hrefOf(() => admit({ adults: true }))).toBe(`/practice/${LEARNER}`);
});

test("anyone else's navigation loads nothing ahead", async () => {
  const ensure = vi.spyOn(queryClient, "ensureQueryData");
  await knowStudentFirst();
  expect(ensure).not.toHaveBeenCalled();
});

test("a /me that fails to load is logged and the navigation goes on", async () => {
  state.student = STUDENT;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(queryClient, "ensureQueryData").mockRejectedValue(new Error("down"));
  await expect(knowStudentFirst()).resolves.toBeUndefined();
  expect(warn).toHaveBeenCalled();
});
