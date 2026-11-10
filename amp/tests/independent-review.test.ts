import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const exporter = fileURLToPath(
  new URL("../scripts/export-math-cases.ts", import.meta.url),
);
const oracle = fileURLToPath(
  new URL("../scripts/independent-math-review.py", import.meta.url),
);
// Only stderr and the oracle's one-line summary come back as strings: the
// export itself (over 512 MiB, past V8's longest string) stays in a file.
const maxBuffer = 64 * 1024 * 1024;
function timed<T>(name: string, run: () => T): T {
  const started = performance.now();
  writeSync(2, `[inventory] ${name}: started\n`);
  try {
    return run();
  } finally {
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    writeSync(2, `[inventory] ${name}: completed in ${seconds}s\n`);
  }
}
function review(name: string, input: string | { file: string }) {
  const stdin = typeof input === "string" ? "pipe" : openSync(input.file, "r");
  try {
    return timed(name, () =>
      spawnSync("python3", [oracle], {
        cwd: root,
        encoding: "utf8",
        input: typeof input === "string" ? input : undefined,
        stdio: [stdin, "pipe", "pipe"],
        maxBuffer,
        // Hermetic: review:math rebuilds and reviews the print publications; here
        // stale files on disk must neither fail nor pass this inventory test.
        env: {
          ...process.env,
          AMP_PUBLICATIONS_DIR: "/nonexistent/amp-publications",
        },
      }),
    );
  } finally {
    if (typeof stdin === "number") closeSync(stdin);
  }
}
/** The export's lines, one at a time, until `visit` returns true. */
function scan(file: string, visit: (line: string, index: number) => boolean) {
  const fd = openSync(file, "r");
  const chunk = Buffer.alloc(1 << 20);
  const decoder = new StringDecoder("utf8");
  let rest = "",
    index = 0,
    read: number;
  try {
    while ((read = readSync(fd, chunk, 0, chunk.length, null)) > 0) {
      const lines = (rest + decoder.write(chunk.subarray(0, read))).split("\n");
      rest = lines.pop()!;
      for (const line of lines) if (visit(line, index++)) return;
    }
    if (rest) visit(rest, index);
  } finally {
    closeSync(fd);
  }
}

test("independent exact oracle checks the complete inventory and rejects corrupt or missing coverage", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "amp-inventory-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "cases.jsonl");
  const output = openSync(file, "w");
  const exported = timed("export complete inventory", () =>
    spawnSync(process.execPath, ["--import", "tsx", exporter], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", output, "pipe"],
      maxBuffer,
    }),
  );
  closeSync(output);
  assert.equal(exported.status, 0, exported.stderr || String(exported.error));
  // The manifest, the first case, and one case of each family the
  // rejections below corrupt.
  const wanted = new Map([
    ["graphed-line-slope", ""],
    ["fraction-equivalence-choice", ""],
  ]);
  const lines: string[] = [];
  scan(file, (line, index) => {
    if (index < 2) lines.push(line);
    else
      for (const [id, found] of wanted)
        if (
          !found &&
          line.includes(`"templateId":"${id}"`) &&
          JSON.parse(line).problem.public.templateId === id
        )
          wanted.set(id, line);
    return index >= 2 && [...wanted.values()].every(Boolean);
  });
  const manifest = JSON.parse(lines[0]!);
  const valid = review("accept complete inventory", { file });
  assert.equal(valid.status, 0, valid.stderr || String(valid.error));
  assert.deepEqual(JSON.parse(valid.stdout), {
    cases: manifest.templates.length * 256,
    families: manifest.templates.length,
    seedsPerFamily: 256,
    seedStart: 0,
    mismatches: 0,
  });
  // The oracle streams and stops at the first bad record, so each rejection
  // needs only the manifest and that record.
  const reject = (name: string, ...records: string[]) =>
    review(name, [lines[0], ...records].join("\n") + "\n");
  const first = JSON.parse(lines[1]!);
  const corrupted = reject(
    "reject wrong answer",
    JSON.stringify({
      ...first,
      problem: { ...first.problem, answer: "-999999" },
    }),
  );
  assert.notEqual(corrupted.status, 0);
  assert.match(corrupted.stderr, /Mismatch/);
  const missing = reject("reject missing coverage", lines[1]!);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Incomplete coverage/);
  const duplicate = reject("reject duplicate record", lines[1]!, lines[1]!);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /Duplicate case/);
  const unknown = review(
    "reject unknown family",
    JSON.stringify({
      ...manifest,
      templates: [...manifest.templates, "unreviewed-family"],
    }) + "\n",
  );
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /inventory mismatch/);
  const graphLine = wanted.get("graphed-line-slope");
  assert.ok(
    graphLine,
    "The graphical consistency regression must visit a slope case",
  );
  const graph = JSON.parse(graphLine);
  graph.problem.public.figure.lines[0].m += 0.5;
  const wrongLine = reject("reject inconsistent graph", JSON.stringify(graph));
  assert.notEqual(wrongLine.status, 0);
  assert.match(wrongLine.stderr, /Line slope contradicts points/);
  const choiceLine = wanted.get("fraction-equivalence-choice");
  assert.ok(choiceLine);
  const choice = JSON.parse(choiceLine);
  choice.problem.public.response.options[1].label =
    choice.problem.public.response.options[0].label;
  const duplicateChoice = reject(
    "reject duplicate choice",
    JSON.stringify(choice),
  );
  assert.notEqual(duplicateChoice.status, 0);
  assert.match(duplicateChoice.stderr, /duplicate choice|exactly one/i);
  const wrongChoice = JSON.parse(choiceLine);
  wrongChoice.problem.answer = "option-z";
  const choiceMismatch = reject(
    "reject wrong choice",
    JSON.stringify(wrongChoice),
  );
  assert.notEqual(choiceMismatch.status, 0);
  assert.match(choiceMismatch.stderr, /Mismatch/);
  const undersized = review(
    "reject undersized coverage",
    JSON.stringify({ ...manifest, seedCount: 255 }) + "\n",
  );
  assert.notEqual(undersized.status, 0);
  assert.match(undersized.stderr, /at least 256/);
});

test("exporter rejects undersized seed samples", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", exporter, "--seeds", "255"],
    { cwd: root, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
});
