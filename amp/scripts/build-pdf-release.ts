/** Build-only publisher. Cache contents are checked; only delivery files enter the API image. */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { books } from "../src/books/catalog";
import { loadBookPdf } from "../src/books/publication";
import { verifyPublications, verifyPdfRelease } from "./pdf-release";
const root = fileURLToPath(new URL("../", import.meta.url));
if (process.argv.length !== 3)
  throw new Error("Pass one empty PDF release output directory");
const output = resolve(process.argv[2]!);
await mkdir(output, { recursive: true });
if ((await readdir(output)).length)
  throw new Error("PDF release output directory must be empty");
const started = Date.now();
async function files(path: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(join(root, path), { withFileTypes: true })).map(
        async (entry) => {
          const name = `${path}/${entry.name}`;
          if (entry.isSymbolicLink())
            throw new Error(`Publication input cannot be a symlink: ${name}`);
          return entry.isDirectory() ? files(name) : [name];
        },
      ),
    )
  ).flat();
}
// Conservative cache boundary includes shared scene/rendering code and the toolchain.
const inputs = [
  ...(await files("src")),
  ...(await files("books")),
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "Dockerfile",
  "scripts/publications.ts",
  "scripts/publish-book.ts",
  "scripts/build-pdf-release.ts",
  "scripts/pdf-release.ts",
].sort();
const fingerprint = createHash("sha256").update(
  `${process.platform}/${process.arch}/${process.version}`,
);
for (const path of inputs) {
  const bytes = await readFile(join(root, path));
  fingerprint.update(`${path}\0${bytes.length}\0`).update(bytes);
}
const sourceHash = fingerprint.digest("hex");
const cache = join(root, "artifacts");
await mkdir(cache, { recursive: true });
const prior = await readFile(
  join(cache, "pdf-build-fingerprint.txt"),
  "utf8",
).catch(() => "");
const unchanged = prior === sourceHash;
function run(script: string, args: string[] = []) {
  const child = spawnSync(
    process.execPath,
    ["--import", "tsx", join(root, script), ...args],
    { cwd: root, stdio: "inherit" },
  );
  if (child.error) throw child.error;
  if (child.status !== 0)
    throw new Error(`${script} failed (${child.status ?? child.signal})`);
}
run("scripts/publications.ts", unchanged ? [] : ["--force"]);
let rebuiltBooks = 0;
for (const { content: book } of books) {
  let current = false;
  if (unchanged)
    current = await loadBookPdf(join(cache, "books"), book).then(
      () => true,
      () => false,
    );
  if (!current) {
    run("scripts/publish-book.ts", [
      "--book",
      book.id,
      "--output",
      join(cache, "books", book.id),
    ]);
    rebuiltBooks++;
  }
}
const { publications } = await verifyPublications(join(cache, "publications"));
await mkdir(join(output, "publications"), { recursive: true });
for (const name of ["manifest.json", ...publications.map((p) => p.filename)])
  await copyFile(
    join(cache, "publications", name),
    join(output, "publications", name),
  );
for (const { content: book } of books) {
  await mkdir(join(output, "books", book.id), { recursive: true });
  for (const name of [`${book.id}.pdf`, "validation.json"])
    await copyFile(
      join(cache, "books", book.id, name),
      join(output, "books", book.id, name),
    );
}
const report = await verifyPdfRelease(output);
await writeFile(join(cache, "pdf-build-fingerprint.txt"), sourceHash);
console.log(
  JSON.stringify({
    ...report,
    unchangedRendererInputs: unchanged,
    rebuiltBooks,
    seconds: Math.round((Date.now() - started) / 1000),
    sourceHash,
  }),
);
