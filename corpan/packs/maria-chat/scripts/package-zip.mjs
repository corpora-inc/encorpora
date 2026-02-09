import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.resolve(__dirname, "..")
const zipPath = path.join(packRoot, "maria-chat.zip")

const run = (cmd, args, cwd) => {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit" })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${cmd} ${args.join(" ")} failed with code ${code ?? 1}`))
    })
  })
}

const main = async () => {
  await run("zip", ["-r", "-FS", zipPath, "manifest.json", "dist", "model", "meta", "README.md"], packRoot)
  console.log(`[maria-chat] Packed: ${zipPath}`)
}

main().catch((err) => {
  console.error("[maria-chat] package failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
