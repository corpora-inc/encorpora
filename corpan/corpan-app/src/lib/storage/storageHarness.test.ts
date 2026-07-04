// npm-test wrapper for the storage + local-analytics verification harness
// (storage-analytics.md §7.1, sections 1–14). The harness needs fake browser
// globals installed BEFORE the modules under test are imported, and the
// modules use extensionless internal imports — so we bundle through esbuild
// (the established `wordPack.test.ts` approach) and run the proof as a child
// process, asserting a clean exit. Per-section PASS/FAIL detail is printed
// on failure.

import { test } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"
import os from "node:os"
import fs from "node:fs"
import { execFileSync } from "node:child_process"

test("storage harness — all 14 sections pass", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const appRoot = path.resolve(here, "..", "..", "..")
  const entry = path.join(here, "__harness__", "run.ts")
  const outfile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "corpan-storage-harness-")),
    "harness.cjs",
  )

  const { build } = await import("esbuild")
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "silent",
  })

  let output = ""
  try {
    output = execFileSync(process.execPath, [outfile], {
      cwd: appRoot, // section 13 greps src/lib/localAnalytics from cwd
      encoding: "utf8",
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    assert.fail(
      `harness exited non-zero (${e.status}).\n--- stdout ---\n${e.stdout ?? ""}\n--- stderr ---\n${e.stderr ?? ""}`,
    )
  }
  assert.match(output, /ALL CHECKS PASSED/)
})
