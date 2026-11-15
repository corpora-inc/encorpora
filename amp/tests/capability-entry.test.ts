import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  dropAllCapabilities,
  dropCapability,
  HELD_FOR_MS,
  heldCapability,
  takeCapabilityFragment,
} from "../src/web/capability-entry.js";

/**
 * A link's secret leaves the address before anything routes (CP-2 H1); it
 * is held in this page's memory only, for two hours (CP-2 r3 N2): another
 * tab, a tab this one opens, a reload or another page never read it.
 */
const A = "a".repeat(43);
const B = "b".repeat(43);
const moves = () => {
  const replaced: string[] = [];
  return {
    replaced,
    state: null,
    replaceState: (_s: unknown, _t: string, url?: string | URL | null) =>
      void replaced.push(String(url)),
  };
};
const open = (path: string, token: string, now = 1_000) => {
  const history = moves();
  takeCapabilityFragment(
    { pathname: path, search: "?x=1", hash: `#${token}` },
    history,
    now,
  );
  return history.replaced;
};
beforeEach(() => dropAllCapabilities());

for (const path of ["/school/invite", "/family/approve"] as const)
  test(`${path}#token: held in this page, gone from the address`, () => {
    assert.deepEqual(open(path, `${A}.proof`), [`${path}?x=1`]);
    assert.equal(heldCapability(path, 2_000), `${A}.proof`);
    dropCapability(path);
    assert.equal(heldCapability(path, 2_000), null);
  });

test("any other address, and an empty fragment, are left alone", () => {
  for (const [pathname, hash] of [
    ["/school/o/classes/c/today", `#${A}`],
    ["/school/invite", ""],
    ["/school/invite", "#"],
  ]) {
    const history = moves();
    takeCapabilityFragment({ pathname, search: "", hash }, history);
    assert.deepEqual(history.replaced, [], pathname + hash);
  }
});

test("the link just opened is the one held: never an older one", () => {
  open("/family/approve", A);
  open("/family/approve", B);
  assert.equal(heldCapability("/family/approve", 2_000), B);
});

test("CP-2 r3 N2: the hold expires in this page too, without a reload", () => {
  open("/school/invite", A, 1_000);
  assert.equal(heldCapability("/school/invite", 1_000 + HELD_FOR_MS - 1), A);
  assert.equal(heldCapability("/school/invite", 1_000 + HELD_FOR_MS + 1), null);
  // Gone, not just hidden.
  assert.equal(heldCapability("/school/invite", 2_000), null);
});
