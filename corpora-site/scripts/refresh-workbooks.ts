/** Publishes a complete daily edition before advancing latest.json. No accounts are used. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { workbookManifestSchema, type WorkbookManifest } from "../src/resources/workbook-manifest.js";

const repo = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const output = process.argv[2];
assert(output, "Usage: tsx scripts/refresh-workbooks.ts <manifest-output.json>");
const bucket = process.env.WORKBOOK_BUCKET;
const prefix = process.env.WORKBOOK_PREFIX ?? "artifacts/amp/public-site/workbooks";
const publicBase = process.env.WORKBOOK_PUBLIC_BASE ?? "https://d38iwc9748jekz.cloudfront.net/amp/public-site/workbooks";
const work = mkdtempSync(join(tmpdir(), "amp-public-workbooks-"));
const date = new Date().toISOString().slice(0, 10);
// The build always has a complete reviewed edition, even if setup/configuration fails.
const fallback = workbookManifestSchema.parse(JSON.parse(readFileSync(resolve(repo, "corpora-site/src/resources/workbooks.json"), "utf8")));
const writeOutput = (manifest: WorkbookManifest) => {
  writeFileSync(`${output}.tmp`, JSON.stringify(manifest, null, 2) + "\n");
  renameSync(`${output}.tmp`, output);
};
writeOutput(fallback);
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const aws = (args: string[]) => {
  try { return execFileSync("aws", ["s3api", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 }); }
  catch { throw new Error(`Asset storage ${args[0]} failed`); }
};
const assetBytes = async (url: string) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  assert(response.ok, `Asset unavailable (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
};
async function verifyPublished(manifest: WorkbookManifest) {
  for (const edition of manifest.editions) {
    for (const file of edition.files) {
      const bytes = await assetBytes(file.url);
      assert(bytes.length === file.bytes && bytes.subarray(0, 5).toString() === "%PDF-" && sha(bytes) === file.sha256, `Published PDF mismatch: ${file.url}`);
    }
    for (const url of [edition.cover, edition.preview]) {
      const bytes = await assetBytes(url);
      assert(bytes.length > 1000 && bytes.subarray(1, 4).toString() === "PNG", `Published preview mismatch: ${url}`);
    }
  }
}
function put(key: string, file: string, type: string, immutable: boolean) {
  const args = ["put-object", "--bucket", bucket!, "--key", `${prefix}/${key}`, "--body", file, "--content-type", type,
    "--cache-control", immutable ? "public,max-age=31536000,immutable" : "public,max-age=60,must-revalidate"];
  if (immutable) args.push("--if-none-match", "*");
  try { aws(args); } catch (error) {
    // A retry may encounter an identical immutable object. Prove its bytes before reuse.
    if (!immutable) throw error;
    const existing = join(work, "existing-object");
    aws(["get-object", "--bucket", bucket!, "--key", `${prefix}/${key}`, existing]);
    assert.equal(sha(readFileSync(existing)), sha(readFileSync(file)), `Immutable object differs: ${key}`);
  }
}
let previous: WorkbookManifest | undefined;
try {
  assert(prefix === "artifacts/amp/public-site/workbooks", "Unexpected workbook prefix");
  assert(publicBase === "https://d38iwc9748jekz.cloudfront.net/amp/public-site/workbooks", "Unexpected public asset origin");
  const priorPath = join(work, "previous.json");
  try {
    let priorBytes: Buffer;
    try {
      assert(bucket);
      aws(["get-object", "--bucket", bucket, "--key", `${prefix}/latest.json`, priorPath]);
      priorBytes = readFileSync(priorPath);
    } catch { priorBytes = await assetBytes(`${publicBase}/latest.json`); }
    previous = workbookManifestSchema.parse(JSON.parse(priorBytes.toString()));
    assert(previous.editions.every(e => e.files.every(f => f.url.startsWith(`${publicBase}/`))), "Latest edition must use immutable CDN objects");
    await verifyPublished(previous);
    writeOutput(previous);
  } catch {
    previous = undefined;
    console.log("No complete published daily edition available; preparing a new edition.");
  }
  if (previous?.date === date) {
    writeOutput(previous);
    console.log(`Using verified ${date} edition.`);
    process.exitCode = 0;
  } else {
    assert(bucket && /^[a-z0-9.-]+$/.test(bucket), "WORKBOOK_BUCKET is required for a new edition");
    const sourceCommit = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const raw: { editions: any[] } = { editions: [] };
    const generationDeadline = Date.now() + 15 * 60_000;
    for (const { grade } of fallback.editions) {
      let selected: any;
      let failure: unknown;
      // A particular mix can fail print layout. Try another deterministic mix
      // for that grade; never relax the layout or answer-correspondence checks.
      for (let attempt = 0; attempt < 4; attempt++) {
        const generated = join(work, "generated", grade, String(attempt));
        const seed = attempt === 0 ? "public-daily-v1" : `public-daily-v1-retry-${attempt}`;
        try {
          const remaining = generationDeadline - Date.now();
          assert(remaining > 0, "Workbook generation time budget exhausted");
          execFileSync(resolve(repo, "amp/node_modules/.bin/tsx"), ["--tsconfig", "tsconfig.json", "scripts/regenerate-free-workbooks.ts", "--out", generated, "--date", date, "--grades", grade, "--minutes", "45", "--seed", seed, "--source-commit", sourceCommit], {
            cwd: resolve(repo, "amp"), stdio: "inherit", timeout: Math.min(3 * 60_000, remaining),
          });
          const candidate = JSON.parse(readFileSync(join(generated, "manifest.json"), "utf8"));
          assert(candidate.date === date && candidate.editions.length === 1 && candidate.editions[0].grade === grade);
          selected = { ...candidate.editions[0], directory: generated };
          break;
        } catch (error) {
          failure = error;
          console.log(`Print validation rejected grade/course ${grade}, variation ${attempt + 1}; trying the next bounded variation.`);
        }
      }
      if (!selected) throw failure ?? new Error(`No printable edition for ${grade}`);
      raw.editions.push(selected);
    }
    const assets: { relative: string; path: string; type: string; hash: string }[] = [];
    for (const edition of raw.editions) {
      assert(edition.validation.allLayoutsPassed && edition.validation.allKeyCorrespondencePassed && edition.validation.everyProblemMappedToNamedGrade);
      for (const file of edition.files) {
        const path = join(edition.directory, file.file);
        const bytes = readFileSync(path);
        assert(file.passed && bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length === file.bytes && sha(bytes) === file.sha256);
        assets.push({ relative: file.file, path, type: "application/pdf", hash: file.sha256 });
      }
      for (const relative of [edition.cover, edition.preview]) {
        assert(typeof relative === "string" && /^[a-z0-9-]+\/(cover|practice)\.png$/.test(relative));
        const path = join(edition.directory, relative);
        const bytes = readFileSync(path);
        assert(bytes.length > 1000 && bytes.subarray(1, 4).toString() === "PNG");
        assets.push({ relative, path, type: "image/png", hash: sha(bytes) });
      }
    }
    const bundleHash = sha(JSON.stringify(assets.map(a => [a.relative, a.hash])));
    const editionPrefix = `${date}/${bundleHash}`;
    const url = (relative: string) => `${publicBase}/${editionPrefix}/${relative}`;
    const generatorSha256 = sha(readFileSync(resolve(repo, "amp/scripts/regenerate-free-workbooks.ts")));
    const manifest = workbookManifestSchema.parse({ date, editions: raw.editions.map((e: any) => ({
      grade: e.grade, slug: e.slug, title: e.title, minutes: e.minutes, topics: e.topics, areas: e.areas, problems: e.problems,
      date, sourceCommit, generatorSha256, generationSeed: e.seed, cover: url(e.cover), preview: url(e.preview),
      files: e.files.map((f: any) => ({ paper: f.paper, bytes: f.bytes, sha256: f.sha256, pages: f.pages, studentPages: f.studentPages, answerKeyPages: f.answerKeyPages, url: url(f.file) })),
    })) });
    for (const asset of assets) put(`${editionPrefix}/${asset.relative}`, asset.path, asset.type, true);
    for (const asset of assets) assert.equal(sha(await assetBytes(url(asset.relative))), asset.hash, `CDN asset mismatch: ${asset.relative}`);
    await verifyPublished(manifest);
    const candidate = join(work, "candidate.json");
    writeFileSync(candidate, JSON.stringify(manifest, null, 2) + "\n");
    put(`${editionPrefix}/manifest.json`, candidate, "application/json", true);
    // All 52 assets and the immutable manifest exist before changing the current edition.
    put("latest.json", candidate, "application/json", false);
    const readback = join(work, "latest-readback.json");
    aws(["get-object", "--bucket", bucket, "--key", `${prefix}/latest.json`, readback]);
    assert.equal(sha(readFileSync(readback)), sha(readFileSync(candidate)));
    writeOutput(manifest);
    console.log(`Published ${date}: 13 grade/course editions, 26 verified PDFs and 26 previews.`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message.split("\n")[0] : "Workbook refresh failed";
  console.error(`::warning::Daily workbook refresh failed: ${message}`);
  process.exitCode = 1;
  // Do not date an older edition as today or replace a partially published edition.
  if (previous) {
    writeOutput(previous);
    console.log(`Retaining verified ${previous.date} edition.`);
  } else {
    writeOutput(fallback);
    console.log("Retaining the reviewed repository edition.");
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
