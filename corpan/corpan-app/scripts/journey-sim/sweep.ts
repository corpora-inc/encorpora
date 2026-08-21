// journey-sim sweep driver (engine.md §7.4 "Tuning sweeps ... reuse the same
// runner with a config matrix"). Patches engine/constants.ts IN PLACE per
// config (single-line `export const NAME = ...` statements only), runs cli.ts
// as a subprocess, parses the gate report, restores the file. Dev-only tool —
// fs/process usage allowed here, never bundled.
//
//   node --experimental-strip-types scripts/journey-sim/sweep.ts \
//     --matrix scripts/journey-sim/sweeps/example.json \
//     [--learners 12] [--days 180] [--seeds 1] [--personas a,b] [--out DIR]
//
// Matrix file: { "name": {"CONST_A": 0.85, "CONST_B": 8}, ... }
// Values are substituted verbatim (numbers or JS literals as strings).

import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const CONSTANTS = path.resolve(here, "../../src/journey/engine/constants.ts")
const CLI = path.resolve(here, "cli.ts")

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}

export type Overrides = Record<string, number | string>

export function patchConstants(source: string, overrides: Overrides): string {
  let out = source
  for (const [name, value] of Object.entries(overrides)) {
    const re = new RegExp(`(export const ${name} = )[^\\n]*?( as const)?(\\s*//[^\\n]*)?\\n`)
    if (!re.test(out)) throw new Error(`constant not found (or not single-line): ${name}`)
    out = out.replace(re, (_m, pre: string, asConst?: string, comment?: string) => {
      return `${pre}${value}${asConst ?? ""}${comment ?? ""}\n`
    })
  }
  return out
}

interface GateLine {
  id: string
  badge: string
  detail: string
}

function parseGates(stdout: string): GateLine[] {
  const gates: GateLine[] = []
  const lines = stdout.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\[(PASS|FAIL|DEFER)\s*\] (P\d+) /)
    if (m) gates.push({ id: m[2], badge: m[1], detail: (lines[i + 1] ?? "").trim() })
  }
  return gates
}

async function main(): Promise<void> {
  const matrixPath = arg("matrix", "")
  if (!matrixPath) {
    console.error("--matrix <file.json> required")
    process.exit(2)
  }
  const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8")) as Record<string, Overrides>
  const learners = arg("learners", "12")
  const days = arg("days", "180")
  const seeds = arg("seeds", "1").split(",")
  const personas = arg("personas", "")
  const outDir = arg("out", path.join(here, "out", "sweep"))
  fs.mkdirSync(outDir, { recursive: true })

  const original = fs.readFileSync(CONSTANTS, "utf8")
  const rows: string[] = []
  try {
    for (const [name, overrides] of Object.entries(matrix)) {
      fs.writeFileSync(CONSTANTS, patchConstants(original, overrides))
      for (const seed of seeds) {
        const runOut = path.join(outDir, `${name}-s${seed}`)
        const args = [
          "--experimental-strip-types",
          CLI,
          "--learners",
          learners,
          "--days",
          days,
          "--seed",
          seed,
          "--out",
          runOut,
        ]
        if (personas) args.push("--personas", personas)
        const t0 = Date.now()
        const res = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
        const gates = parseGates(res.stdout ?? "")
        const badge = (id: string): string => gates.find((g) => g.id === id)?.badge ?? "?"
        const fails = gates.filter((g) => g.badge === "FAIL").map((g) => g.id)
        const row =
          `${name} seed=${seed} [${((Date.now() - t0) / 1000).toFixed(0)}s] ` +
          `P1:${badge("P1")} P3:${badge("P3")} P4:${badge("P4")} P7:${badge("P7")} ` +
          `| fails: ${fails.length > 0 ? fails.join(",") : "none"}`
        rows.push(row)
        console.log(row)
        for (const g of gates) {
          if (g.badge === "FAIL" || ["P1", "P3", "P4", "P7"].includes(g.id)) {
            console.log(`    ${g.id} ${g.badge}: ${g.detail}`)
          }
        }
        fs.writeFileSync(path.join(outDir, "summary.txt"), rows.join("\n") + "\n")
      }
    }
  } finally {
    fs.writeFileSync(CONSTANTS, original)
  }
  console.log(`\nsummary → ${path.join(outDir, "summary.txt")}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
