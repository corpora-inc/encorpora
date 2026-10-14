import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CONSENT_VERSION, LOCK_MS, checkBirthYear, grantedRecord, lockedRecord, readConsent } from "./aiConsent";

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
  it("never stores the birth year", () => {
    assert.doesNotMatch(JSON.stringify([grantedRecord(NOW), lockedRecord(NOW)]), /1985|birth|year/i);
  });
});
