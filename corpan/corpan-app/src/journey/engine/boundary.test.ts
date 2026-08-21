// engine.md §8.1 — boundary/purity meta-tests. Statically scans engine/**
// sources: pure TS only, no wall clock outside clock.ts, no unseeded
// randomness, no TS enums, ts-fsrs only in scheduler.ts, contract imports
// restricted to the frozen activityContract helpers, storage imports
// type-only.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "__golden__") continue
      out.push(...sourceFiles(p))
    } else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts")
    ) {
      out.push(p)
    }
  }
  return out
}

const files = sourceFiles(here).filter((f) => !f.includes("__fixtures__"))
const read = (f: string): string => fs.readFileSync(f, "utf8")
const rel = (f: string): string => path.relative(here, f)

test("engine sources exist", () => {
  assert.ok(files.length >= 20, `expected the full module set, got ${files.length}`)
})

test("no DOM / storage / Tauri / React references anywhere in engine/**", () => {
  // global-ACCESS pattern: `window.x`, `indexedDB.open(...)`, … — property
  // positions (`flow.window`, `win.length`) don't count.
  const banned = /(^|[^.\w])(window|document|localStorage|indexedDB|navigator)\s*[.([]|@tauri|from "react"|from 'react'/
  for (const f of files) {
    assert.ok(!banned.test(read(f)), `${rel(f)} references a banned impure global`)
  }
})

test("no wall clock outside clock.ts", () => {
  const banned = /Date\.now\(|new Date\(/
  for (const f of files) {
    if (path.basename(f) === "clock.ts") continue
    assert.ok(!banned.test(read(f)), `${rel(f)} touches the wall clock / Date constructor`)
  }
})

test("no Math.random anywhere", () => {
  for (const f of files) {
    assert.ok(!read(f).includes("Math.random"), `${rel(f)} uses unseeded randomness`)
  }
})

test("no TS enum declarations (strip-types compatibility)", () => {
  const banned = /(^|\s)(const\s+)?enum\s+\w/m
  for (const f of files) {
    assert.ok(!banned.test(read(f)), `${rel(f)} declares an enum`)
  }
})

test("only scheduler.ts imports ts-fsrs", () => {
  for (const f of files) {
    if (path.basename(f) === "scheduler.ts") continue
    assert.ok(!/from "ts-fsrs"/.test(read(f)), `${rel(f)} imports ts-fsrs`)
  }
})

test("contentPacks imports: only activityContract, values limited to the frozen helpers", () => {
  for (const f of files) {
    const src = read(f)
    const imports = [...src.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+"([^"]*contentPacks[^"]*)"/gms)]
    for (const m of imports) {
      const isTypeOnly = m[1] !== undefined
      const names = m[2]
      const spec = m[3]
      assert.ok(
        spec.endsWith("contentPacks/activityContract.ts"),
        `${rel(f)} imports from a contentPacks module other than activityContract: ${spec}`,
      )
      if (!isTypeOnly) {
        // value imports may only be the two frozen runtime helpers (R2)
        const valueNames = names
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith("type "))
        for (const n of valueNames) {
          assert.ok(
            n === "itemRefKey" || n === "parseItemRef",
            `${rel(f)} value-imports ${n} from the contract (only itemRefKey/parseItemRef allowed)`,
          )
        }
      }
    }
  }
})

test("@/lib/storage imports are type-only", () => {
  for (const f of files) {
    const src = read(f)
    const imports = [...src.matchAll(/^import\s+(type\s+)?\{[^}]*\}\s+from\s+"(@\/lib\/storage[^"]*)"/gms)]
    for (const m of imports) {
      assert.ok(m[1] !== undefined, `${rel(f)} runtime-imports from ${m[2]} (must be import type)`)
    }
  }
})
