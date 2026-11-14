import { test } from "node:test";
import assert from "node:assert/strict";
import { isInjectedRuntimeError } from "../src/analytics/injected-error";
import { errorDetails } from "../src/analytics/error-details";
const origin = "https://amp.example";
const external = "https://bridge.example/injected.js";
for (const browser of [
  "inapp-facebook",
  "inapp-instagram",
  "inapp-tiktok",
] as const) {
  test(`${browser}: filters external source URLs and Chromium/WebKit stacks`, () => {
    assert(isInjectedRuntimeError(null, external, origin, browser));
    for (const stack of [
      `Error: failed\n    at run (${external}:1:2)`,
      `run@${external}:1:2`,
      `Error\n    at ${external}:1:2`,
      "Error\n    at run (user-script://bridge.js:1:2)",
      "run@user-script:3:1:2",
    ])
      assert(
        isInjectedRuntimeError({ stack }, undefined, origin, browser),
        stack,
      );
  });
  test(`${browser}: preserves same-origin code, mixed stacks, and unknown sources`, () => {
    for (const file of [
      "/src/main.tsx",
      `${origin}/assets/index-ABCdef12.js`,
      `${origin}/worker.js`,
    ])
      assert(!isInjectedRuntimeError(null, file, origin, browser));
    for (const stack of [
      `Error\n at run (${origin}/assets/index-ABCdef12.js:1:2)\n at ${external}:1:2`,
      `run@${external}:1:2\napp@${origin}/assets/index-ABCdef12.js:3:4`,
    ])
      assert(!isInjectedRuntimeError({ stack }, external, origin, browser));
    assert(
      !isInjectedRuntimeError(
        { name: "Error", stack: "Error: unattributed" },
        undefined,
        origin,
        browser,
      ),
    );
    assert(!isInjectedRuntimeError(null, "", origin, browser));
    assert(
      !isInjectedRuntimeError(
        {
          get stack() {
            throw Error();
          },
        },
        external,
        origin,
        browser,
      ),
    );
  });
}
test("standard browsers are never filtered just for an external frame", () => {
  assert(!isInjectedRuntimeError(null, external, origin, "standard"));
});
test("an app bundle in a mixed stack wins diagnostic attribution", () => {
  assert.equal(
    errorDetails(
      { stack: `Error\n at ${origin}/assets/index-ABCdef12.js:1:2` },
      { filename: external },
      origin,
    ).source,
    "app",
  );
});
test("recognizes import failures without mistaking ordinary fetch errors for chunks", () => {
  for (const message of [
    "Failed to fetch dynamically imported module: synthetic",
    "Importing a module script failed.",
    "error loading dynamically imported module",
    "Loading chunk 5 failed.",
    "Unable to preload CSS for synthetic",
    "Failed to load module script",
  ])
    assert.equal(errorDetails(new TypeError(message)).category, "chunk");
  assert.equal(errorDetails({ name: "ChunkLoadError" }).category, "chunk");
  assert.equal(
    errorDetails("Importing a module script failed.").category,
    "chunk",
  );
  assert.equal(
    errorDetails(new TypeError("Failed to fetch")).category,
    "network",
  );
});
