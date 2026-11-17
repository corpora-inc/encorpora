import assert from "node:assert/strict";
import test from "node:test";
import { frameRegionAllowed } from "../scripts/layout-sweep-rules.js";

test("a full-screen frame's one scroll region is allowed only as the page's one scroll, its controls in view", () => {
  // The practice screen: the problem area scrolls, the page doesn't, the
  // answer controls stay put.
  assert.equal(
    frameRegionAllowed({
      pageScrolls: false,
      regions: 1,
      controlsInView: true,
    }),
    true,
  );
  // The page scrolls too: two scrolls.
  assert.equal(
    frameRegionAllowed({ pageScrolls: true, regions: 1, controlsInView: true }),
    false,
  );
  // Two regions in the frame (a stage and an explanation).
  assert.equal(
    frameRegionAllowed({
      pageScrolls: false,
      regions: 2,
      controlsInView: true,
    }),
    false,
  );
  // The answer controls pushed out of view.
  assert.equal(
    frameRegionAllowed({
      pageScrolls: false,
      regions: 1,
      controlsInView: false,
    }),
    false,
  );
});
