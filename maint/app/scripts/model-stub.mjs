#!/usr/bin/env node
/**
 * A scripted model endpoint for tests and the gallery capture: an
 * OpenAI-compatible `/v1` that answers each of the engine's three schemas
 * (`decision`, `record`, `answer`) with a canned output picked by a phrase in
 * the request, so every run is the same. Some outputs are deliberately
 * invalid, to prove the engine (and the app) never act on them.
 *
 *   node scripts/model-stub.mjs [port]        (default 4390; MAINT_STUB_PORT)
 *   harvest serve … --llm http://127.0.0.1:4390/v1 --llm-model scripted
 *
 * No model runs here and nothing is downloaded.
 */
import http from "node:http";

const port = Number(process.argv[2] ?? process.env.MAINT_STUB_PORT ?? 4390);

/** Per schema: the first rule whose phrase is in the user message answers; the last is the default. */
const RULES = {
  // symptom.suggest: pick one, clarify between two, or an answer that is not JSON.
  decision: [
    { has: "weird noise", out: { decision: "pick", candidate: 2 } },
    { has: "rattle", out: { decision: "clarify", between: [1, 2] } },
    { has: "grinding", out: "this is not json" },
    { has: "", out: { decision: "none" } },
  ],
  // lesson.prefill: listed labels where the context has them, and free text beside "other"
  // and in the note, which the app must never show.
  record: [
    {
      has: "let go",
      out: { cause: "C2", cause_text: "", action: "other", action_text: "MODEL TEXT swapped the fuse from the truck", parts: ["P1", "other"], parts_other: ["MODEL TEXT zip tie"], minutes: 25, note: "MODEL TEXT happened twice this week" },
    },
    { has: "", out: { cause: "unknown", cause_text: "", action: "unknown", action_text: "", parts: [], parts_other: [], minutes: null, note: "" } },
  ],
  // step.ask: a fixed heading over the manual's own sentences, or decline.
  answer: [
    { has: "how do i check", out: { kind: "answer", sentences: ["S1", "S2"], connector: "What the manual says to do:" } },
    { has: "garbled", out: { kind: "answer", sentences: ["S999"], connector: "The manual says:" } },
    { has: "", out: { kind: "decline" } },
  ],
};

const reply = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url?.endsWith("/models")) return reply(res, 200, { object: "list", data: [{ id: "scripted", object: "model" }] });
    if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) return reply(res, 404, { error: "not here" });
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return reply(res, 400, { error: "bad json" });
      }
      const schema = body.response_format?.json_schema?.name ?? "";
      const user = String(body.messages?.find((m) => m.role === "user")?.content ?? "").toLowerCase();
      const rules = RULES[schema];
      if (!rules) return reply(res, 400, { error: `no script for schema ${schema}` });
      const rule = rules.find((r) => user.includes(r.has)) ?? rules[rules.length - 1];
      const content = typeof rule.out === "string" ? rule.out : JSON.stringify(rule.out);
      console.log(`${schema}: ${rule.has || "(default)"}`);
      reply(res, 200, { id: "scripted", object: "chat.completion", model: "scripted", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`model stub on http://127.0.0.1:${port}/v1`));
