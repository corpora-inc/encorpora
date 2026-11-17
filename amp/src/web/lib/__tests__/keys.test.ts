import { expect, expectTypeOf, test } from "vitest";
import { qk } from "../keys";

test("an account's keys sit under its prefix, each with its own parts", () => {
  expect(qk.account("a-1")).toEqual(["account", "a-1"]);
  expect(qk.account("a-1", "receipts", null)).toEqual([
    "account",
    "a-1",
    "receipts",
    null,
  ]);
  expect(qk.account(null, "me")).toEqual(["account", null, "me"]);
  expectTypeOf(qk.account("a-1", "level-trend", "l-1")).toEqualTypeOf<
    readonly ["account", "a-1", "level-trend", string]
  >();
  // @ts-expect-error receipts name their page
  qk.account("a-1", "receipts");
  // @ts-expect-error every resource is named in AccountResources
  qk.account("a-1", "unnamed");
});
