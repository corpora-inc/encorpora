import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every way the app can open a Free2Z page, found by reading the source rather than trusting a list: the SDK's
 * interactive sign-in (Connect and Use a different account), the SDK's account exits, and any generic opener. Each must
 * sit behind the adult step.
 */
const root = fileURLToPath(new URL("../..", import.meta.url));
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? (e.name === "node_modules" || e.name === "gallery" ? [] : files(join(dir, e.name)))
      : /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
}
const sources = files(join(root, "src")).map(f => ({ f: f.slice(root.length), text: readFileSync(f, "utf8") }));
const hits = (re: RegExp) => sources.flatMap(({ f, text }) => text.split("\n").flatMap((line, i) => re.test(line) ? [`${f}:${i + 1}`] : []));

describe("no Free2Z page opens without the adult step", () => {
  it("the interactive sign-in is called in exactly one place, signIn(), which checks the step first", () => {
    const calls = hits(/\.signIn\(/);
    assert.equal(calls.length, 1, calls.join(", "));
    const controller = readFileSync(join(root, "src/application/Controller.tsx"), "utf8");
    const body = controller.slice(controller.indexOf("async function signIn("));
    assert.match(body, /const exit: AccountExit = switching \? "switch" : "connect";/);
    assert.ok(body.indexOf("exitClear(exit") >= 0 && body.indexOf("exitClear(exit") < body.indexOf(".signIn("), "signIn checks the step before the sheet opens");
  });
  it("the SDK's account exits are called in exactly one place, openAccount(), which checks the step first", () => {
    const calls = hits(/openManageAccount\(|openDeleteAccount\(|manageAccountUrl\(|deleteAccountUrl\(/);
    assert.equal(calls.length, 1, calls.join(", "));
    const controller = readFileSync(join(root, "src/application/Controller.tsx"), "utf8");
    const body = controller.slice(controller.indexOf("async function openAccount("));
    assert.ok(body.indexOf("exitClear(") >= 0 && body.indexOf("exitClear(") < body.indexOf("openManageAccount("));
    assert.deepEqual(hits(/open_free2z_account|invoke\(["'`]plugin:/), [], "no app-owned page opener and no raw plugin call");
  });
  it("nothing else can open a page: no generic opener, window.open, navigation or link out", () => {
    assert.deepEqual(hits(/plugin-opener|openUrl\(|window\.open\(|location\.(href|assign|replace)\s*[=(]|target="_blank"/), []);
    assert.deepEqual(hits(/href=\{?["'`]https?:/), [], "no external link in the app");
  });
  it("the UI reaches each exit only through requestExit", () => {
    const controller = readFileSync(join(root, "src/application/Controller.tsx"), "utf8");
    for (const [prop, exit] of [["onSignIn", "connect"], ["onSwitchAccount", "switch"], ["onManageAccount", "manage"], ["onDeleteFree2zAccount", "delete"], ["onAllowAi", "allow"]] as const) {
      const line = controller.split("\n").find(l => l.trim().startsWith(`${prop}=`));
      assert.ok(line?.includes(`requestExit("${exit}")`), `${prop}: ${line}`);
    }
  });
  it("AHA's own native code opens nothing: the SDK plugin builds and opens the two fixed pages", () => {
    for (const name of readdirSync(join(root, "src-tauri/src"))) {
      const rust = readFileSync(join(root, "src-tauri/src", name), "utf8");
      assert.doesNotMatch(rust, /open_url\(|opener|open_free2z_account/, name);
    }
    assert.doesNotMatch(readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8"), /tauri-plugin-opener/);
  });
  it("the webview holds no opener permission, so page code cannot open a URL itself", () => {
    const dir = join(root, "src-tauri/capabilities");
    for (const name of readdirSync(dir)) assert.doesNotMatch(readFileSync(join(dir, name), "utf8"), /opener|shell:/, name);
  });
});
