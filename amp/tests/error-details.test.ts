import test from "node:test";
import assert from "node:assert/strict";
import { errorDetails } from "../src/analytics/error-details.js";
import { funnelPropsSchemas } from "../src/analytics/events.js";
test("diagnostics explain failures without copying their private content", () => {
  const error = new TypeError(
    "Failed to fetch https://example.test/?email=private@example.test",
  );
  assert.deepEqual(
    errorDetails(
      error,
      {
        filename:
          "https://amp.corpora.inc/assets/index-ABCdef12.js?private=secret",
        lineno: 4,
        colno: 35,
      },
      "https://amp.corpora.inc",
    ),
    {
      exception: "TypeError",
      category: "network",
      source: "app",
      asset: "index-ABCdef12.js",
      line: 4,
      column: 35,
    },
  );
  assert.deepEqual(
    errorDetails(
      error,
      { filename: "https://evil.test/private.js", lineno: 4 },
      "https://amp.corpora.inc",
    ),
    { exception: "TypeError", category: "network", source: "external" },
  );
  assert.equal(
    errorDetails(new DOMException("private", "SecurityError")).category,
    "security",
  );
  assert.equal(
    errorDetails(
      new Error(
        "Failed to fetch dynamically imported module: private@example.test",
      ),
    ).category,
    "chunk",
  );
  assert.equal(
    errorDetails({ name: "private@example.test", message: "private" })
      .exception,
    "unknown",
  );
  assert.doesNotThrow(() =>
    errorDetails(
      new Proxy(
        {},
        {
          get() {
            throw new Error("private");
          },
        },
      ),
    ),
  );
  assert.equal(
    funnelPropsSchemas.client_error.safeParse({
      kind: "error",
      screen: "auth",
      message: "private",
    }).success,
    false,
  );
});
