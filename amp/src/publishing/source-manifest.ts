import { createHash } from "node:crypto";
import { readFile, readdir, lstat } from "node:fs/promises";
import { join, posix } from "node:path";
/** CLI-only provenance collector; the caller resolves a registered book first. */
export async function publicationSourceHashes(
  packageRoot: string,
  bookId: string,
): Promise<Record<string, string>> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(bookId))
    throw new Error("Invalid registered book identifier");
  async function collect(relative: string): Promise<string[]> {
    if ((await lstat(join(packageRoot, relative))).isSymbolicLink())
      throw new Error(`Publication source cannot be a symlink: ${relative}`);
    const entries = await readdir(join(packageRoot, relative), {
      withFileTypes: true,
    });
    const paths: string[] = [];
    for (const entry of entries) {
      const child = posix.join(relative, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Publication source cannot be a symlink: ${child}`);
      if (entry.isDirectory()) paths.push(...(await collect(child)));
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) paths.push(child);
    }
    return paths;
  }
  const paths = [
    ...(await collect(`books/${bookId}`)),
    ...(await collect("src/publishing")),
    "src/books/catalog.ts",
    "scripts/publish-book.ts",
  ].sort();
  if (!paths.includes(`books/${bookId}/book.ts`))
    throw new Error("Registered book source is missing");
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [
        path,
        createHash("sha256")
          .update(await readFile(join(packageRoot, path)))
          .digest("hex"),
      ]),
    ),
  );
}
