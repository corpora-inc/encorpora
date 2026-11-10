/**
 * Document vectors on disk: `index.json` (model revision, dimensions, and
 * each document's id and text hash) beside `vectors.i8` (int8, one row of
 * `dims` per document, unit vectors scaled by 127). Node only.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { embeddingText, type SearchDoc } from "./corpus";
import { indexDir, searchModel } from "./model";

export type VectorIndexFile = {
  model: string;
  dims: number;
  docs: { id: string; hash: string }[];
};

export const textHash = (doc: SearchDoc) =>
  createHash("sha256").update(embeddingText(doc)).digest("hex").slice(0, 16);

export const quantize = (vector: Float32Array) =>
  Int8Array.from(vector, (v) =>
    Math.max(-127, Math.min(127, Math.round(v * 127))),
  );

export async function readVectors(dir = indexDir) {
  const meta = JSON.parse(
    await readFile(`${dir}/index.json`, "utf8"),
  ) as VectorIndexFile;
  if (meta.model !== searchModel.revision || meta.dims !== searchModel.dims)
    throw new Error(
      `Search vectors were built with another model (${meta.model}); run npm run build:search`,
    );
  const bytes = await readFile(`${dir}/vectors.i8`);
  const data = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.length !== meta.docs.length * meta.dims)
    throw new Error("Search vectors are truncated; run npm run build:search");
  return { meta, data };
}

export async function writeVectors(
  rows: { doc: SearchDoc; vector: Int8Array }[],
  dir = indexDir,
) {
  await mkdir(dir, { recursive: true });
  const { dims, revision } = searchModel;
  const data = new Int8Array(rows.length * dims);
  rows.forEach(({ vector }, i) => data.set(vector, i * dims));
  const meta: VectorIndexFile = {
    model: revision,
    dims,
    docs: rows.map(({ doc }) => ({ id: doc.id, hash: textHash(doc) })),
  };
  // Written beside, then moved into place: a reader never sees half a file.
  await writeFile(`${dir}/vectors.i8.tmp`, data);
  await writeFile(`${dir}/index.json.tmp`, JSON.stringify(meta));
  await rename(`${dir}/vectors.i8.tmp`, `${dir}/vectors.i8`);
  await rename(`${dir}/index.json.tmp`, `${dir}/index.json`);
}
