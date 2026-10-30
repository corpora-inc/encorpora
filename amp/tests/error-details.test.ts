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

test("React and rejected-promise stacks retain only a public app frame", () => {
  const origin = "https://amp.example.test";
  for (const frame of [
    "    at privateFunction (https://amp.example.test/assets/index-ABCdef12.js?email=private@example.test#secret:12:345)",
    "    at https://amp.example.test/assets/index-ABCdef12.js:12:345",
    "privateFunction@https://amp.example.test/assets/index-ABCdef12.js:12:345",
    "@https://amp.example.test/assets/index-ABCdef12.js:12:345",
  ]) {
    const error = new Error("private@example.test");
    error.stack = [
      error.message,
      "    at privateFunction (https://outside.test/assets/secret-ABCdef12.js:1:2)",
      "    at privateFunction (https://amp.example.test/private/path.js:1:2)",
      frame,
    ].join("\n");
    const details = errorDetails(error, undefined, origin);
    assert.deepEqual(details, {
      exception: "Error",
      category: "runtime",
      source: "app",
      asset: "index-ABCdef12.js",
      line: 12,
      column: 345,
    });
    assert.doesNotMatch(
      JSON.stringify(details),
      /private|secret|https|outside/,
    );
    assert.equal(
      funnelPropsSchemas.client_error.safeParse({
        ...details,
        kind: "render",
        boundary: "caught",
        screen: "auth",
      }).success,
      true,
    );
  }
});

test("stack parsing requires a trusted origin and bounds frames and coordinates", () => {
  const origin = "https://amp.example.test";
  const error = new Error("private");
  for (const stack of [
    "at https://amp.example.test.evil.test/assets/index-ABCdef12.js:12:345",
    "at https://amp.example.test/private-ABCdef12.js:12:345",
    "at blob:https://amp.example.test/assets/index-ABCdef12.js:12:345",
    "ignored\n".repeat(20) +
      "at https://amp.example.test/assets/index-ABCdef12.js:12:345",
    "x".repeat(16384) +
      "\nat https://amp.example.test/assets/index-ABCdef12.js:12:345",
  ]) {
    error.stack = stack;
    assert.deepEqual(errorDetails(error, undefined, origin), {
      exception: "Error",
      category: "runtime",
    });
  }
  error.stack =
    "at https://amp.example.test/assets/index-ABCdef12.js:99999999:99999999";
  const details = errorDetails(error, undefined, origin);
  assert.equal(details.line, undefined);
  assert.equal(details.column, undefined);
  assert.equal(errorDetails(error).asset, undefined);
  Object.defineProperty(error, "stack", {
    get() {
      throw new Error("private");
    },
  });
  assert.doesNotThrow(() => errorDetails(error, undefined, origin));
});

test("fixed production React codes and CSS load failures explain generic errors", () => {
  const details = errorDetails(
    new Error("Minified React error #310; private@example.test"),
  );
  assert.deepEqual(details, {
    exception: "Error",
    category: "runtime",
    reactCode: 310,
  });
  assert.equal(
    errorDetails(new Error("Minified React error #12345; private")).reactCode,
    undefined,
  );
  assert.equal(
    errorDetails(
      new Error("Unable to preload CSS for https://example.test/private.css"),
    ).category,
    "chunk",
  );
});
