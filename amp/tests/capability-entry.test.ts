import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  dropCapability,
  heldCapability,
  takeCapabilityFragment,
} from "../src/web/capability-entry.js";

/** A link's secret leaves the address before anything routes (CP-2 H1), is
 * never lost or swapped by storage (N1), and lives no longer than this tab's
 * link (N2). */
const memoryStore = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};
const brokenStore = () => ({
  ...memoryStore(),
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
});
const A = "a".repeat(43);
const B = "b".repeat(43);
const history = () => {
  const replaced: string[] = [];
  return {
    replaced,
    state: null,
    replaceState: (_s: unknown, _t: string, url?: string | URL | null) =>
      void replaced.push(String(url)),
  };
};
const open = (
  path: string,
  token: string,
  store: ReturnType<typeof memoryStore> | null,
  tab = { name: "" },
  now = 1_000,
) => {
  const moves = history();
  takeCapabilityFragment(
    { pathname: path, search: "", hash: `#${token}` },
    moves,
    store,
    tab,
    now,
  );
  return moves.replaced;
};
// Memory is this page's: each test starts with none held.
beforeEach(() => {
  dropCapability("/school/invite", null);
  dropCapability("/family/approve", null);
});

for (const path of ["/school/invite", "/family/approve"] as const)
  test(`${path}#token: held for this tab, gone from the address`, () => {
    const store = memoryStore();
    assert.deepEqual(open(path, `${A}.proof`, store), [path]);
    assert.equal(heldCapability(path, store), `${A}.proof`);
    dropCapability(path, store);
    assert.equal(heldCapability(path, store), null);
  });

test("any other address, and an empty fragment, are left alone", () => {
  for (const [pathname, hash] of [
    ["/school/o/classes/c/today", `#${A}`],
    ["/school/invite", ""],
    ["/school/invite", "#"],
  ]) {
    const moves = history();
    takeCapabilityFragment(
      { pathname, search: "", hash },
      moves,
      memoryStore(),
    );
    assert.deepEqual(moves.replaced, [], pathname + hash);
  }
});

test("CP-2 r2 N1: storage that fails never loses the link just opened", () => {
  open("/school/invite", A, null);
  assert.equal(heldCapability("/school/invite", null), A);
  dropCapability("/school/invite", null);
  open("/school/invite", A, brokenStore());
  assert.equal(heldCapability("/school/invite", brokenStore()), A);
});

test("CP-2 r2 N1: a failed write never lets an older link stand in for the new one", () => {
  const store = memoryStore();
  const tab = { name: "" };
  open("/family/approve", A, store, tab);
  // A later page load: memory is empty again.
  dropCapability("/family/approve", null);
  // B arrives, and its write fails: A must not answer for it.
  const failing = { ...store, setItem: brokenStore().setItem };
  open("/family/approve", B, failing, tab);
  assert.equal(heldCapability("/family/approve", failing, tab), B);
  // Even after this page, the old one is gone, not revived.
  dropCapability("/family/approve", null);
  assert.equal(heldCapability("/family/approve", failing, tab), null);
});
