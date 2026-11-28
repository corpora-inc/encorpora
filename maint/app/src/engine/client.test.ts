import { test } from "node:test";
import assert from "node:assert/strict";
import { call, EngineError, httpTransport, onRestartNeeded, plainError, setTransport, type Transport } from "./client.ts";

test("a result comes back as the method's result", async () => {
  const seen: [string, unknown][] = [];
  const t: Transport = { call: async (m, p) => (seen.push([m, p]), { ok: true, result: { pack_id: "pump40" } }) };
  setTransport(t);
  const r = await call("pack.info", {});
  assert.equal((r as { pack_id: string }).pack_id, "pump40");
  assert.deepEqual(seen, [["pack.info", {}]]);
});

test("an engine error becomes an EngineError with its code and message", async () => {
  setTransport({ call: async () => ({ ok: false, error: { code: "invalid", message: "node nc.9 is not the current node" } }) });
  await assert.rejects(call("job.answer", { job_id: "j", node_id: "nc.9", outcome: "yes" }), (e: unknown) => e instanceof EngineError && e.code === "invalid" && e.method === "job.answer" && /current node/.test(e.message));
});

test("HTTP: POST /api/<method> with JSON, and an unreachable engine is an error, not a crash", async () => {
  const calls: [string, RequestInit][] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    const r = await httpTransport("http://engine").call("asset.list", {});
    assert.deepEqual(r, { ok: true, result: [] });
    assert.equal(calls[0]![0], "http://engine/api/asset.list");
    assert.equal(calls[0]![1].method, "POST");
    assert.equal((calls[0]![1].headers as Record<string, string>)["Content-Type"], "application/json");
    globalThis.fetch = (async () => {
      throw new TypeError("connection refused");
    }) as typeof fetch;
    const down = await httpTransport("http://engine").call("asset.list", {});
    assert.equal(down.ok, false);
    assert.equal(!down.ok && down.error.code, "unreachable");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("no database or system error text ever reaches a person", () => {
  const fallback = "The search did not run. Try again.";
  assert.equal(plainError(new EngineError("symptom.search", "internal", "sqlite: attempt to write a readonly database"), fallback), fallback);
  assert.equal(plainError(new EngineError("job.start", "invalid", "sqlite: database is locked"), fallback), fallback);
  assert.equal(plainError(new EngineError("x", "unreachable", "The engine did not answer (fetch failed)"), fallback), fallback);
  assert.equal(plainError(new Error("boom"), fallback), fallback);
  assert.equal(plainError(new EngineError("asset.get", "invalid", 'invalid input: no asset "u-9"'), fallback), 'no asset "u-9"');
  const open = "Maintenance Associate cannot save its records in /x: the disk is full. Make sure ...";
  assert.equal(plainError(new EngineError("pack.list", "open_failed", open), fallback), open);
});

test("a restart request is announced once per failing call, in the shell's words", async () => {
  const heard: string[] = [];
  onRestartNeeded((m) => heard.push(m));
  setTransport({ call: async () => ({ ok: false, error: { code: "restart_needed", message: "Quit Maintenance Associate and open it again." } }) });
  await assert.rejects(call("asset.list", {}), (e: unknown) => e instanceof EngineError && e.code === "restart_needed");
  assert.deepEqual(heard, ["Quit Maintenance Associate and open it again."]);
  assert.equal(plainError(new EngineError("asset.list", "restart_needed", heard[0]!), "x"), heard[0]);
});
