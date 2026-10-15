import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SdkError } from "@free2z/sdk";
import type { Json } from "../storage";
import { MAX_REPORTS, REPORT_REASONS, REPORT_RETRY_BASE_MS, REPORT_RETRY_MAX_MS, ReportBackoff, appendReport, flushReports, isReportReason, markRefused, markSent, readReports, reportFor, submitReport, unsent, type AiReport, type ReportReason } from "./aiReports";

const report = (n: number, extra: Partial<AiReport> = {}): AiReport => ({
  id: `r${n}`, activityId: `op${n}:0`, specId: `spec-${n}`, operationId: `op${n}`, callId: `call-${n}`, reason: "incorrect",
  createdAt: "2026-10-14T12:00:00.000Z", ...extra,
});

describe("AI content reports", () => {
  it("offers a short, fixed list of reasons", () => {
    assert.deepEqual(REPORT_REASONS.map(r => r.id), ["incorrect", "inappropriate", "unsafe", "other"]);
    assert.equal(isReportReason("incorrect"), true);
    assert.equal(isReportReason("It was rude"), false, "no typed reasons");
  });
  it("records a report with the activity, spec, operation and call ids", () => {
    const data = appendReport(null, report(1, { receiptId: "receipt-1", model: "gpt-4o" }));
    assert.deepEqual(readReports(data).reports, [report(1, { receiptId: "receipt-1", model: "gpt-4o" })]);
  });
  it("reports an activity once", () => {
    const data = appendReport(appendReport(null, report(1)), { ...report(1), id: "again", reason: "unsafe" });
    assert.deepEqual(readReports(data).reports.map(r => [r.id, r.reason]), [["r1", "incorrect"]]);
    assert.equal(reportFor(data, "op1:0")?.id, "r1", "a repeat report resolves to the stored one");
    assert.equal(reportFor(data, "op9:0"), undefined);
  });
  it("drops unreadable entries instead of blocking new reports", () => {
    const { reports, dropped } = readReports({ version: 1, reports: [report(1) as never, { id: "x", reason: "typed text" }, null] });
    assert.equal(reports.length, 1);
    assert.equal(dropped, 2);
    assert.deepEqual(readReports("garbage").reports, []);
  });
  it("stays within the cap: the oldest sent report goes first, then the oldest unsent", () => {
    let data = null as Parameters<typeof appendReport>[0];
    for (let i = 0; i < MAX_REPORTS; i++) data = appendReport(data, report(i));
    data = markSent(data, "r0", "2026-10-14T13:00:00.000Z");
    data = appendReport(data, report(MAX_REPORTS));
    const ids = readReports(data).reports.map(r => r.id);
    assert.equal(ids.length, MAX_REPORTS);
    assert.ok(!ids.includes("r0"), "the sent one made room");
    // All unsent: the oldest unsent one makes room, so the outbox always fits the native record limit.
    data = appendReport(data, report(MAX_REPORTS + 1));
    const kept = readReports(data).reports.map(r => r.id);
    assert.equal(kept.length, MAX_REPORTS);
    assert.equal(unsent(data).length, MAX_REPORTS);
    assert.ok(!kept.includes("r1") && kept.includes(`r${MAX_REPORTS + 1}`));
    assert.ok(JSON.stringify(data).length < 512 * 1024 / 4, "far below the 512 KiB native record limit");
  });
  it("queues without a sender, and sends with the call id once one exists", async () => {
    const logs: string[] = [];
    const log = (_: string, m: string) => void logs.push(m);
    assert.deepEqual(await submitReport(report(1), undefined, log), { state: "queued" });
    assert.match(logs.at(-1)!, /queued on this device/);
    const sent: unknown[][] = [];
    assert.deepEqual(await submitReport(report(2), async (...args) => void sent.push(args), log), { state: "sent" });
    assert.deepEqual(sent, [["call-2", "incorrect"]], "a call id and a reason; never a detail");
    const { callId: _, ...noCall } = report(3);
    assert.deepEqual(await submitReport(noCall, async () => assert.fail("never sent without a call id"), log), { state: "queued" });
    assert.deepEqual(await submitReport(report(4), async () => { throw new Error("offline"); }, log), { state: "queued" });
    assert.match(logs.at(-1)!, /stays queued: offline/);
  });
  it("maps Free2Z's answers calmly: busy with its Retry-After, final refusals, everything else queued", async () => {
    const logs: [string, string][] = [];
    const log = (level: string, m: string) => void logs.push([level, m]);
    const fail = (e: unknown) => async () => { throw e; };
    assert.deepEqual(await submitReport(report(1), fail(new SdkError("rate_limited", { status: 429, retryAfterSeconds: 30 })), log, () => 1_000),
      { state: "busy", retryAt: 31_000 });
    assert.deepEqual(await submitReport(report(1), fail(new SdkError("rate_limited", { status: 429 })), log), { state: "busy" });
    assert.deepEqual(await submitReport(report(1), fail(new SdkError("concurrency_limit", { status: 429 })), log), { state: "busy" });
    for (const code of ["not_found", "call_not_found", "invalid_request"] as const)
      assert.deepEqual(await submitReport(report(1), fail(new SdkError(code)), log), { state: "refused", code });
    for (const code of ["unavailable", "unsupported_operation", "invalid_token", "signed_out", "transport"] as const)
      assert.deepEqual(await submitReport(report(1), fail(new SdkError(code)), log), { state: "queued" }, code);
    assert.ok(logs.every(([level]) => level === "warn" || level === "info"), "logged, never an alert");
    assert.ok(logs.some(([, m]) => /\[rate_limited\]/.test(m)), "the stable code is in the log");
    assert.deepEqual(await submitReport({ ...report(1), refused: "not_found" }, async () => assert.fail("a refused report is never resent"), log), { state: "refused", code: "not_found" });
  });
  it("a refused report is kept but never sent again, and makes room before an unsent one", () => {
    let data = markRefused(appendReport(appendReport(null, report(1)), report(2)), "r1", "not_found");
    assert.deepEqual(unsent(data).map(r => r.id), ["r2"]);
    assert.equal(readReports(data).reports[0].refused, "not_found");
    for (let i = 3; i <= MAX_REPORTS + 1; i++) data = appendReport(data, report(i));
    assert.ok(!readReports(data).reports.some(r => r.id === "r1"), "the refused one goes first");
    assert.ok(readReports(data).reports.some(r => r.id === "r2"));
  });
});

/** An in-memory account journal, and a Free2Z that answers each send from a script. */
function outbox(reports: AiReport[]) {
  let data: Json = null;
  for (const r of reports) data = appendReport(data, r);
  const store = { read: async () => data, update: async (change: (d: Json) => Json) => { data = change(data); } };
  return { store, read: () => readReports(data).reports };
}
const quiet = () => undefined;

describe("sending the outbox", () => {
  it("sends every waiting report oldest first, one at a time, and marks each sent", async () => {
    const o = outbox([report(1), report(2), { ...report(3), sentAt: "2026-10-14T12:30:00.000Z" }]);
    const sent: unknown[][] = [];
    let inFlight = 0;
    const result = await flushReports({ store: o.store, backoff: new ReportBackoff(), current: () => true, allowed: () => true, log: quiet, now: () => Date.parse("2026-10-14T13:00:00Z"),
      send: async (...args: [string, ReportReason]) => { assert.equal(++inFlight, 1, "one at a time"); sent.push(args); await Promise.resolve(); inFlight--; } });
    assert.deepEqual(sent, [["call-1", "incorrect"], ["call-2", "incorrect"]], "never a detail; a sent one never twice");
    assert.deepEqual(result, { sent: 2, refused: 0, waiting: 0 });
    assert.deepEqual(o.read().map(r => r.sentAt), ["2026-10-14T13:00:00.000Z", "2026-10-14T13:00:00.000Z", "2026-10-14T12:30:00.000Z"]);
  });
  it("looks up a call id the journal learned after the report was recorded", async () => {
    const { callId: _, ...noCall } = report(1);
    const o = outbox([noCall, { ...report(2), callId: undefined }]);
    const sent: string[] = [];
    const result = await flushReports({ store: o.store, backoff: new ReportBackoff(), current: () => true, allowed: () => true, log: quiet,
      callFor: async op => (op === "op1" ? "late-call" : undefined), send: async callId => void sent.push(callId) });
    assert.deepEqual(sent, ["late-call"]);
    assert.equal(o.read()[0].callId, "late-call", "stored with its call id");
    assert.deepEqual(result, { sent: 1, refused: 0, waiting: 1 }, "the one still without a call waits");
  });
  it("stops at a rate limit, waits exactly Free2Z's Retry-After, otherwise backs off doubling up to a cap", async () => {
    const o = outbox([report(1), report(2), report(3)]);
    const backoff = new ReportBackoff();
    let clock = 1_000_000, sends = 0;
    const limited = async () => { sends++; throw new SdkError("rate_limited", { status: 429, retryAfterSeconds: 120 }); };
    let result = await flushReports({ store: o.store, backoff, current: () => true, allowed: () => true, log: quiet, now: () => clock, send: limited });
    assert.equal(sends, 1, "the first 429 stops the flush: Free2Z is never hammered");
    assert.deepEqual(result, { sent: 0, refused: 0, waiting: 3, stopped: "busy" });
    assert.equal(backoff.nextAt, clock + 120_000, "Retry-After beats the shorter base wait");
    const short = new ReportBackoff();
    short.failed(clock, clock + 1_000);
    assert.equal(short.nextAt, clock + 1_000, "a short Retry-After is Free2Z's call, honoured as sent");
    // Before then nothing is sent, however often a connect asks.
    clock += 119_000;
    result = await flushReports({ store: o.store, backoff, current: () => true, allowed: () => true, log: quiet, now: () => clock, send: async () => assert.fail("sent during the wait") });
    assert.deepEqual(result, { sent: 0, refused: 0, waiting: 3, stopped: "backoff" });
    // After it, the next failure waits twice the base (no Retry-After this time), and so on up to the cap.
    clock += 1_000;
    await flushReports({ store: o.store, backoff, current: () => true, allowed: () => true, log: quiet, now: () => clock, send: async () => { throw new SdkError("unavailable"); } });
    assert.equal(backoff.nextAt, clock + 2 * REPORT_RETRY_BASE_MS);
    const b = new ReportBackoff();
    for (let i = 0; i < 20; i++) b.failed(0);
    assert.equal(b.nextAt, REPORT_RETRY_MAX_MS);
    // Once Free2Z answers again, everything goes and the backoff resets.
    clock = backoff.nextAt;
    result = await flushReports({ store: o.store, backoff, current: () => true, allowed: () => true, log: quiet, now: () => clock, send: async () => undefined });
    assert.deepEqual(result, { sent: 3, refused: 0, waiting: 0 });
    assert.equal(backoff.ready(clock), true);
    assert.equal(backoff.nextAt, 0);
  });
  it("records a final refusal and carries on with the rest", async () => {
    const o = outbox([report(1), report(2)]);
    const result = await flushReports({ store: o.store, backoff: new ReportBackoff(), current: () => true, allowed: () => true, log: quiet,
      send: async callId => { if (callId === "call-1") throw new SdkError("not_found", { status: 404 }); } });
    assert.deepEqual(result, { sent: 1, refused: 1, waiting: 0 });
    assert.deepEqual(o.read().map(r => [r.refused, !!r.sentAt]), [["not_found", false], [undefined, true]]);
  });
  it("never sends one account's report under another: it stops once the account changes", async () => {
    const o = outbox([report(1), report(2)]);
    let same = true;
    const sent: string[] = [];
    const result = await flushReports({ store: o.store, backoff: new ReportBackoff(), current: async () => same, allowed: () => true, log: quiet,
      send: async callId => { sent.push(callId); same = false; } });
    assert.deepEqual(sent, ["call-1"]);
    assert.deepEqual(result, { sent: 1, refused: 0, waiting: 1, stopped: "stale" });
    // A 404 that arrives after the account changed says nothing about this account's call: it stays queued.
    const p = outbox([report(3)]);
    let current = true;
    const refusedLate = await flushReports({ store: p.store, backoff: new ReportBackoff(), current: () => current, allowed: () => true, log: quiet,
      send: async () => { current = false; throw new SdkError("not_found", { status: 404 }); } });
    assert.equal(refusedLate.stopped, "stale");
    assert.equal(p.read()[0].refused, undefined, "not marked refused");
  });
});

describe("reports wait for AI permission", () => {
  it("sends nothing while AI lessons are not allowed: the flagged report stays queued, untouched", async () => {
    // The one just flagged has no call id yet (it would be looked up first); an older one already holds its own.
    const { callId: _, ...flagged } = report(2);
    const o = outbox([flagged, report(1)]);
    const backoff = new ReportBackoff();
    const logs: string[] = [];
    let calls = 0;
    const result = await flushReports({ store: o.store, backoff, current: () => true, allowed: () => false,
      log: (_, m) => void logs.push(m), callFor: async () => { calls++; return "late-call"; },
      send: async () => assert.fail("a report left the device without AI permission") });
    assert.deepEqual(result, { sent: 0, refused: 0, waiting: 2, stopped: "consent" });
    assert.equal(calls, 0, "nothing is even looked up for sending");
    assert.deepEqual(o.read(), [flagged, report(1)], "queued as recorded: not sent, not refused, no call id filled in");
    assert.equal(backoff.ready(Date.now()), true, "no backoff: it goes as soon as AI is allowed");
    assert.match(logs.at(-1)!, /until AI lessons are allowed/);
  });
  it("sends the queued report exactly once after AI lessons are allowed", async () => {
    const o = outbox([report(1)]);
    const backoff = new ReportBackoff();
    let allowed = false;
    const sent: unknown[][] = [];
    const flush = () => flushReports({ store: o.store, backoff, current: () => true, allowed: () => allowed, log: quiet,
      send: async (...args: [string, ReportReason]) => void sent.push(args) });
    await flush();
    await flush();
    assert.deepEqual(sent, [], "still nothing before permission");
    allowed = true;
    assert.deepEqual(await flush(), { sent: 1, refused: 0, waiting: 0 });
    assert.deepEqual(await flush(), { sent: 0, refused: 0, waiting: 0 });
    assert.deepEqual(sent, [["call-1", "incorrect"]], "once, with its call id and reason");
    assert.ok(o.read()[0].sentAt, "marked sent");
  });
  it("stops before the next send once permission is withdrawn mid-flush", async () => {
    const o = outbox([report(1), report(2)]);
    let allowed = true;
    const sent: string[] = [];
    const result = await flushReports({ store: o.store, backoff: new ReportBackoff(), current: () => true, allowed: () => allowed, log: quiet,
      send: async callId => { sent.push(callId); allowed = false; } });
    assert.deepEqual(sent, ["call-1"]);
    assert.deepEqual(result, { sent: 1, refused: 0, waiting: 1, stopped: "consent" });
    assert.equal(o.read()[1].sentAt, undefined, "the second one waits");
  });
});
