import { createSafeRelayPipeline, type SafeRelayChatMessage, type SafeRelayChatOptions } from "../index"

const ENDPOINT = "http://localhost:8077/v1/chat/completions"
const SEEDS = ["The market sells fresh bread.", "We watched the storm roll in.", "Do you want to come to the party?", "How old is your brother?"]
let cyc = 0, lastGate = ""
const tok = (s: string) => (s.toLowerCase().match(/[a-z']+/g) || [])
function overlap(q: string) { const set = new Set(tok(q)); let best = SEEDS[cyc++ % SEEDS.length], sc = -1; for (const s of SEEDS) { const n = tok(s).filter(w => set.has(w)).length; if (n > sc) { sc = n; best = s } } return best }
async function call(messages: SafeRelayChatMessage[], o: SafeRelayChatOptions) {
  const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages, temperature: o.temperature ?? 0.3, top_p: o.topP ?? 0.9, max_tokens: o.maxTokens ?? 160, stream: false }) })
  const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> }
  return (j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim()
}
const pipeline = createSafeRelayPipeline({ sampleSafePhrase: async (_l, q) => q ? overlap(q) : SEEDS[cyc++ % SEEDS.length], runLlm: async (m, o, label) => { const out = await call(m, o); if (label === "relay.gate") lastGate = out; return out } })

const INPUTS = [
  "you like your garage?",
  "what's your favorite part of your house?",
  "do you have a garage?",
  "do you play any sports?",
  "what did you eat for lunch?",
  "I love my new kitchen",
  "I went hiking yesterday",
  "my dog is so cute",
]
async function main() {
  for (const text of INPUTS) {
    console.log(`\nIN:  ${JSON.stringify(text)}`)
    for (let r = 0; r < 2; r++) { lastGate = ""; const out = await pipeline.prepareOutbound({ text, sourceLanguage: "en", scope: `${text}#${r}` }); console.log(`OUT: ${out.relayText}   [gate:${lastGate.slice(0, 24)}]`) }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
