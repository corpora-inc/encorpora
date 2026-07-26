import { test } from "node:test"
import assert from "node:assert/strict"

import {
  MAX_INSTALLED_BYTES,
  isSafeRelativePath,
  localizedDescription,
  localizedName,
  parseManifest,
} from "./manifest.ts"
import type { PackManifest } from "./manifest.ts"

/** A manifest that is valid, so a test can make exactly one thing wrong. */
const valid = () => ({
  schema: 1,
  id: "abacus.tower",
  version: "1.2.0",
  name: "Abacus Tower",
  description: "Carry beads up the tower.",
  sdk: "1.0.0",
  host: { min: "0.1.0", max: "1.0.0" },
  entry: "index.html",
  capabilities: ["items", "haptics"],
  covers: { skills: ["add.2digit.regroup"], grades: [1, 3] },
  locales: ["en", "es"],
  assets: { files: 42, bytes: 3_000_000 },
  download: { url: "https://packs.example/abacus-tower-1.2.0.zip", bytes: 900_000, sha256: "a".repeat(64) },
})

const problemsFor = (mutate: (draft: Record<string, unknown>) => void): readonly string[] => {
  const draft = valid() as unknown as Record<string, unknown>
  mutate(draft)
  const result = parseManifest(draft)
  assert.equal(result.ok, false, "expected this manifest to be rejected")
  return result.ok ? [] : result.problems
}

test("a well-formed manifest parses", () => {
  const result = parseManifest(valid())
  assert.equal(result.ok, true, result.ok ? "" : result.problems.join("; "))
})

test("every problem is reported, not just the first", () => {
  const problems = problemsFor((draft) => {
    draft["version"] = "1.2"
    draft["entry"] = "app.js"
    draft["capabilities"] = ["items", "root"]
  })
  assert.ok(problems.length >= 3, `expected three problems, got ${problems.join("; ")}`)
})

test("the entry must be a document, because a pack is framed and never evaluated", () => {
  const problems = problemsFor((draft) => {
    draft["entry"] = "dist/app.js"
  })
  assert.ok(problems.some((p) => p.includes("framed")))
})

test("an entry path cannot climb out of the pack", () => {
  for (const entry of ["../secrets.html", "/etc/passwd", "a/../../b.html", "C:\\x.html", "x\\y.html"]) {
    assert.equal(isSafeRelativePath(entry), false, `${entry} was accepted`)
  }
  assert.equal(isSafeRelativePath("index.html"), true)
  assert.equal(isSafeRelativePath("dist/index.html"), true)
})

test("an unknown capability is refused by name", () => {
  const problems = problemsFor((draft) => {
    draft["capabilities"] = ["items", "filesystem"]
  })
  assert.ok(problems.some((p) => p.includes("filesystem")))
})

test("a duplicated capability is refused, so a grant set cannot be padded", () => {
  const problems = problemsFor((draft) => {
    draft["capabilities"] = ["items", "items"]
  })
  assert.ok(problems.some((p) => p.includes("duplicate")))
})

test("integrity must be sha-256 hex, and sizes must be real", () => {
  assert.ok(
    problemsFor((draft) => {
      draft["download"] = { bytes: 10, sha256: "not-a-hash" }
    }).some((p) => p.includes("sha256")),
  )
  assert.ok(
    problemsFor((draft) => {
      draft["download"] = { bytes: 0, sha256: "b".repeat(64) }
    }).some((p) => p.includes("bytes")),
  )
  assert.ok(
    problemsFor((draft) => {
      draft["assets"] = { files: 1, bytes: MAX_INSTALLED_BYTES + 1 }
    }).some((p) => p.includes("assets.bytes")),
  )
})

test("a download origin is https or the manifest never ships", () => {
  assert.ok(
    problemsFor((draft) => {
      draft["download"] = {
        url: "http://packs.example/x.zip",
        bytes: 10,
        sha256: "c".repeat(64),
      }
    }).some((p) => p.includes("https")),
  )
})

test("a pack with no download url is legal — it shipped with the app", () => {
  const draft = valid() as unknown as Record<string, unknown>
  draft["download"] = { bytes: 900_000, sha256: "d".repeat(64) }
  assert.equal(parseManifest(draft).ok, true)
})

test("ids are the on-disk directory name and are constrained to look like one", () => {
  for (const id of ["Abacus", "../x", "a b", "a/b", "9lives", "", "a".repeat(65)]) {
    const problems = problemsFor((draft) => {
      draft["id"] = id
    })
    assert.ok(problems.some((p) => p.startsWith("id must")), `${id} was accepted`)
  }
  for (const id of ["abacus", "abacus.tower", "abacus-tower", "a1.b2-c3"]) {
    const draft = valid() as unknown as Record<string, unknown>
    draft["id"] = id
    assert.equal(parseManifest(draft).ok, true, `${id} was rejected`)
  }
})

test("a grade band is inclusive, ordered and inside 0–12", () => {
  for (const grades of [[3, 1], [-1, 3], [1, 13], [1], [1, 2, 3], ["1", "3"]]) {
    const problems = problemsFor((draft) => {
      const covers = draft["covers"] as Record<string, unknown>
      draft["covers"] = { ...covers, grades }
    })
    assert.ok(problems.some((p) => p.includes("covers.grades")), `${JSON.stringify(grades)} passed`)
  }
})

test("en is required, because name and description are the fallback", () => {
  assert.ok(
    problemsFor((draft) => {
      draft["locales"] = ["es"]
    }).some((p) => p.includes("en")),
  )
})

test("a schema bump is a wall, not a warning", () => {
  assert.ok(
    problemsFor((draft) => {
      draft["schema"] = 2
    }).some((p) => p.includes("schema")),
  )
})

test("nothing but an object is a manifest", () => {
  for (const input of [null, undefined, 7, "{}", [], true]) {
    assert.equal(parseManifest(input).ok, false)
  }
})

test("localisation falls back by base tag and then to the plain field", () => {
  const manifest = {
    ...valid(),
    nameLocalized: { es: "Torre de ábaco" },
    descriptionLocalized: { es: "Sube las cuentas." },
  } as unknown as PackManifest
  assert.equal(localizedName(manifest, "es"), "Torre de ábaco")
  assert.equal(localizedName(manifest, "es-MX"), "Torre de ábaco", "base tag")
  assert.equal(localizedName(manifest, "fr"), "Abacus Tower", "fallback")
  assert.equal(localizedDescription(manifest, "fr"), "Carry beads up the tower.")
  assert.equal(localizedName(valid() as unknown as PackManifest, "es"), "Abacus Tower")
})
