/** Uploads an encrypted extract to the research bucket. The Job's Google
 * service account (Workload Identity, so no key file) may only create
 * objects there; the precondition refuses to replace one. A failed stream
 * aborts the resumable upload, so no partial object is left. */
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { assertStudyCode } from "./participants.js";

/** `rr3/rr3-20261127T140501Z.zip.age`: the study and the time, nothing else. */
export function extractObjectName(study: string, at: Date): string {
  assertStudyCode(study);
  const stamp = at
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return `${study}/${study}-${stamp}.zip.age`;
}

export function researchBucketFrom(env: NodeJS.ProcessEnv = process.env) {
  const bucket = env.AMP_RESEARCH_BUCKET?.trim();
  if (!bucket) throw new Error("AMP_RESEARCH_BUCKET is not set");
  // Cloud Storage bucket names: no scheme, no path.
  if (!/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket))
    throw new Error("AMP_RESEARCH_BUCKET must be a bare bucket name");
  return bucket;
}

export async function uploadExtract(
  ciphertext: Readable,
  target: { bucket: string; object: string },
  storage: Pick<Storage, "bucket"> = new Storage(),
): Promise<void> {
  const file = storage.bucket(target.bucket).file(target.object);
  await pipeline(
    ciphertext,
    file.createWriteStream({
      resumable: true,
      contentType: "application/octet-stream",
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: "application/octet-stream" },
    }),
  );
}
