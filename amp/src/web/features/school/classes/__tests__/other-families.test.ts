import { expect, test } from "vitest";
import type { ApprovalRowResource } from "../../../../../family/approval-contracts";
import { statusLine } from "../OtherFamilies";

const row = (change: Partial<ApprovalRowResource>): ApprovalRowResource => ({
  id: "row",
  name: "Ana",
  status: "needs-access",
  parentEmail: null,
  inviteUrl: null,
  parentPageUrl: null,
  expiresAt: null,
  accessEndsAt: null,
  ...change,
});

test("an approved child counts free problems down, and says when they're used", () => {
  expect(statusLine(row({ freeLeft: 73 }))).toBe("73 free problems left");
  expect(statusLine(row({ freeLeft: 0 }))).toBe("Used the 100 free problems");
  expect(statusLine(row({}))).toBe("Approved by their parent");
  expect(statusLine(row({ status: "unnamed", freeLeft: 0 }))).toBe(
    "Used the 100 free problems",
  );
});
