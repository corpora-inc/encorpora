import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { build } from "esbuild";
import { serverBuildOptions } from "../scripts/build-server";
import { applyBatch, BATCH_MAX, readJson, USAGE } from "../src/acquisition/cli";

test("a batch applies every command in order and counts replays", async () => {
  const seen: unknown[] = [];
  const result = await applyBatch(
    async (command) => {
      seen.push(command);
      return { replay: (command as { again?: boolean }).again === true };
    },
    [
      { action: "import-sent", n: 1 },
      { action: "record-event", kind: "mailbox_checked", n: 2 },
      { action: "import-sent", n: 3, again: true },
    ],
  );
  assert.deepEqual(
    seen.map((command) => (command as { n: number }).n),
    [1, 2, 3],
  );
  assert.deepEqual(result, {
    applied: 2,
    replayed: 1,
    failed: 0,
    tally: { "import-sent": 2, "record-event:mailbox_checked": 1 },
    errors: [],
  });
});

test("a failed command is reported by position and the rest still run", async () => {
  const ran: number[] = [];
  const result = await applyBatch(
    async (command) => {
      const { n } = command as { n: number };
      ran.push(n);
      if (n === 2) throw new Error("Expected exactly one acquisition contact");
      // A database error carries a code and may quote a row: never shown.
      if (n === 3)
        throw Object.assign(new Error("Key (email)=(parent@example.com)"), {
          code: "23505",
        });
      return { replay: false };
    },
    [
      { action: "import-sent", n: 1 },
      { action: "import-sent", n: 2 },
      { action: "claim", n: 3 },
      { action: "import-sent", n: 4 },
      "not a command",
    ],
  );
  assert.deepEqual(ran, [1, 2, 3, 4, undefined]);
  assert.equal(result.applied, 3);
  assert.equal(result.failed, 2);
  assert.deepEqual(result.errors, [
    {
      index: 1,
      action: "import-sent",
      message: "Expected exactly one acquisition contact",
    },
    {
      index: 2,
      action: "claim",
      message: "Pipeline database operation failed",
    },
  ]);
  assert.ok(!JSON.stringify(result).includes("parent@example.com"));
});

test("a batch must be an array within the size limit", async () => {
  const run = async () => ({ replay: false });
  await assert.rejects(
    applyBatch(run, { action: "import-sent" }),
    /JSON array/,
  );
  await assert.rejects(
    applyBatch(
      run,
      Array.from({ length: BATCH_MAX + 1 }, () => ({})),
    ),
    /at most/,
  );
});

test("input is decoded whole, so a character split across chunks survives", async () => {
  const bytes = Buffer.from(
    JSON.stringify([{ subject: "AMP \u2014 caf\u00e9" }]),
  );
  const at = bytes.indexOf(0xe2) + 1; // inside the em dash's three bytes
  async function* chunks() {
    yield bytes.subarray(0, at);
    yield bytes.subarray(at);
  }
  assert.deepEqual(await readJson(chunks(), 1000), [
    { subject: "AMP \u2014 caf\u00e9" },
  ]);
  await assert.rejects(readJson(chunks(), 10), /too large/);
  async function* broken() {
    yield '[{"email":"parent@example.com",}]';
  }
  await assert.rejects(readJson(broken(), 1000), (error: Error) => {
    assert.equal(error.message, "Input is not valid JSON");
    return true;
  });
});

test("a failure never prints what the input put where an action belongs", async () => {
  const result = await applyBatch(async () => {
    throw new Error("refused");
  }, [{ action: "parent@example.com" }, { action: "claim", kind: "A B" }]);
  assert.deepEqual(
    result.errors.map((error) => error.action),
    ["unknown", "claim"],
  );
});

test("the server build ships the command as one file that runs on plain node", async (t) => {
  const root = new URL("..", import.meta.url).pathname;
  const outdir = mkdtempSync(join(tmpdir(), "pipeline-cli-"));
  // Packages stay external, as in the image, where they sit beside `src`.
  symlinkSync(join(root, "node_modules"), join(outdir, "node_modules"));
  const result = await build({
    ...serverBuildOptions({}),
    entryPoints: ["src/acquisition/cli.ts"],
    absWorkingDir: root,
    outdir,
    metafile: true,
    logLevel: "error",
  });
  assert.ok(
    serverBuildOptions({}).entryPoints instanceof Array &&
      (serverBuildOptions({}).entryPoints as string[]).includes(
        "src/acquisition/cli.ts",
      ),
    "the production build must include the pipeline command",
  );
  const file = Object.keys(result.metafile.outputs).find((path) =>
    path.endsWith("acquisition/cli.mjs"),
  );
  assert.ok(file, Object.keys(result.metafile.outputs).join(", "));
  // Light enough for a pod near its limit: the pipeline's own modules, not
  // the server, the curriculum or the engine.
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(
    inputs.length < 20,
    `${inputs.length} modules: ${inputs.join(", ")}`,
  );
  assert.ok(
    !inputs.some((path) =>
      /src\/(math|curriculum|learning|schools)\//.test(path),
    ),
    inputs.join(", "),
  );
  // No TypeScript loader, no npm: usage is checked before any connection.
  const run = promisify(execFile);
  t.after(() => rmSync(outdir, { recursive: true, force: true }));
  await assert.rejects(
    run(process.execPath, [join(outdir, "acquisition/cli.mjs"), "nonsense"], {
      env: { ...process.env, AMP_DATABASE_URL: "" },
    }),
    (error: { stderr?: string }) => error.stderr?.includes(USAGE) === true,
  );
});
