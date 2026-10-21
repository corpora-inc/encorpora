import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(new URL("../src/campaign-client.js", import.meta.url), "utf8");
function run(privacy = {}, search = "?utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch&email=secret@example.test") {
  const sent: { url: string; options: { body: string; credentials: string; referrerPolicy: string } }[] = [];
  let click: (e: unknown) => void = () => {};
  const anchor = { href: "https://app.example.test/try/", dataset: { campaignAction: "try" } };
  const root = { querySelectorAll: () => [anchor], contains: () => true, addEventListener: (_: string, cb: typeof click) => { click = cb; } };
  runInNewContext(source, {
    document: { querySelector: (s: string) => s.startsWith("script") ? { dataset: { campaignEndpoint: "https://app.example.test/api/v1/campaign-events" } } : root },
    navigator: privacy, location: { search }, URL, URLSearchParams,
    fetch: (url: string, options: typeof sent[number]["options"]) => { sent.push({url, options}); return Promise.resolve(); },
  });
  return { sent, anchor, click: (action: string) => click({ target: { closest: () => ({ dataset: { campaignAction: action } }) } }) };
}
test("static campaign sends only fixed fields and propagates only campaign labels", () => {
  const result=run(); result.click("try"); result.click("invoice");
  assert.deepEqual(result.sent.map(s=>JSON.parse(s.options.body).action), ["landing_view","try_click","invoice_click"]);
  assert.equal(JSON.stringify(result.sent).includes("secret"), false);
  assert.equal(result.sent[0].options.credentials,"omit");
  assert.equal(result.sent[0].options.referrerPolicy,"no-referrer");
  assert.equal(new URL(result.anchor.href).searchParams.get("utm_campaign"),"ar-efa-launch");
  assert.equal(new URL(result.anchor.href).searchParams.has("email"),false);
  const unknown=run({},"?utm_source=someone-name&utm_campaign=private-text");
  assert.equal(JSON.parse(unknown.sent[0].options.body).source,"direct");
  assert.equal(JSON.parse(unknown.sent[0].options.body).campaign,"none");
});
test("GPC and DNT suppress collection and campaign forwarding", () => {
  for (const privacy of [{ globalPrivacyControl: true }, { doNotTrack: "1" }]) {
    const result=run(privacy); assert.equal(result.sent.length,0);
    assert.equal(result.anchor.href,"https://app.example.test/try/");
  }
});
