import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  dropCapability,
  heldCapability,
  takeCapabilityFragment,
} from "../src/web/capability-entry.js";

/** Two hours: how long a held link lasts. */
const HELD_FOR_MS = 2 * 60 * 60 * 1000;
/** A later page load of the same tab: this page's memory is empty again. */
const reload = () => {
  dropCapability("/school/invite", null);
  dropCapability("/family/approve", null);
};

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
beforeEach(reload);

test("CP-2 r2 N2: a tab opened from this one, or an expired hold, reads nothing", () => {
  const store = memoryStore();
  const tab = { name: "" };
  open("/school/invite", A, store, tab, 1_000);
  reload(); // memory clears; storage keeps this tab's copy
  // Reload of the same tab: its mark, before the hold expires.
  open("/school/invite", A, store, tab, 1_000);
  dropCapability("/school/invite", null);
  const copy = memoryStore();
  for (const [key, value] of store.items) copy.items.set(key, value);
  // A tab this one opened inherits sessionStorage, not its name.
  assert.equal(
    heldCapability("/school/invite", copy, { name: "" }, 2_000),
    null,
  );
  // This tab reads it until it expires.
  open("/school/invite", A, store, tab, 1_000);
  reload();
  open("/school/invite", A, store, tab, 1_000);
  assert.ok(store.items.size > 0);
  const reread = (now: number) => {
    const fresh = memoryStore();
    for (const [key, value] of store.items) fresh.items.set(key, value);
    reload();
    return heldCapability("/school/invite", fresh, tab, now);
  };
  assert.equal(reread(2_000), A);
  assert.equal(reread(1_000 + HELD_FOR_MS + 1), null);
});
