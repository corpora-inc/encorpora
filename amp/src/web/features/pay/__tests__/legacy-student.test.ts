import { afterEach, expect, test, vi } from "vitest";
import { meKey, queryClient } from "../../../lib/query";

const device = vi.hoisted(() => ({
  student: null as null | { accountId: string; token: string },
}));
vi.mock("../../../lib/student-device", async (actual) => ({
  ...(await actual<typeof import("../../../lib/student-device")>()),
  studentSession: () => device.student,
}));
const { legacyHop } = await import("../legacy");

afterEach(() => {
  device.student = null;
  queryClient.clear();
});

test("an old payment address on a school student's device opens their own practice, never the launcher", async () => {
  device.student = { accountId: "amp|student", token: "t" };
  queryClient.setQueryData(meKey("amp|student"), {
    signedIn: true,
    learners: [{ id: "6f0a1c7e-1111-4222-8333-444455556666" }],
  });
  for (const hop of ["choose", "card", "funds"] as const)
    expect(
      await legacyHop(hop, {
        pathname: "/purchase/choose",
        search: {},
        params: {},
      } as never),
    ).toBe("/practice/6f0a1c7e-1111-4222-8333-444455556666");
});
