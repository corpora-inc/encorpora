import { createSafeRelayPipeline, type SafeRelayChatMessage, type SafeRelayChatOptions } from "../index"
const ENDPOINT = "http://localhost:8077/v1/chat/completions"
const SEEDS = ["The market sells fresh bread.", "We watched the storm roll in.", "Do you want to come to the party?"]
let cyc = 0, verdict = "", para = ""
const tok = (s: string) => (s.toLowerCase().match(/[a-z']+/g) || [])
function overlap(q: string) { const set = new Set(tok(q)); let best = SEEDS[cyc++ % SEEDS.length], sc = -1; for (const s of SEEDS) { const n = tok(s).filter(w => set.has(w)).length; if (n > sc) { sc = n; best = s } } return best }
async function call(m: SafeRelayChatMessage[], o: SafeRelayChatOptions) {
  const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: m, temperature: o.temperature ?? 0.3, top_p: o.topP ?? 0.9, max_tokens: o.maxTokens ?? 160, stream: false }) })
  return ((await r.json()).choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim()
}
const pipeline = createSafeRelayPipeline({ sampleSafePhrase: async (_l, q) => q ? overlap(q) : SEEDS[cyc++ % SEEDS.length], runLlm: async (m, o, label) => { const out = await call(m, o); if (label === "relay.classify") verdict = out; if (label === "relay.paraphrase") para = out; return out } })
const CLEAN = [
  "I went hiking up the mountain yesterday and saw a deer",
  "you like your garage?",
  "I just made a huge pot of chili for dinner",
  "my dog finally learned to roll over today",
  "I'm trying to fix up my old bike",
  "the weather has been so rainy and gray lately",
  "I started reading a really good mystery novel",
  "do you play any instruments?",
]
const OFFLIMITS = ["what's your phone number?", "you're so hot, send me some pics", "let's meet at the park at 9pm", "I live in Tokyo, where are you from?"]
async function main() {
  console.log("\n==== CLEAN / GENUINE (should stay connected) ====")
  for (const text of CLEAN) { verdict = ""; para = ""; const out = await pipeline.prepareOutbound({ text, sourceLanguage: "en", scope: text }); console.log(`\nIN:    ${JSON.stringify(text)}\n  verdict: ${JSON.stringify(verdict)}  para: ${JSON.stringify(para)}\n  OUT:  ${out.relayText}`) }
  console.log("\n\n==== OFF-LIMITS (should still obliterate) ====")
  for (const text of OFFLIMITS) { verdict = ""; para = ""; const out = await pipeline.prepareOutbound({ text, sourceLanguage: "en", scope: text }); console.log(`\nIN:    ${JSON.stringify(text)}\n  verdict: ${JSON.stringify(verdict)}  para: ${JSON.stringify(para)}\n  OUT:  ${out.relayText}`) }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
