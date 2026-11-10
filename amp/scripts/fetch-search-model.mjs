/**
 * Fetches the pinned search model (src/search/model.json) into
 * `models/search/all-minilm-l6-v2`, verifying each file's SHA-256. Run by
 * its own Docker stage, so the download is cached until a pin changes, and
 * by `npm run build:search` on a developer machine. A file already present
 * with the right hash is kept. The API never calls this.
 *
 *   node scripts/fetch-search-model.mjs [target directory]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const pins = JSON.parse(
  await readFile(new URL("../src/search/model.json", import.meta.url), "utf8"),
);
const target =
  process.argv[2] ??
  fileURLToPath(new URL("../models/search/all-minilm-l6-v2", import.meta.url));
await mkdir(target, { recursive: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const [name, { path, sha256: expected }] of Object.entries(pins.files)) {
  const file = `${target}/${name}`;
  const present = await readFile(file).catch(() => null);
  if (present && sha256(present) === expected) continue;
  const url = `https://huggingface.co/${pins.id}/resolve/${pins.revision}/${path}`;
  let bytes;
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
      break;
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  const actual = sha256(bytes);
  if (actual !== expected)
    throw new Error(`${name}: SHA-256 ${actual}, expected ${expected}`);
  await writeFile(`${file}.download`, bytes);
  await rename(`${file}.download`, file);
  console.log(`Fetched ${name} (${bytes.length} bytes, verified)`);
}
console.log(
  `Search model ${pins.id}@${pins.revision.slice(0, 7)} in ${target}`,
);
