import assert from "node:assert/strict";
import test from "node:test";
import {
  dropAllCapabilities,
  heldCapability,
  takeCapabilityFragment,
} from "../src/web/capability-entry.js";

/** CP-2 r2 N2: another account, or a student's session, lets every held link
 * go (providers.tsx and student-device.ts call this). */
test("an account change or a student's session drops every held link", () => {
  const items = new Map<string, string>();
  const store = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
  const tab = { name: "" };
  const history = { state: null, replaceState: () => {} };
  for (const pathname of ["/school/invite", "/family/approve"])
    takeCapabilityFragment(
      { pathname, search: "", hash: `#${"a".repeat(43)}` },
      history,
      store,
      tab,
    );
  dropAllCapabilities(store);
  assert.equal(heldCapability("/school/invite", store, tab), null);
  assert.equal(heldCapability("/family/approve", store, tab), null);
  assert.equal(items.size, 0);
});
