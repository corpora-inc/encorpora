/**
 * The native shell and the frontend meet only at runtime: the commands the
 * shared kit and the engine client invoke, the grants in the capability file,
 * the commands the shell registers, and the product name. These tests read
 * all of them and make them agree, as crane's native.test.ts does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT } from "./brands/default.ts";

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const kit = read("../../harvest/appkit/src/native.ts");
const client = read("src/engine/client.ts");
const lib = read("src-tauri/src/lib.rs");
const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
const grants: string[] = JSON.parse(read("src-tauri/capabilities/default.json")).permissions;

const invoked = [...kit.matchAll(/"plugin:(tts|stt)\|([a-z_]+)"/g)].map((m) => `${m[1]}:allow-${m[2]!.replace(/_/g, "-")}`);

test("every tts and stt command the kit invokes is granted, and nothing else", () => {
  const wanted = new Set(invoked);
  wanted.add("stt:allow-register-listener");
  wanted.add("stt:allow-remove-listener");
  assert.deepEqual([...wanted].sort(), [...grants].sort());
});

test("the app commands the frontend invokes are registered in the shell", () => {
  const handler = lib.slice(lib.indexOf("generate_handler!["), lib.indexOf("]", lib.indexOf("generate_handler![")));
  for (const cmd of ["engine_call", "voice_model"]) assert.match(handler, new RegExp(`\\b${cmd}\\b`), `${cmd} is not registered`);
  assert.match(client, /invoke\("engine_call"/);
});

test("the shell names the product from the brand and serves pack images on the scheme the client uses", () => {
  assert.equal(conf.productName, DEFAULT.name);
  assert.equal(conf.app.windows[0].title, DEFAULT.name);
  assert.equal(conf.identifier, DEFAULT.bundleId);
  assert.match(client, /maint-asset:\/\/localhost\//);
  assert.match(conf.app.security.csp, /img-src[^;]*maint-asset:/);
  assert.match(read("src-tauri/src/assets.rs"), /pub const SCHEME: &str = "maint-asset";/);
});
