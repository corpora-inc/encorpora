import assert from "node:assert/strict";
import test from "node:test";
import {
  dropCapability,
  heldCapability,
  takeCapabilityFragment,
} from "../src/web/capability-entry.js";

/** A link's secret leaves the address before anything routes (CP-2 H1). */
const memory = () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};
const TOKEN = "a".repeat(43);

for (const path of ["/school/invite", "/family/approve"] as const)
  test(`${path}#token: held for this tab, gone from the address`, () => {
    const store = memory();
    const replaced: string[] = [];
    takeCapabilityFragment(
      { pathname: path, search: "", hash: `#${TOKEN}.proof` },
      {
        state: null,
        replaceState: (_s, _t, url) => void replaced.push(String(url)),
      },
      store,
    );
    assert.deepEqual(replaced, [path]);
    assert.equal(heldCapability(path, store), `${TOKEN}.proof`);
    dropCapability(path, store);
    assert.equal(heldCapability(path, store), null);
  });

test("any other address, and an empty fragment, are left alone", () => {
  for (const [pathname, hash] of [
    ["/school/o/classes/c/today", `#${TOKEN}`],
    ["/school/invite", ""],
    ["/school/invite", "#"],
  ]) {
    const store = memory();
    const replaced: string[] = [];
    takeCapabilityFragment(
      { pathname, search: "", hash },
      {
        state: null,
        replaceState: (_s, _t, url) => void replaced.push(String(url)),
      },
      store,
    );
    assert.deepEqual(replaced, [], pathname + hash);
  }
});
