import assert from "node:assert/strict";
import test from "node:test";
import {
  dropAllCapabilities,
  heldCapability,
  takeCapabilityFragment,
} from "../src/web/capability-entry.js";

/** CP-2 r2 N2: another account, or a student's session, lets every held link
 * go (features/links/forget.ts calls this, with the sign-in carry). */
test("dropping all lets every held link go", () => {
  const history = { state: null, replaceState: () => {} };
  for (const pathname of ["/school/invite", "/family/approve"])
    takeCapabilityFragment(
      { pathname, search: "", hash: `#${"a".repeat(43)}` },
      history,
    );
  dropAllCapabilities();
  assert.equal(heldCapability("/school/invite"), null);
  assert.equal(heldCapability("/family/approve"), null);
});
