/**
 * The validator's inputs.
 *
 * A gate that goes green because its input file could not be read is the failure
 * mode this whole package argues against, and CG-1 is the gate where it would
 * matter most: mastery keys are the one thing that cannot be repaired after ship.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readJson, SHIPPED_IDS_PATH, SNAPSHOT_PATH } from "./cli.ts";
import type { ShippedIds } from "./context.ts";
import type { Snapshot } from "./gates/generatorGates.ts";

test("cli: a missing input is a fallback only where the caller says absence is legitimate", () => {
  const dir = mkdtempSync(join(tmpdir(), "dw-cli-"));
  try {
    const missing = join(dir, "not-here.json");
    assert.deepEqual(readJson(missing, { note: "", entries: {} }), { note: "", entries: {} });
    // `shipped-ids.json` is committed. Its absence is a broken checkout, not a
    // first run, and CG-1 must not quietly become a no-op that still prints OK.
    assert.throws(() => readJson(missing), /cannot read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli: a malformed input throws rather than degrading to the fallback", () => {
  const dir = mkdtempSync(join(tmpdir(), "dw-cli-"));
  try {
    const path = join(dir, "broken.json");
    writeFileSync(path, '{"releases": [', "utf8");
    assert.throws(() => readJson(path, { note: "", releases: {} }), /is not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli: the committed inputs parse", () => {
  const shipped = readJson<ShippedIds>(SHIPPED_IDS_PATH);
  assert.equal(typeof shipped.releases, "object");
  const snapshot = readJson<Snapshot>(SNAPSHOT_PATH);
  assert.ok(Object.keys(snapshot.entries).length > 0, "the snapshot has committed hashes");
});
