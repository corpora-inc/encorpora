import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { serverBuildOptions } from "../scripts/build-server";
import { SchoolError } from "../src/schools/contracts";
import {
  demoTerms,
  MANIFEST,
  readManifest,
  shippedKey,
  shippedTermsProblem,
  termFile,
  TERMS_DIR,
  variantJobs,
  WEEKDAYS,
} from "../src/schools/demo/snapshot";

/* The shared demo school's terms ship with the image (`snapshot.ts`): no API
   pod ever simulates one. A term takes minutes of CPU and hundreds of
   megabytes a thread; in a pod it was an out-of-memory kill. */

test("every weekday's shipped term is current, under the 5 MiB file limit, and decodes", async () => {
  assert.equal(
    shippedTermsProblem(),
    null,
    "the shipped demo terms are stale: run `npm run demo:terms` and commit src/schools/demo/terms/",
  );
  const manifest = readManifest()!;
  assert.deepEqual(
    manifest.weekdays.map((row) => row.weekday),
    [...WEEKDAYS],
  );
  for (const weekday of WEEKDAYS) {
    const size = statSync(new URL(termFile(weekday), TERMS_DIR)).size;
    assert.ok(size < 5 * 1024 * 1024, `w${weekday}: ${size} bytes`);
  }
  const weekday = 2;
  const school = await demoTerms("school", weekday);
  assert.equal(school.length, variantJobs("school", weekday).length);
  for (const term of school) assert.ok(term.answers.length > 0);
  // A class is the school's first class, the same students on the same day.
  const klass = await demoTerms("class", weekday);
  assert.equal(klass.length, variantJobs("class", weekday).length);
  assert.deepEqual(klass, school.slice(0, klass.length));
});

test("without a current shipped term a demo is refused and logged, never computed", async (t) => {
  const errors: string[] = [];
  t.mock.method(console, "error", (line: string) => errors.push(line));
  const refused = (error: unknown) =>
    error instanceof SchoolError &&
    error.statusCode === 503 &&
    error.code === "demo_preparing";

  // An image that left the terms out.
  const empty = pathToFileURL(mkdtempSync(join(tmpdir(), "demo-terms-")) + "/");
  await assert.rejects(demoTerms("school", 3, empty), refused);
  assert.match(shippedTermsProblem(empty) ?? "", /w0: no shipped term/);

  // Terms of another version or roster.
  const stale = pathToFileURL(mkdtempSync(join(tmpdir(), "demo-terms-")) + "/");
  const manifest = readManifest()!;
  for (const row of manifest.weekdays)
    copyFileSync(
      new URL(termFile(row.weekday), TERMS_DIR),
      new URL(termFile(row.weekday), stale),
    );
  writeFileSync(
    new URL(MANIFEST, stale),
    JSON.stringify({
      ...manifest,
      weekdays: manifest.weekdays.map((row) => ({
        ...row,
        key: row.key.replace(/:v\d+:/, ":v0:"),
      })),
    }),
  );
  await assert.rejects(demoTerms("class", 3, stale), refused);
  assert.match(shippedTermsProblem(stale) ?? "", /is not school:v/);

  // A file that is not the one its manifest names.
  const torn = pathToFileURL(mkdtempSync(join(tmpdir(), "demo-terms-")) + "/");
  writeFileSync(new URL(MANIFEST, torn), JSON.stringify(manifest));
  writeFileSync(new URL(termFile(3), torn), "not a term");
  await assert.rejects(demoTerms("school", 3, torn), refused);

  assert.equal(errors.length, 3);
  for (const line of errors)
    assert.equal(JSON.parse(line).key, shippedKey(3), line);
});

test("the server bundle never contains the simulation or starts its worker", async () => {
  const root = new URL("../", import.meta.url).pathname;
  const outdir = mkdtempSync(join(tmpdir(), "server-build-"));
  const result = await build({
    ...serverBuildOptions({}),
    absWorkingDir: root,
    outdir,
    write: false,
    metafile: true,
    logLevel: "error",
  });
  const outputs = Object.keys(result.metafile.outputs).map((path) =>
    path.slice(path.lastIndexOf("/") + 1),
  );
  assert.ok(outputs.includes("main.mjs"), outputs.join(", "));
  assert.ok(
    !outputs.some((name) => name.includes("simulate")),
    outputs.join(", "),
  );
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(
    inputs.includes("src/schools/demo/shared.ts"),
    "the demo is served",
  );
  for (const banned of [
    "src/schools/demo/simulate.ts",
    "src/schools/demo/simulate-pool.ts",
    "src/schools/demo/simulate-worker.ts",
    "src/schools/demo/seed-history.ts",
  ])
    assert.ok(!inputs.includes(banned), `${banned} is in the server bundle`);
  const main = result.outputFiles.find((file) =>
    file.path.endsWith("/server/main.mjs"),
  )!;
  assert.doesNotMatch(main.text, /simulate-worker/);
});

/* Opt-in, minutes of CPU: `AMP_DEMO_TERMS_RECOMPUTE=2` recomputes Wednesday's
   school and compares it with the shipped one (`npm run demo:terms -- --check
   2` does the same). It holds until an engine change moves the planner or the
   estimator, which by design does not change a shipped term. */
test(
  "a shipped term is what the engine computes",
  { skip: !process.env.AMP_DEMO_TERMS_RECOMPUTE },
  async () => {
    const weekday = Number(process.env.AMP_DEMO_TERMS_RECOMPUTE);
    const { simulateJobs } = await import("../src/schools/demo/simulate-pool");
    const fresh = await simulateJobs(variantJobs("school", weekday));
    assert.deepEqual(await demoTerms("school", weekday), fresh);
  },
);
