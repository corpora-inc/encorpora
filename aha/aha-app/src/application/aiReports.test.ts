import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_REPORTS, REPORT_REASONS, appendReport, isReportReason, markSent, readReports, submitReport, unsent, type AiReport } from "./aiReports";

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
  });
  it("drops unreadable entries instead of blocking new reports", () => {
    const { reports, dropped } = readReports({ version: 1, reports: [report(1) as never, { id: "x", reason: "typed text" }, null] });
    assert.equal(reports.length, 1);
    assert.equal(dropped, 2);
    assert.deepEqual(readReports("garbage").reports, []);
  });
  it("keeps every unsent report and drops the oldest sent ones past the cap", () => {
    let data = null as Parameters<typeof appendReport>[0];
    for (let i = 0; i < MAX_REPORTS; i++) data = appendReport(data, report(i));
    data = markSent(data, "r0", "2026-10-14T13:00:00.000Z");
    data = appendReport(data, report(MAX_REPORTS));
    const ids = readReports(data).reports.map(r => r.id);
    assert.equal(ids.length, MAX_REPORTS);
    assert.ok(!ids.includes("r0"), "the sent one made room");
    // All unsent: nothing is dropped, even past the cap.
    data = appendReport(data, report(MAX_REPORTS + 1));
    assert.equal(unsent(data).length, MAX_REPORTS + 1);
  });
  it("queues without a sender, and sends with the call id once one exists", async () => {
    const logs: string[] = [];
    const log = (_: string, m: string) => void logs.push(m);
    assert.equal(await submitReport(report(1), undefined, log), "queued");
    assert.match(logs.at(-1)!, /queued on this device/);
    const sent: [string, string][] = [];
    assert.equal(await submitReport(report(2), async (callId, reason) => void sent.push([callId, reason]), log), "sent");
    assert.deepEqual(sent, [["call-2", "incorrect"]]);
    const { callId: _, ...noCall } = report(3);
    assert.equal(await submitReport(noCall, async () => assert.fail("never sent without a call id"), log), "queued");
    assert.equal(await submitReport(report(4), async () => { throw new Error("offline"); }, log), "queued");
    assert.match(logs.at(-1)!, /stays queued: offline/);
  });
});
