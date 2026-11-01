/** Incremental publication PDFs, keyed by content.
 *
 * A PDF is a pure function of its print HTML and the renderer (Chromium,
 * system fonts, Node, the print options). Fonts and styles are embedded in the
 * HTML, so each document is reused when the SHA-256 of its HTML matches a
 * prior build made by the same renderer, and its PDF bytes still match the
 * recorded hash. Prior builds are the local output directory (development and
 * the Docker cache mount) and any seed directories (CI: the previous release
 * image's publications), so a content change re-renders only the documents it
 * changes. A renderer change re-renders everything. */
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

export type PublicationEntry = {
  lessonId: string;
  kind: string;
  format: string;
  filename: string;
  sha256: string;
  bytes: number;
  /** SHA-256 of the print HTML the PDF was rendered from. */
  htmlSha256?: string;
};
export type PublicationDocument = {
  lessonId: string;
  kind: string;
  /** The print HTML, built on demand: thousands of documents with embedded
   * fonts do not fit in memory at once. */
  html: () => string;
  formats: readonly string[];
};
/** Renders one document in each format, in order (one page load). */
export type RenderPdfs = (
  html: string,
  formats: readonly string[],
) => Promise<Buffer[]>;

const sha256 = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");

/** Everything besides the HTML that can change a PDF's bytes. */
export async function rendererFingerprint(
  root: string,
  files = ["package-lock.json", "Dockerfile", "scripts/publication-render.ts"],
): Promise<string> {
  const hash = createHash("sha256").update(
    `${process.platform}/${process.arch}/${process.version}\0`,
  );
  for (const file of files) {
    const bytes = await readFile(join(root, file)).catch(() => null);
    hash.update(`${file}\0${bytes?.length ?? -1}\0`);
    if (bytes) hash.update(bytes);
  }
  return hash.digest("hex");
}

type Prior = { entry: PublicationEntry; directory: string };

/** Prior entries made by this renderer, by filename. The output directory
 * wins over seeds. Manifests without a renderer and HTML hashes (built before
 * content keys) are never trusted: one full render replaces them. */
async function priorEntries(
  output: string,
  seeds: readonly string[],
  renderer: string,
): Promise<Map<string, Prior>> {
  const prior = new Map<string, Prior>();
  for (const directory of [...seeds].reverse().concat(output)) {
    const raw = await readFile(join(directory, "manifest.json"), "utf8").catch(
      () => null,
    );
    if (!raw) continue;
    let manifest: { renderer?: string; publications?: PublicationEntry[] };
    try {
      manifest = JSON.parse(raw);
    } catch {
      continue;
    }
    if (manifest.renderer !== renderer) continue;
    for (const entry of manifest.publications ?? [])
      if (entry.htmlSha256) prior.set(entry.filename, { entry, directory });
  }
  return prior;
}

async function verifiedPdf(prior: Prior | undefined, htmlSha256: string) {
  if (!prior || prior.entry.htmlSha256 !== htmlSha256) return null;
  const pdf = await readFile(join(prior.directory, prior.entry.filename)).catch(
    () => null,
  );
  return pdf && sha256(pdf) === prior.entry.sha256 ? pdf : null;
}

export async function buildPublications(options: {
  documents: readonly PublicationDocument[];
  output: string;
  seeds?: readonly string[];
  renderer: string;
  render: RenderPdfs;
  force?: boolean;
  concurrency?: number;
  /** Keep each document's HTML beside its PDFs (`npm run review:math`).
   * Release builds skip it: gigabytes nobody reads. Default true. */
  writeHtml?: boolean;
  /** Precomputed SHA-256 of each document's HTML, in document order (the
   * publisher hashes in worker threads); otherwise computed here. */
  htmlSha256s?: readonly string[];
}): Promise<{
  publications: PublicationEntry[];
  rendered: number;
  reused: number;
}> {
  const { documents, output, renderer, render } = options;
  const writeHtml = options.writeHtml ?? true;
  if (options.htmlSha256s && options.htmlSha256s.length !== documents.length)
    throw new Error("One HTML hash per document is required");
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  await mkdir(output, { recursive: true });
  const prior = options.force
    ? new Map<string, Prior>()
    : await priorEntries(output, options.seeds ?? [], renderer);
  const results: PublicationEntry[][] = new Array(documents.length);
  const expected = new Set(["manifest.json"]);
  const pending: number[] = [];
  let reused = 0;
  for (const [index, doc] of documents.entries()) {
    const htmlName = `${doc.lessonId}-${doc.kind}.html`;
    const filenames = doc.formats.map(
      (f) => `${doc.lessonId}-${doc.kind}-${f}.pdf`,
    );
    if (writeHtml) expected.add(htmlName);
    for (const name of filenames) expected.add(name);
    // Nothing to reuse (forced, or a new renderer): build the HTML only once,
    // when rendering.
    if (!prior.size && !writeHtml) {
      pending.push(index);
      continue;
    }
    const html = writeHtml || !options.htmlSha256s ? doc.html() : undefined;
    const htmlSha256 = options.htmlSha256s?.[index] ?? sha256(html!);
    const kept = await Promise.all(
      filenames.map((name) => verifiedPdf(prior.get(name), htmlSha256)),
    );
    if (writeHtml) await writeFile(join(output, htmlName), html!);
    if (kept.every(Boolean)) {
      results[index] = await Promise.all(
        filenames.map(async (filename) => {
          const { entry, directory } = prior.get(filename)!;
          if (directory !== output)
            await copyFile(join(directory, filename), join(output, filename));
          return { ...entry, htmlSha256 };
        }),
      );
      reused++;
      continue;
    }
    pending.push(index);
  }
  let rendered = 0;
  let next = 0;
  // Each worker renders whole documents (both paper sizes) in turn.
  const worker = async () => {
    while (next < pending.length) {
      const index = pending[next++]!;
      const doc = documents[index]!;
      const html = doc.html();
      const htmlSha256 = sha256(html);
      if (options.htmlSha256s && options.htmlSha256s[index] !== htmlSha256)
        throw new Error(
          `Print HTML is not deterministic: ${doc.lessonId}-${doc.kind}`,
        );
      const entries: PublicationEntry[] = [];
      const pdfs = await render(html, doc.formats);
      if (pdfs.length !== doc.formats.length)
        throw new Error(
          `Renderer returned ${pdfs.length} PDFs for ${doc.formats.length} formats`,
        );
      for (const [i, format] of doc.formats.entries()) {
        const filename = `${doc.lessonId}-${doc.kind}-${format}.pdf`;
        const pdf = pdfs[i]!;
        await writeFile(join(output, filename), pdf);
        entries.push({
          lessonId: doc.lessonId,
          kind: doc.kind,
          format,
          filename,
          sha256: sha256(pdf),
          bytes: pdf.length,
          htmlSha256,
        });
        rendered++;
      }
      results[index] = entries;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, worker),
  );
  // Documents of removed or renamed lessons must not linger to be reviewed.
  for (const name of await readdir(output))
    if (!expected.has(name)) await rm(join(output, name), { force: true });
  const publications = results.flat();
  await writeFile(
    join(output, "manifest.json"),
    JSON.stringify({ edition: "1", renderer, publications }, null, 2),
  );
  return { publications, rendered, reused };
}
