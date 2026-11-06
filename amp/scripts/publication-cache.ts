/** Incremental publication PDFs, keyed by content.
 *
 * A PDF is a pure function of its print HTML and the renderer: Chromium, the
 * system fonts the page CSS names (Arial, Georgia, sans-serif map to installed
 * Debian fonts), FreeType/HarfBuzz, Node and the print options. Styles and
 * the KaTeX math fonts are embedded in the HTML; the rest is the renderer
 * fingerprint, which includes the installed OS packages. Each document is
 * reused when the SHA-256 of its HTML matches a prior build made by the same
 * renderer, and its PDF bytes still match the recorded hash. Prior builds are the local output directory (development and
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
import { execFileSync } from "node:child_process";

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

/** Installed OS packages and versions (Debian), sorted; empty elsewhere.
 * System fonts, fontconfig, FreeType and HarfBuzz come from apt unpinned. */
export function installedPackages(): string {
  try {
    return execFileSync("dpkg-query", ["-W", "-f=${Package}=${Version}\n"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split("\n")
      .filter(Boolean)
      .sort()
      .join("\n");
  } catch {
    return "";
  }
}

/**
 * The Dockerfile text PDF rendering can depend on: what precedes the first FROM,
 * and `target` with every stage it reaches through FROM, COPY --from or a mount.
 * Other stages (the API, web and render images) can't change a PDF, so editing
 * them keeps the cache. Comments are ignored. A file with no `target` stage is
 * returned whole, so an unexpected shape misses the cache instead of reusing it.
 */
export function renderStages(dockerfile: string, target = "pdf-build") {
  const lines = dockerfile.split("\n").filter((line) => !/^\s*#/.test(line));
  const stages = new Map<string, string>();
  let preamble = "";
  let current: string[] | null = null;
  const close = (name: string | undefined, body: string[]) => {
    if (name) stages.set(name, body.join("\n"));
    else preamble = body.join("\n");
  };
  let name: string | undefined;
  for (const line of lines) {
    const from = /^\s*FROM\s+\S+(?:\s+AS\s+([\w.-]+))?/i.exec(line);
    if (from) {
      close(name, current ?? []);
      name = from[1] ?? `(unnamed ${stages.size})`;
      current = [];
    }
    (current ??= []).push(line);
  }
  close(name, current ?? []);
  if (!stages.has(target)) return dockerfile;
  const included = new Set([target]);
  const scan = [preamble, stages.get(target)!];
  while (scan.length) {
    for (const token of scan.pop()!.split(/[^\w.-]+/))
      if (stages.has(token) && !included.has(token)) {
        included.add(token);
        scan.push(stages.get(token)!);
      }
  }
  return [
    preamble,
    ...[...stages]
      .filter(([stage]) => included.has(stage))
      .map(([, body]) => body),
  ].join("\n");
}

/** Everything besides the HTML that can change a PDF's bytes. */
export async function rendererFingerprint(
  root: string,
  files = [
    "package-lock.json",
    "Dockerfile",
    "scripts/publication-render.ts",
    "browser-security.mjs",
  ],
  packages = installedPackages(),
): Promise<string> {
  const hash = createHash("sha256").update(
    `${process.platform}/${process.arch}/${process.version}\0${packages}\0`,
  );
  for (const file of files) {
    const raw = await readFile(join(root, file)).catch(() => null);
    const bytes =
      raw && file === "Dockerfile"
        ? Buffer.from(renderStages(raw.toString("utf8")))
        : raw;
    hash.update(`${file}\0${bytes?.length ?? -1}\0`);
    if (bytes) hash.update(bytes);
  }
  return hash.digest("hex");
}

type Prior = { entry: PublicationEntry; directory: string };

/** Prior entries made by this renderer, by filename: every candidate, the
 * output directory first, then the seeds in order. Manifests without a
 * renderer and HTML hashes (built before content keys) are never trusted:
 * one full render replaces them. */
export async function priorEntries(
  output: string,
  seeds: readonly string[],
  renderer: string,
): Promise<Map<string, Prior[]>> {
  const prior = new Map<string, Prior[]>();
  for (const directory of [output, ...seeds]) {
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
      if (entry.htmlSha256)
        prior.set(entry.filename, [
          ...(prior.get(entry.filename) ?? []),
          { entry, directory },
        ]);
  }
  return prior;
}

/** The first candidate made from this HTML whose bytes still verify. */
async function verifiedPdf(
  candidates: readonly Prior[] | undefined,
  htmlSha256: string,
): Promise<Prior | null> {
  for (const prior of candidates ?? []) {
    if (prior.entry.htmlSha256 !== htmlSha256) continue;
    const pdf = await readFile(
      join(prior.directory, prior.entry.filename),
    ).catch(() => null);
    if (pdf && sha256(pdf) === prior.entry.sha256) return prior;
  }
  return null;
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
  const concurrency = options.concurrency ?? 1;
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error(`Concurrency must be a positive integer: ${concurrency}`);
  await mkdir(output, { recursive: true });
  const prior = options.force
    ? new Map<string, Prior[]>()
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
        kept.map(async (found, i) => {
          const filename = filenames[i]!;
          const { entry, directory } = found!;
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
