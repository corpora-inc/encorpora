// Shared loader: parse src/data/npcCorpus.ts into a plain JS array model.
// npcCorpus.ts is a static array literal, so we strip the TS import + type
// annotation and eval the literal. No runtime deps.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const corpusPath = path.resolve(__dirname, "../../src/data/npcCorpus.ts")

export async function loadCorpus() {
  let src = await readFile(corpusPath, "utf8")
  src = src.replace(/^import[^\n]*\n/gm, "")
  src = src.replace(/export\s+const\s+npcCorpus\s*:\s*NPCCorpus\s*=/, "return")
  // eslint-disable-next-line no-new-func
  const fn = new Function(src)
  const corpus = fn()
  if (!Array.isArray(corpus)) {
    throw new Error("Failed to parse npcCorpus into an array")
  }
  return corpus
}
