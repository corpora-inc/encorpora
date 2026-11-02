import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertPatchedVersion,
  secureChromium,
  chromePath,
} from "../browser-security.mjs";

test("rejects vulnerable and malformed versions, accepts patched and later releases", () => {
  for (const v of [
    "153.0.8010.12",
    "156.0.8078.4",
    "156.0.8078.72",
    "unknown",
    "156",
  ])
    assert.throws(() => assertPatchedVersion(v));
  for (const v of ["156.0.8078.73", "156.0.8078.80", "157.0.0.0"])
    assert.doesNotThrow(() => assertPatchedVersion(v));
});
test("forces the patched executable and sandbox through dynamic engine dispatch", async () => {
  const prior = process.env.CORPORA_CHROME_PATH;
  process.env.CORPORA_CHROME_PATH = process.execPath;
  try {
    let options: any;
    const fake = {
      launch: async (input: any) => {
        options = input;
        return { version: () => "156.0.8078.80", close: async () => {} };
      },
    };
    const engine = secureChromium(fake);
    await engine.launch({
      chromiumSandbox: false,
      executablePath: "/unsafe",
      channel: "chrome",
      args: ["--disable-gpu"],
    });
    assert.equal(options.chromiumSandbox, true);
    assert.equal(options.executablePath, chromePath());
    assert.equal(options.channel, undefined);
    assert.deepEqual(options.args, ["--disable-gpu"]);
    await assert.rejects(
      () => engine.launch({ args: ["--no-sandbox"] }),
      /forbidden/,
    );
  } finally {
    if (prior === undefined) delete process.env.CORPORA_CHROME_PATH;
    else process.env.CORPORA_CHROME_PATH = prior;
  }
});
test("closes an outdated browser before returning it to a caller", async () => {
  const prior = process.env.CORPORA_CHROME_PATH;
  process.env.CORPORA_CHROME_PATH = process.execPath;
  try {
    let closed = false;
    const engine = secureChromium({
      launch: async () => ({
        version: () => "156.0.8078.4",
        close: async () => {
          closed = true;
        },
      }),
    });
    await assert.rejects(() => engine.launch(), /vulnerable/);
    assert.equal(closed, true);
  } finally {
    if (prior === undefined) delete process.env.CORPORA_CHROME_PATH;
    else process.env.CORPORA_CHROME_PATH = prior;
  }
});
