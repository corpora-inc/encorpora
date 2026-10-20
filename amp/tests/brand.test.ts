import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { brand, brandTitle } from "../src/brand.ts";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("the locked brand values", () => {
  assert.equal(brand.name, "AMP");
  assert.equal(brand.expansion, "Adaptive Math Pathways");
  assert.equal(brand.productName, "AMP Mathematics");
  assert.equal(brand.checkout.name, "AMP — Adaptive Math Pathways");
  assert.equal(brand.checkout.statementDescriptor, "AMP MATH");
  assert.equal(brandTitle, "AMP · Adaptive Math Pathways");
});

// https://docs.stripe.com/get-started/account/statement-descriptors
test("the statement descriptor satisfies Stripe's rules", () => {
  const d = brand.checkout.statementDescriptor;
  assert.ok(d.length >= 5 && d.length <= 22, "5-22 characters");
  assert.match(d, /[A-Za-z]/, "at least one letter");
  assert.doesNotMatch(d, /[<>\\'"*]/, "no < > \\ ' \" *");
  assert.match(d, /^[\x20-\x7e]+$/, "Latin characters only");
});

test("descriptions are one plain sentence set, no grade range", () => {
  for (const text of [brand.description, brand.checkout.description]) {
    assert.ok(text.length <= 300);
    assert.doesNotMatch(text, /grade|K-12|high school|precalculus/i);
  }
});

test("index.html carries the brand title and description", () => {
  const html = read("../index.html");
  assert.ok(html.includes(`<title>${brandTitle}</title>`));
  const meta = /<meta\s+name="description"\s+content="([^"]*)"/.exec(html);
  assert.equal(meta?.[1], brand.description);
});

test("the encorpora.io manifest names AMP from the brand", () => {
  const apps = JSON.parse(read("../../web/io/data/apps.json")) as {
    id: string;
    title: string;
    description: string;
  }[];
  const amp = apps.find((app) => app.id === "amp");
  assert.ok(amp, "web/io/data/apps.json lists AMP");
  assert.equal(amp.title, brand.productName);
  assert.equal(amp.description, brand.description);
});
