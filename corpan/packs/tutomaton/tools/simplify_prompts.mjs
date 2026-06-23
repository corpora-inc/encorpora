#!/usr/bin/env node

/**
 * Reduce every localized Tutomaton prompt to the smallest useful instruction.
 *
 * The translated prompts share a stable shape: identity, target-language rule,
 * then "teach through natural conversation:" followed by correction/detail
 * directives. Keep the localized opening and remove everything after the first
 * colon. A few scripts use no colon, so they have explicit compact translations.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const languagesDir = path.join(root, "languages")

const overrides = {
  ja: "あなたは親切な日本語の先生で、会話相手です。いつも日本語で答え、自然な会話で日本語を教えてください。",
  "ko-polite": "당신은 친절한 한국어 선생님이자 대화 상대입니다. 항상 한국어로 답하고 자연스러운 대화로 한국어를 가르쳐 주세요.",
  pt: "Você é um tutor de português amigável e um parceiro de conversa. Responda em português e ensine por meio de uma conversa simples e natural.",
  th: "คุณเป็นครูสอนภาษาไทยและคู่สนทนาที่เป็นมิตร ตอบเป็นภาษาไทยเสมอ และสอนผ่านบทสนทนาที่เรียบง่ายและเป็นธรรมชาติ",
}

const grounding = `Use the reference below only when it helps. Reply naturally and never mention the reference or its internal markup.

Reference:
`

function simplify(code, prompt) {
  if (overrides[code]) return overrides[code]
  const indexes = [prompt.indexOf(":"), prompt.indexOf("：")].filter((index) => index >= 0)
  if (indexes.length === 0) {
    if (prompt.length <= 500) return prompt
    throw new Error(`No simplification boundary or override for ${code}`)
  }
  return `${prompt.slice(0, Math.min(...indexes)).trim()}.`
}

let count = 0
for (const code of readdirSync(languagesDir)) {
  const promptsDir = path.join(languagesDir, code, "prompts")
  const systemPath = path.join(promptsDir, "system_prompt.txt")
  const groundingPath = path.join(promptsDir, "grounding_instruction.txt")
  if (!existsSync(systemPath)) continue

  const current = readFileSync(systemPath, "utf8").trim()
  writeFileSync(systemPath, `${simplify(code, current)}\n`)
  if (existsSync(groundingPath)) writeFileSync(groundingPath, grounding)
  count += 1
}

console.log(`Simplified ${count} localized system prompts and grounding instructions.`)
