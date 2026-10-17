import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const exporter = fileURLToPath(
  new URL("../scripts/export-math-cases.ts", import.meta.url),
);
const oracle = fileURLToPath(
  new URL("../scripts/independent-math-review.py", import.meta.url),
);
function review(input: string) {
  return spawnSync("python3", [oracle], {
    cwd: root,
    encoding: "utf8",
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
}

test("independent exact oracle checks the complete inventory and rejects corrupt or missing coverage", () => {
  const exported = spawnSync(process.execPath, ["--import", "tsx", exporter], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(exported.status, 0, exported.stderr || String(exported.error));
  const lines = exported.stdout.trimEnd().split("\n");
  const manifest = JSON.parse(lines[0]!);
  const valid = review(exported.stdout);
  assert.equal(valid.status, 0, valid.stderr || String(valid.error));
  assert.deepEqual(JSON.parse(valid.stdout), {
    cases: manifest.templates.length * 256,
    families: manifest.templates.length,
    seedsPerFamily: 256,
    seedStart: 0,
    mismatches: 0,
  });
  const first = JSON.parse(lines[1]!);
  const wrongAnswer = {
    ...first,
    problem: { ...first.problem, answer: "-999999" },
  };
  const corrupted = review(
    [lines[0], JSON.stringify(wrongAnswer), ...lines.slice(2)].join("\n") +
      "\n",
  );
  assert.notEqual(corrupted.status, 0);
  assert.match(corrupted.stderr, /Mismatch/);
  assert.notEqual(review(lines.slice(0, -1).join("\n") + "\n").status, 0);
  const duplicate = review(exported.stdout + lines[1] + "\n");
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /Duplicate case/);
  const unknown = review(
    JSON.stringify({
      ...manifest,
      templates: [...manifest.templates, "unreviewed-family"],
    }) + "\n",
  );
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /inventory mismatch/);
  const graphIndex = lines.findIndex(
    (line, index) =>
      index > 0 &&
      JSON.parse(line).problem.public.templateId === "graphed-line-slope",
  );
  assert.ok(
    graphIndex > 0,
    "The graphical consistency regression must visit a slope case",
  );
  const graph = JSON.parse(lines[graphIndex]!);
  graph.problem.public.figure.lines[0].m += 0.5;
  const wrongLine = review(
    [
      ...lines.slice(0, graphIndex),
      JSON.stringify(graph),
      ...lines.slice(graphIndex + 1),
    ].join("\n") + "\n",
  );
  assert.notEqual(wrongLine.status, 0);
  assert.match(wrongLine.stderr, /Line slope contradicts points/);
  const choiceIndex = lines.findIndex(
    (line, index) =>
      index > 0 &&
      JSON.parse(line).problem.public.templateId ===
        "fraction-equivalence-choice",
  );
  assert.ok(choiceIndex > 0);
  const choice = JSON.parse(lines[choiceIndex]!);
  choice.problem.public.response.options[1].label =
    choice.problem.public.response.options[0].label;
  const duplicateChoice = review(
    [
      ...lines.slice(0, choiceIndex),
      JSON.stringify(choice),
      ...lines.slice(choiceIndex + 1),
    ].join("\n") + "\n",
  );
  assert.notEqual(duplicateChoice.status, 0);
  assert.match(duplicateChoice.stderr, /duplicate choice|exactly one/i);
  const wrongChoice = JSON.parse(lines[choiceIndex]!);
  wrongChoice.problem.answer = "option-z";
  const choiceMismatch = review(
    [
      ...lines.slice(0, choiceIndex),
      JSON.stringify(wrongChoice),
      ...lines.slice(choiceIndex + 1),
    ].join("\n") + "\n",
  );
  assert.notEqual(choiceMismatch.status, 0);
  assert.match(choiceMismatch.stderr, /Mismatch/);
  const undersized = review(
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
