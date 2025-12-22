import { copyFile, cp, mkdir, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const repoRoot = path.resolve(packRoot, "..", "..")

const iosDir = path.join(
  repoRoot,
  "corpan-app",
  "src-tauri",
  "ios",
  "assets",
  "corpan-packs",
  "endless_learner"
)
const androidDir = path.join(
  repoRoot,
  "corpan-app",
  "src-tauri",
  "android",
  "asset-packs",
  "endless_learner",
  "src",
  "main",
  "assets"
)

const files = ["manifest.json"]
const distFiles = ["app.js", "app.css"]
const distDirs = ["assets"]

const copyDirIfExists = async (srcDir, destDir) => {
  try {
    const info = await stat(srcDir)
    if (!info.isDirectory()) {
      return
    }
  } catch {
    return
  }
  await cp(srcDir, destDir, { recursive: true })
}

const copyTo = async (targetDir) => {
  const distTarget = path.join(targetDir, "dist")
  await mkdir(distTarget, { recursive: true })
  await Promise.all(
    files.map(async (file) => {
      const src = path.join(packRoot, file)
      const dest = path.join(targetDir, file)
      await copyFile(src, dest)
    })
  )
  await Promise.all(
    distFiles.map(async (file) => {
      const src = path.join(packRoot, "dist", file)
      const dest = path.join(distTarget, file)
      await copyFile(src, dest)
    })
  )
  await Promise.all(
    distDirs.map(async (dir) => {
      const src = path.join(packRoot, "dist", dir)
      const dest = path.join(distTarget, dir)
      await copyDirIfExists(src, dest)
    })
  )
}

const run = async () => {
  await copyTo(iosDir)
  await copyTo(androidDir)
}

run().catch((err) => {
  console.error("Failed to sync asset packs:", err)
  process.exit(1)
})
