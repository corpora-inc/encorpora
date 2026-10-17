import assert from "node:assert/strict";
import test from "node:test";
import { consentConfiguration } from "../src/parent-consent/config.js";
test("consent configuration never enables an absent mail transport", async () => {
  assert.deepEqual(await consentConfiguration({}), {
    policy: null,
    secrets: null,
    transportEnabled: false,
  });
  assert.equal(
    (
      await consentConfiguration({
        AMP_CONSENT_SECRET_BASE64: Buffer.alloc(32, 1).toString("base64"),
      })
    ).transportEnabled,
    false,
  );
  for (const encoded of [
    "",
    "invalid",
    Buffer.alloc(31).toString("base64"),
    Buffer.alloc(33).toString("base64"),
    Buffer.alloc(32).toString("base64") + "\n",
  ])
    await assert.rejects(
      consentConfiguration({ AMP_CONSENT_SECRET_BASE64: encoded }),
      /exactly 32/,
    );
});
