import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { templates } from "../src/math/engine.js";
import { lessons } from "../src/content/lessons.js";
import {
  buildAgentProductionQueue,
  buildCoverageManifest,
  publicationArtifactId,
  type ArtifactEvidence,
  type FacetMapping,
  type PublicationRecord,
} from "../src/content/coverage.js";

const ampRoot = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? sourceFiles(path)
        : entry.isFile() && /\.tsx?$/.test(entry.name)
          ? [path]
          : [];
    }),
  );
  return nested.flat().sort();
}
async function main() {
  let stdout = false;
  let output = join(ampRoot, "artifacts/production");
  let evidenceFile: string | undefined;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--stdout") stdout = true;
    else if (arg === "--output" || arg === "--evidence") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error(`Missing value for ${arg}`);
      if (arg === "--output") output = resolve(value);
      else evidenceFile = resolve(value);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  const mathFiles = await sourceFiles(join(ampRoot, "src/math"));
  // Bind template evidence to all math implementation sources, including extension registries.
  const mathSource = await Promise.all(
    mathFiles.map(async (path) => [
      path.slice(ampRoot.length),
      await readFile(path, "utf8"),
    ]),
  );
  const mathDigest = hash(JSON.stringify(mathSource));
  const artifactDigests: Record<string, string> = {};
  for (const template of templates)
    artifactDigests[`template.${template.id}`] = hash(
      JSON.stringify({ mathDigest, template }),
    );
  for (const lesson of lessons)
    artifactDigests[`lesson.${lesson.id}`] = hash(JSON.stringify(lesson));
  const manifestPath = join(ampRoot, "artifacts/publications/manifest.json");
  let publications: PublicationRecord[] = [];
  let publicationManifest: string | undefined;
  try {
    publicationManifest = await readFile(manifestPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (publicationManifest !== undefined) {
    const manifest = JSON.parse(publicationManifest) as {
      publications: PublicationRecord[];
    };
    if (!Array.isArray(manifest.publications))
      throw new Error("Publication manifest must contain publications.");
    publications = manifest.publications;
    for (const publication of publications) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf$/.test(publication.filename))
        throw new Error("Unsafe publication filename.");
      const bytes = await readFile(
        join(dirname(manifestPath), publication.filename),
      );
      const digest = hash(bytes);
      if (digest !== publication.sha256 || bytes.length !== publication.bytes)
        throw new Error(
          `Publication bytes do not match manifest: ${publication.filename}`,
        );
      artifactDigests[publicationArtifactId(publication)] = digest;
    }
  }
  const supplied = evidenceFile
    ? (JSON.parse(await readFile(evidenceFile, "utf8")) as {
        evidence?: ArtifactEvidence[];
        facetMappings?: FacetMapping[];
      })
    : {};
  if (
    (supplied.evidence !== undefined && !Array.isArray(supplied.evidence)) ||
    (supplied.facetMappings !== undefined &&
      !Array.isArray(supplied.facetMappings))
  )
    throw new Error("Evidence and facetMappings must be arrays.");
  const coverage = buildCoverageManifest({
    publications,
    artifactDigests,
    evidence: supplied.evidence ?? [],
    facetMappings: supplied.facetMappings ?? [],
  });
  const queue = buildAgentProductionQueue();
  const summary = {
    ...coverage.summary,
    valid: coverage.valid,
    errors: coverage.errors,
    productionTasks: queue.length,
    executionEnabled: false,
    automaticSpendingEnabled: false,
  };
  if (stdout)
    process.stdout.write(
      `${JSON.stringify({ summary, coverage, queue }, null, 2)}\n`,
    );
  else {
    await mkdir(output, { recursive: true });
    await Promise.all(
      Object.entries({ summary, coverage, queue }).map(([name, value]) =>
        writeFile(
          join(output, `${name}.json`),
          `${JSON.stringify(value, null, 2)}\n`,
        ),
      ),
    );
    process.stdout.write(`Wrote coverage, queue and summary to ${output}.\n`);
  }
  if (!coverage.valid) process.exitCode = 1;
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
