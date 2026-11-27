import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), "utf8");

test("the compiled-in pack keys are raw ed25519 public keys, production distinct from lab", () => {
  const prod = Buffer.from(read("src-tauri/keys/pack-production.pub").trim(), "base64");
  const lab = Buffer.from(read("src-tauri/keys/pack-lab.pub").trim(), "base64");
  assert.equal(prod.length, 32);
  assert.equal(lab.length, 32);
  assert.notDeepEqual(prod, lab);
});

test("release builds trust only the production key; the release gate checks the secret against it", () => {
  const rs = read("src-tauri/src/pack_keys.rs");
  assert.match(rs, /pub fn release_trusted\(\) -> Vec<&'static str> \{\s*vec!\[PRODUCTION\.trim\(\)\]\s*\}/);
  assert.match(rs, /if cfg!\(debug_assertions\) \{\s*keys\.push\(LAB\.trim\(\)\);/);
  const wf = read("../../.github/workflows/release-crane.yml");
  assert.ok(wf.includes("HARVEST_SIGNING_KEY: ${{ secrets.CRANE_PACK_SIGNING_KEY }}"));
  assert.ok(wf.includes('"$APP_DIR/scripts/check-pack-key.sh" secret'));
});
