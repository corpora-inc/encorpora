import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source = readFileSync(new URL("../src/campaign-client.js", import.meta.url), "utf8");
function run(privacy = {}, search = "?utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch&email=secret@example.test", program = "arkansas-efa") {
  const sent: { url: string; options: { body: string; credentials: string; referrerPolicy: string } }[] = [];
  let click: (e: unknown) => void = () => {};
  const anchor = { href: "https://app.example.test/try/", dataset: { campaignAction: "try" } };
  const root = { dataset: {campaignProgram:program}, querySelectorAll: () => [anchor], contains: () => true, addEventListener: (_: string, cb: typeof click) => { click = cb; } };
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
test("known creative labels reach the aggregate and destination, arbitrary text does not", () => {
  const tags="?utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch";
  const known=run({},tags+"&utm_content=efa-facebook-feed-v1");
  assert.equal(JSON.parse(known.sent[0].options.body).creative,"efa-facebook-feed-v1");
  assert.equal(new URL(known.anchor.href).searchParams.get("utm_content"),"efa-facebook-feed-v1");
  for (const query of [tags+"&utm_content=private%40example.test", "?utm_content=efa-math"]) {
    const unknown=run({},query);
    assert.equal(JSON.parse(unknown.sent[0].options.body).creative,undefined);
    assert.equal(new URL(unknown.anchor.href).searchParams.has("utm_content"),false);
    assert.equal(JSON.stringify(unknown.sent).includes("private"),false);
  }
});
test("the public client recognizes every server-owned creative label", () => {
  const contract=readFileSync(new URL("../../amp/src/analytics/campaign.ts",import.meta.url),"utf8");
  const declaration=contract.match(/export const CAMPAIGN_CREATIVES = \[([\s\S]*?)\] as const/);
  assert.ok(declaration);
  const labels=[...declaration[1].matchAll(/"([a-z0-9-]+)"/g)].map(m=>m[1]);
  assert.ok(labels.length>0);
  for(const label of labels){
    const result=run({},`?utm_source=facebook&utm_medium=paid-social&utm_campaign=ar-efa-launch&utm_content=${label}`);
    assert.equal(JSON.parse(result.sent[0].options.body).creative,label);
  }
});

test("Arizona activity uses its own labels and rejects Arkansas substitution", () => {
 const result=run({},"?utm_campaign=az-esa-launch&utm_source=google&utm_medium=cpc&utm_content=az-esa-math","arizona-esa");
 const payload=JSON.parse(result.sent[0].options.body);
 assert.equal(payload.state,"AZ"); assert.equal(payload.program,"arizona-esa");
 assert.equal(payload.campaign,"az-esa-launch");
 assert.equal(new URL(result.anchor.href).searchParams.get("utm_campaign"),"az-esa-launch");
 const wrong=run({},"?utm_campaign=ar-efa-launch&utm_content=efa-math","arizona-esa");
 assert.equal(JSON.parse(wrong.sent[0].options.body).campaign,"none");
 assert.equal(JSON.parse(wrong.sent[0].options.body).creative,undefined);
 assert.equal(run({},"?utm_campaign=az-esa-launch","unknown").sent.length,0);
});

 test('funded v5 labels reach both state aggregates and destination links',()=>{
 const labels: string[]=JSON.parse(readFileSync(new URL('../../amp/docs/funded-v5-creative-labels.json',import.meta.url),'utf8'));
 for(const label of labels){
 const ar=label.startsWith('ar-'), campaign=ar?'ar-efa-launch':'az-esa-launch',program=ar?'arkansas-efa':'arizona-esa';
 const result=run({},`?utm_campaign=${campaign}&utm_source=facebook&utm_medium=paid-social&utm_content=${label}`,program);
 assert.equal(JSON.parse(result.sent[0].options.body).creative,label);
 assert.equal(new URL(result.anchor.href).searchParams.get('utm_content'),label);
 }
 });
