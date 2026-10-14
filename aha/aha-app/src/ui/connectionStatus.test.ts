import test from "node:test";
import assert from "node:assert/strict";
import { SETTLING_LABEL, connectionPill } from "./connectionStatus.ts";

test("never AI ready while an earlier request is settling, even if the connection checks passed", () => {
  assert.deepEqual(connectionPill({ connected: true, aiReady: true, settling: true }), { label: SETTLING_LABEL, ready: false });
  assert.deepEqual(connectionPill({ connected: true, aiReady: false, settling: true }), { label: SETTLING_LABEL, ready: false });
});
test("ready, not ready and disconnected labels are unchanged when nothing is settling", () => {
  assert.deepEqual(connectionPill({ connected: true, aiReady: true }), { label: "AI ready", ready: true });
  assert.deepEqual(connectionPill({ connected: true, aiReady: true, settling: false }), { label: "AI ready", ready: true });
  assert.deepEqual(connectionPill({ connected: true }), { label: "Connected · AI not ready", ready: false });
  assert.deepEqual(connectionPill({ connected: false, settling: true }), { label: "Local practice", ready: false });
});
test("out of credits reads as No credits, and a reached app budget as such, calmly", () => {
  assert.deepEqual(connectionPill({ connected: true, refusal: "low_balance" }), { label: "No credits", ready: false });
  assert.deepEqual(connectionPill({ connected: true, refusal: "raise_budget" }), { label: "App budget reached", ready: false });
  // A refusal from an earlier attempt never hides a ready connection or a settling one.
  assert.deepEqual(connectionPill({ connected: true, aiReady: true, refusal: "low_balance" }), { label: "AI ready", ready: true });
  assert.deepEqual(connectionPill({ connected: true, settling: true, refusal: "low_balance" }), { label: SETTLING_LABEL, ready: false });
});
