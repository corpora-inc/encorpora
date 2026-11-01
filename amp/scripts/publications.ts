import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { buildPublications, rendererFingerprint } from "./publication-cache";
import { publicationDocuments } from "./publication-documents";
import { publicationRenderer } from "./publication-render";

// Incremental and content-keyed (scripts/publication-cache.ts): a document is
// re-rendered only when its print HTML or the renderer changed, so
// `npm run review:math` can always rebuild what it reviews.
//   --force          re-render everything
//   --seed <dir>     also reuse PDFs from a prior build (repeatable)
//   --no-html        do not keep each document's HTML (release builds); its
//                    hashes are then computed in worker threads
// AMP_PDF_CONCURRENCY: threads and browser pages (default: CPUs, at most 4).
const args = process.argv.slice(2);
const force = args.includes("--force");
const writeHtml = !args.includes("--no-html");
const seeds = args.flatMap((arg, i) =>
  arg === "--seed" && args[i + 1] ? [args[i + 1]!] : [],
);
const concurrency = Math.max(
  1,
  Number(
    process.env.AMP_PDF_CONCURRENCY ?? Math.min(4, availableParallelism()),
  ),
);
const root = fileURLToPath(new URL("../", import.meta.url));
const output = fileURLToPath(
  new URL("../artifacts/publications/", import.meta.url),
);
const documents = publicationDocuments();

/** Hashes every document's HTML across worker threads, in document order. */
async function hashInWorkers(count: number, threads: number) {
  const hashes: string[] = new Array(count);
  const size = Math.ceil(count / threads);
  await Promise.all(
    Array.from({ length: threads }, (_, i) => {
      const start = i * size;
      const end = Math.min(count, start + size);
      if (start >= end) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const worker = new Worker(
          new URL("./publication-hashes.ts", import.meta.url),
          { workerData: { start, end }, execArgv: ["--import", "tsx"] },
        );
        worker.once("message", (m: { start: number; hashes: string[] }) => {
          hashes.splice(m.start, m.hashes.length, ...m.hashes);
          resolve();
        });
        worker.once("error", reject);
        worker.once("exit", (code) => {
          if (code !== 0) reject(new Error(`Hash worker exited with ${code}`));
        });
      });
    }),
  );
  if (hashes.length !== count || hashes.some((h) => !h))
    throw new Error("Hash workers did not cover every document");
  return hashes;
}

const renderer = publicationRenderer();
const started = Date.now();
try {
  const htmlSha256s =
    !writeHtml && !force && concurrency > 1
      ? await hashInWorkers(documents.length, concurrency)
      : undefined;
  const hashedSeconds = Math.round((Date.now() - started) / 1000);
  const { publications, rendered, reused } = await buildPublications({
    documents,
    output,
    seeds,
    force,
    concurrency,
    writeHtml,
    htmlSha256s,
    renderer: await rendererFingerprint(root),
    render: renderer.render,
  });
  console.log(
    `Built ${publications.length} PDFs from ${documents.length / 3} shared lesson sources (${rendered} re-rendered, ${reused} documents reused, concurrency ${concurrency}, hashed in ${hashedSeconds}s, ${Math.round((Date.now() - started) / 1000)}s).`,
  );
} finally {
  await renderer.close();
}
