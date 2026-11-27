/** The research export Job's command (docs/research-export.md):
 *
 *   node src/research/export-cli.mjs --study rr3
 *
 * The server build bundles this file to `src/research/export-cli.mjs`
 * (`scripts/build-server.ts`), so the Job runs it on plain node from the
 * `api` image. It runs only as its own Kubernetes Job, never in an API pod.
 *
 * Configuration, all required, checked before the database is opened:
 * `AMP_DATABASE_URL`, `AMP_RESEARCH_ID_KEY` (the study-ID key),
 * `AMP_RESEARCH_RECIPIENTS` (researchers' age public keys) and
 * `AMP_RESEARCH_BUCKET`. `--output <file>` writes the encrypted extract to a
 * file instead of the bucket (development; it is still ciphertext). */
import { createHash } from "node:crypto";
import { createWriteStream, realpathSync } from "node:fs";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import { createDatabasePool } from "../server/database.js";
import { encryptStream, recipientsFrom } from "./encrypt.js";
import { researchExtract, type ExtractManifest } from "./export.js";
import { assertStudyCode } from "./participants.js";
import { studyIdKeyFrom, type StudyIdKey } from "./study-id.js";
import {
  extractObjectName,
  researchBucketFrom,
  uploadExtract,
} from "./upload.js";

export const USAGE =
  "Usage: research-export --study <code> [--output <file.zip.age>]";

export function parseArgs(argv: readonly string[]) {
  let study: string | undefined;
  let output: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = argv[i + 1];
    if (
      (arg === "--study" || arg === "--output") &&
      value &&
      !value.startsWith("--")
    ) {
      if (arg === "--study") study = value;
      else output = value;
      i++;
    } else throw new Error(USAGE);
  }
  if (!study) throw new Error(USAGE);
  return { study: assertStudyCode(study), output };
}

export type ExportResult = {
  manifest: ExtractManifest;
  /** The ciphertext's size and SHA-256, for the operator's record. */
  bytes: number;
  sha256: string;
};

/** Reads, encrypts and hands the ciphertext to `sink`, on one connection. */
export async function runResearchExport(options: {
  pool: Pick<Pool, "connect">;
  study: string;
  key: StudyIdKey;
  recipients: readonly string[];
  sink: (ciphertext: Readable) => Promise<void>;
  batchSize?: number;
  now?: () => Date;
}): Promise<ExportResult> {
  const client = await options.pool.connect();
  let failure: Error | undefined;
  try {
    const extract = researchExtract({
      client,
      study: options.study,
      key: options.key,
      batchSize: options.batchSize,
      now: options.now,
    });
    const hash = createHash("sha256");
    let bytes = 0;
    const tally = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        hash.update(chunk);
        bytes += chunk.length;
        done(null, chunk);
      },
    });
    const ciphertext = await encryptStream(extract.chunks, options.recipients);
    await Promise.all([pipeline(ciphertext, tally), options.sink(tally)]);
    return {
      manifest: await extract.manifest,
      bytes,
      sha256: hash.digest("hex"),
    };
  } catch (error) {
    // A stream torn down mid-read may still have a query in flight: the
    // connection is closed, not returned to the pool.
    failure =
      error instanceof Error ? error : new Error("research export failed");
    throw error;
  } finally {
    client.release(failure);
  }
}

export async function runCli(
  argv = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
) {
  const { study, output } = parseArgs(argv);
  // Fail closed, before any data is read.
  const key = studyIdKeyFrom(env);
  const recipients = recipientsFrom(env);
  const bucket = output ? null : researchBucketFrom(env);
  if (!env.AMP_DATABASE_URL) throw new Error("AMP_DATABASE_URL is required");
  const started = new Date();
  const object = extractObjectName(study, started);
  const pool = createDatabasePool({ connectionString: env.AMP_DATABASE_URL });
  try {
    const result = await runResearchExport({
      pool,
      study,
      key,
      recipients,
      now: () => started,
      sink: (ciphertext) =>
        bucket
          ? uploadExtract(ciphertext, { bucket, object })
          : pipeline(
              ciphertext,
              createWriteStream(output!, { flags: "wx", mode: 0o600 }),
            ),
    });
    // Counts and hashes only: no study IDs, no rows.
    console.log(
      JSON.stringify({
        study,
        destination: bucket ? `gs://${bucket}/${object}` : output,
        recipients: recipients.length,
        participants: result.manifest.participants,
        files: result.manifest.files.map(({ name, rows }) => ({ name, rows })),
        bytes: result.bytes,
        sha256: result.sha256,
        seconds: Math.round((Date.now() - started.getTime()) / 1000),
      }),
    );
    return result;
  } finally {
    await pool.end();
  }
}

const isMain = (() => {
  try {
    return (
      import.meta.url ===
      pathToFileURL(realpathSync(process.argv[1] ?? "")).href
    );
  } catch {
    return false;
  }
})();
/** Never an error's detail when it has a code (PostgreSQL's can quote a
 * row's values); the code says what failed. */
export const safeMessage = (error: unknown) =>
  error instanceof Error && !("code" in error)
    ? error.message
    : `error code ${String((error as { code?: unknown })?.code ?? "unknown")}`;

if (isMain)
  runCli().catch((error: unknown) => {
    console.error("research export failed:", safeMessage(error));
    process.exitCode = 1;
  });
