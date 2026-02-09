import { cp, mkdir, rm, link, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const modelDir = path.join(packRoot, "model")
const metaDir = path.join(packRoot, "meta")

const variants = {
  q4_k_m: {
    file: "maria-q4_k_m.gguf",
    name: "Maria Q4_K_M",
    quantType: "Q4_K_M",
  },
  q5_k_m: {
    file: "maria-q5_k_m.gguf",
    name: "Maria Q5_K_M",
    quantType: "Q5_K_M",
  },
  q8_0: {
    file: "maria-q8_0.gguf",
    name: "Maria Q8_0",
    quantType: "Q8_0",
  },
  f16: {
    file: "maria-f16.gguf",
    name: "Maria F16",
    quantType: "F16",
  },
}

const parseArgs = (argv) => {
  const out = {
    source: process.env.MARIA_SOURCE_PACK ?? "",
    mode: "link",
    selected: ["q4_k_m"],
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--source" && argv[i + 1]) {
      out.source = argv[i + 1]
      i += 1
      continue
    }
    if (arg === "--copy") {
      out.mode = "copy"
      continue
    }
    if (arg === "--variants" && argv[i + 1]) {
      out.selected = argv[i + 1]
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
      i += 1
      continue
    }
  }

  return out
}

const copyOrLink = async (from, to, mode) => {
  await rm(to, { force: true })
  if (mode === "copy") {
    await cp(from, to)
    return "copied"
  }

  try {
    const srcStats = await stat(from)
    const destParentStats = await stat(path.dirname(to))
    if (srcStats.dev === destParentStats.dev) {
      await link(from, to)
      return "linked"
    }
  } catch {
    // fallback to copy
  }

  await cp(from, to)
  return "copied"
}

const loadManifest = async () => {
  const manifestPath = path.join(packRoot, "manifest.json")
  const raw = await readFile(manifestPath, "utf8")
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") {
    throw new Error("manifest.json is invalid")
  }
  return { manifestPath, parsed }
}

const saveManifest = async (manifestPath, parsed) => {
  const serialized = `${JSON.stringify(parsed, null, 2)}\n`
  await writeFile(manifestPath, serialized, "utf8")
}

const run = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (!options.source) {
    throw new Error(
      "Missing --source. Example: npm run import:assets -- --source ~/corpan-model-packs/maria-qwen25-1p5b-v1"
    )
  }

  const sourceRoot = path.resolve(options.source.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"))
  const sourceModelDir = path.join(sourceRoot, "model")

  await mkdir(modelDir, { recursive: true })
  await mkdir(metaDir, { recursive: true })

  const selectedVariants = Array.from(
    new Set(
      options.selected.map((item) => item.trim().toLowerCase()).filter(Boolean)
    )
  )
  if (!selectedVariants.length) {
    throw new Error("No variants selected. Pass --variants q4_k_m (for example).")
  }

  const selectedSet = new Set(selectedVariants)
  for (const [variantId, spec] of Object.entries(variants)) {
    if (selectedSet.has(variantId)) {
      continue
    }
    await rm(path.join(modelDir, spec.file), { force: true })
  }

  const models = []
  for (const [index, selected] of selectedVariants.entries()) {
    const spec = variants[selected]
    if (!spec) {
      throw new Error(
        `Unknown variant '${selected}'. Available variants: ${Object.keys(variants).join(", ")}`
      )
    }
    const filename = spec.file
    const sourcePath = path.join(sourceModelDir, filename)
    const targetPath = path.join(modelDir, filename)
    const mode = await copyOrLink(sourcePath, targetPath, options.mode)
    const sizeBytes = (await stat(targetPath)).size
    const preferred = selected === "q4_k_m" || (!selectedSet.has("q4_k_m") && index === 0)
    models.push({
      id: selected,
      name: spec.name,
      path: `model/${filename}`,
      sizeBytes,
      recommended: preferred,
      quantType: spec.quantType,
    })
    console.log(`[maria-chat] ${mode}: ${path.relative(packRoot, targetPath)}`)
  }

  const metadataFiles = [
    "chat_template.jinja",
    "character.yaml",
    "generation_config.json",
    "tokenizer_config.json",
    "manifest.json",
  ]

  for (const filename of metadataFiles) {
    const sourcePath = path.join(sourceRoot, filename)
    const targetName = filename === "manifest.json" ? "source-manifest.json" : filename
    const targetPath = path.join(metaDir, targetName)
    const mode = await copyOrLink(sourcePath, targetPath, "copy")
    console.log(`[maria-chat] ${mode}: ${path.relative(packRoot, targetPath)}`)
  }

  const { manifestPath, parsed: manifest } = await loadManifest()
  if (!manifest.llm || typeof manifest.llm !== "object") {
    manifest.llm = {}
  }
  const defaultModel = selectedSet.has("q4_k_m") ? "q4_k_m" : selectedVariants[0]
  manifest.llm.defaultModel = defaultModel
  manifest.llm.models = models
  manifest.devRevision = new Date().toISOString()
  await saveManifest(manifestPath, manifest)
  console.log(`[maria-chat] updated: ${path.relative(packRoot, manifestPath)}`)

  console.log("[maria-chat] Model assets imported.")
}

run().catch((err) => {
  console.error("[maria-chat] import failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
