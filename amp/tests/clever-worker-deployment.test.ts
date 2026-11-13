import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("L-d: read-only Clever worker supplies a writable temporary directory", async () => {
  const manifest = await readFile(
    new URL("../deploy/clever-sync-cronjob.yaml", import.meta.url),
    "utf8",
  );
  assert.match(manifest, /name: temporary\s+emptyDir:/);
  assert.match(manifest, /name: temporary\s+mountPath: \/tmp/);
  assert.match(manifest, /name: TMPDIR\s+value: "?\/tmp"?/);
  assert.match(manifest, /readOnlyRootFilesystem: true/);
});
