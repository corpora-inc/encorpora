import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import test from "node:test"

const languagesDir = new URL("../languages/", import.meta.url)
const expectedGrounding = "Use the reference below only when it helps. Reply naturally and never mention the reference or its internal markup.\n\nReference:"

test("all shipped languages have compact prompts without correction directives", () => {
  const prompts = []
  for (const code of readdirSync(languagesDir)) {
    const systemPath = path.join(languagesDir.pathname, code, "prompts/system_prompt.txt")
    const groundingPath = path.join(languagesDir.pathname, code, "prompts/grounding_instruction.txt")
    if (!existsSync(systemPath)) continue
    const system = readFileSync(systemPath, "utf8").trim()
    const grounding = readFileSync(groundingPath, "utf8").trim()
    prompts.push({ code, system })
    assert.ok(system.length > 20, `${code} prompt is empty`)
    assert.ok(system.length <= 500, `${code} prompt is too long: ${system.length}`)
    assert.equal(grounding, expectedGrounding, `${code} grounding instruction drifted`)
    assert.doesNotMatch(system, /\b(?:correct|correction|mistake|errors?)\b/i, `${code} mentions correction`)
  }
  assert.equal(prompts.length, 53)
})
