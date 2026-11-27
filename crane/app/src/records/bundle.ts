/**
 * An exported run: one zip holding `run.json` (harvest-run/1) and every photo
 * it references at `photos/<id>.jpg`, each photo's `sha256` computed over the
 * exact bytes in the zip.
 */
import { zipSync } from "fflate";
import type { Procedure } from "../engine/types.ts";
import type { Run } from "../store/runs.ts";
import { exportName, photoPath, runReport } from "./report.ts";

/** A photo the run references is no longer in this device's storage. */
export class MissingPhotoError extends Error {
  readonly photoId: string;
  constructor(photoId: string) {
    super(`Photo ${photoId} is missing from this device`);
    this.name = "MissingPhotoError";
    this.photoId = photoId;
  }
}

export interface Bundle {
  name: string;
  bytes: Uint8Array;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build the bundle. `loadPhoto` returns a photo's bytes, or null when it is
 * gone from storage, which fails the export rather than shipping a report
 * that names a missing file.
 */
export async function runBundle(
  run: Run,
  proc: Procedure,
  pack: { pack_id: string; version: string },
  loadPhoto: (id: string) => Promise<Blob | null>,
): Promise<Bundle> {
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  const hashes = new Map<string, string>();
  for (const id of new Set(run.steps.flatMap((s) => s.photoIds))) {
    const blob = await loadPhoto(id);
    if (!blob) throw new MissingPhotoError(id);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    hashes.set(id, await sha256Hex(bytes));
    // JPEG is already compressed: store it.
    files[photoPath(id)] = [bytes, { level: 0 }];
  }
  const report = runReport(run, proc, pack, hashes);
  files["run.json"] = [new TextEncoder().encode(`${JSON.stringify(report, null, 2)}\n`), { level: 6 }];
  return { name: exportName(run), bytes: zipSync(files) };
}
