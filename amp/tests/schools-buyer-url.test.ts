import assert from "node:assert/strict";
import test from "node:test";
import { absoluteBuyerUrl } from "../src/web/features/school/pilots/buyer-url.js";

test("relative buyer links become the same absolute copy and preview target", () => {
  const token = "a".repeat(43);
  const target = absoluteBuyerUrl(
    `/schools/continue#token=${token}`,
    "https://school.example.test",
  );
  assert.equal(
    target,
    `https://school.example.test/schools/continue#token=${token}`,
  );
  const url = new URL(target);
  assert.equal(url.pathname, "/schools/continue");
  assert.equal(url.search, "");
  assert.equal(absoluteBuyerUrl(target, "https://other.example.test"), target);
  assert.throws(() =>
    absoluteBuyerUrl("javascript:alert(1)", "https://school.example.test"),
  );
});
