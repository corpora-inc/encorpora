import test from "node:test";
import assert from "node:assert/strict";
import { normalizePilotEmail } from "../src/schools/pilots.js";

for (const domain of [
  "outlook.com",
  "icloud.com",
  "fastmail.com",
  "school.example",
]) {
  test(`M1: plus aliases fold for ${domain} without folding dots`, () => {
    assert.equal(normalizePilotEmail(` A.na+one@${domain} `), `a.na@${domain}`);
    assert.equal(normalizePilotEmail(`a.na+two@${domain}`), `a.na@${domain}`);
  });
}
test("M1: Gmail retains dot and domain folding", () => {
  assert.equal(
    normalizePilotEmail(" A.na+one@Googlemail.com "),
    "ana@gmail.com",
  );
});
