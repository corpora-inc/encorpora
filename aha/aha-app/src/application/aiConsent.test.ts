import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_EXITS, AdultGate, aiAllowed, grantOf, BROWSER_EXITS, CONSENT_VERSION, GATE_MS, LOCK_MS, checkBirthYear, exitClear, grantedRecord, lockedRecord, needsConsent, readConsent } from "./aiConsent";

const NOW = Date.parse("2026-10-14T12:00:00Z");

describe("AI consent and the adult step", () => {
  it("passes only a year that makes the person certainly 18 already", () => {
    const today = new Date(NOW);
    assert.equal(checkBirthYear("1985", today), "adult");
    assert.equal(checkBirthYear("2007", today), "adult", "at least 18 whatever the birthday");
    assert.equal(checkBirthYear("2008", today), "minor", "might still be 17");
    assert.equal(checkBirthYear("2015", today), "minor");
    assert.equal(checkBirthYear(" 1990 ", today), "adult");
  });
  it("rejects anything that is not a plausible four-digit year", () => {
    const today = new Date(NOW);
    for (const bad of ["", "85", "19850", "19a5", "2027", "1800", "-1990", "1990.5"]) assert.equal(checkBirthYear(bad, today), "invalid", bad);
  });
  it("reads a granted record and asks again for anything else", () => {
    assert.deepEqual(readConsent(grantedRecord(NOW), NOW), { status: "granted", grantedAt: new Date(NOW).toISOString() });
    assert.deepEqual(readConsent(null, NOW), { status: "needed" });
    assert.deepEqual(readConsent("granted", NOW), { status: "needed" });
    assert.deepEqual(readConsent([], NOW), { status: "needed" });
    assert.deepEqual(readConsent({ version: CONSENT_VERSION, grantedAt: "not a date" }, NOW), { status: "needed" });
  });
  it("asks again when the disclosure version changes", () => {
    assert.deepEqual(readConsent({ version: CONSENT_VERSION - 1, grantedAt: new Date(NOW).toISOString() }, NOW), { status: "needed" });
    assert.deepEqual(readConsent({ version: CONSENT_VERSION + 1, grantedAt: new Date(NOW).toISOString() }, NOW), { status: "needed" });
  });
  it("locks the step for a day after a year that does not pass, then asks again", () => {
    const record = lockedRecord(NOW);
    assert.deepEqual(readConsent(record, NOW), { status: "locked", until: NOW + LOCK_MS });
    assert.deepEqual(readConsent(record, NOW + LOCK_MS - 1), { status: "locked", until: NOW + LOCK_MS });
    assert.deepEqual(readConsent(record, NOW + LOCK_MS), { status: "needed" });
  });
  it("a lock keeps an earlier AI permission: it closes the exits, never the lessons already allowed", () => {
    const at = new Date(NOW - 1000).toISOString();
    const locked = readConsent(lockedRecord(NOW, at), NOW);
    assert.deepEqual(locked, { status: "locked", until: NOW + LOCK_MS, grantedAt: at });
    assert.equal(aiAllowed(locked), true);
    assert.equal(aiAllowed(readConsent(lockedRecord(NOW), NOW)), false);
    assert.deepEqual(readConsent(lockedRecord(NOW, at), NOW + LOCK_MS), { status: "granted", grantedAt: at }, "after the day, the permission remains");
    assert.equal(grantOf(locked), at);
    assert.equal(grantOf({ status: "needed" }), undefined);
  });
  it("never stores the birth year", () => {
    assert.doesNotMatch(JSON.stringify([grantedRecord(NOW), lockedRecord(NOW)]), /1985|birth|year/i);
  });
});

describe("every account exit passes the adult step", () => {
  const granted = { status: "granted", grantedAt: new Date(NOW).toISOString() } as const;
  it("enumerates the exits: the four that open Free2Z, and Allow AI lessons", () => {
    assert.deepEqual([...ACCOUNT_EXITS], ["connect", "switch", "manage", "delete", "allow"]);
    assert.deepEqual([...BROWSER_EXITS], ["connect", "switch", "manage", "delete"]);
  });
  it("no exit is clear before a pass, with or without AI permission", () => {
    for (const exit of ACCOUNT_EXITS) {
      assert.equal(exitClear(exit, new AdultGate(), granted, NOW), false, exit);
      assert.equal(exitClear(exit, new AdultGate(), { status: "needed" }, NOW), false, exit);
    }
  });
  it("a pass is remembered for a few minutes, then the step is shown again", () => {
    const gate = new AdultGate();
    gate.pass(NOW);
    for (const exit of ACCOUNT_EXITS) {
      assert.equal(exitClear(exit, gate, granted, NOW + GATE_MS - 1), true, exit);
      assert.equal(exitClear(exit, gate, granted, NOW + GATE_MS), false, exit);
    }
    assert.equal(gate.fresh(NOW - 1), false, "a clock set back never extends a pass");
    gate.reset();
    assert.equal(gate.fresh(NOW), false);
  });
  it("a lock closes every exit, even right after a pass", () => {
    const gate = new AdultGate();
    gate.pass(NOW);
    for (const exit of ACCOUNT_EXITS) assert.equal(exitClear(exit, gate, { status: "locked", until: NOW + LOCK_MS }, NOW), false, exit);
  });
  it("Connect and Allow AI lessons also need this device's AI permission; switching, Manage and Delete do not", () => {
    const gate = new AdultGate();
    gate.pass(NOW);
    assert.deepEqual(ACCOUNT_EXITS.map(e => needsConsent(e, { status: "needed" })), [true, false, false, false, true]);
    assert.deepEqual(ACCOUNT_EXITS.map(e => exitClear(e, gate, { status: "needed" }, NOW)), [false, true, true, true, false]);
    assert.deepEqual(ACCOUNT_EXITS.map(e => needsConsent(e, granted)), [false, false, false, false, false]);
  });
});
