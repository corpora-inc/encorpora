import test from "node:test";
import assert from "node:assert/strict";
import {
  googlePage,
  sameGoogleVisit,
} from "../src/analytics/google-analytics.js";

test("click-ID cleanup preserves the visit but navigation and new attribution do not", () => {
  const page = "https://corpora.inc/esa/arkansas-efa?utm_source=google";
  for (const key of ["gclid", "gbraid", "wbraid"]) {
    const arrival = `${page}&${key}=Valid_Click_123`;
    assert.equal(sameGoogleVisit(arrival, page), true);
    assert.equal(sameGoogleVisit(arrival, arrival), true);
    assert.equal(sameGoogleVisit(page, arrival), false);
    assert.equal(
      sameGoogleVisit(arrival, `${page}&${key}=Another_Click_123`),
      false,
    );
    assert.equal(
      sameGoogleVisit(arrival, page.replace("arkansas-efa", "arizona-esa")),
      false,
    );
    assert.equal(
      sameGoogleVisit(arrival, `${page}&utm_campaign=new-campaign`),
      false,
    );
    assert.equal(
      sameGoogleVisit(arrival, page.replace("google", "facebook")),
      false,
    );
  }
  assert.equal(sameGoogleVisit("", page), false);
});

test("GA pages retain campaign labels without private parameters or fragments", () => {
  assert.equal(
    googlePage(
      "https://amp.corpora.inc/invoice/arizona-esa?utm_source=Google&utm_medium=cpc&email=private%40example.test&invoice=secret#token",
    ),
    "https://amp.corpora.inc/invoice/arizona-esa?utm_source=google&utm_medium=cpc",
  );
  assert.equal(
    googlePage(
      "https://corpora.inc/esa/arkansas-efa/?utm_campaign=ar-funded&utm_content=private%40example.test",
    ),
    "https://corpora.inc/esa/arkansas-efa?utm_campaign=ar-funded",
  );
});
test("GA excludes learning, account, auth, private invoice and nonproduction URLs", () => {
  for (const path of [
    "/try",
    "/try/practice",
    "/try/map",
    "/practice",
    "/lesson/secret",
    "/family",
    "/account",
    "/auth/callback",
    "/invoice/private-id",
    "/pathways/private-id",
  ])
    assert.equal(googlePage(`https://amp.corpora.inc${path}`), undefined, path);
  for (const url of [
    "http://amp.corpora.inc/",
    "https://stage.amp.corpora.inc/",
    "https://example.test/",
    "http://localhost:4310/",
    "https://corpora.inc/unknown-private-path",
  ])
    assert.equal(googlePage(url), undefined, url);
});

test("Google Ads click IDs survive sanitization for linked campaign reporting", () => {
  assert.equal(
    googlePage(
      "https://amp.corpora.inc/?gclid=Valid_Click_123&wbraid=bad%40email.test",
    ),
    "https://amp.corpora.inc/?gclid=Valid_Click_123",
  );
});

test("signup pages retain only sanitized acquisition context", () => {
  assert.equal(
    googlePage(
      "https://amp.corpora.inc/sign-up?email=private%40example.test&token=secret#private",
    ),
    "https://amp.corpora.inc/sign-up",
  );
  assert.equal(
    googlePage("https://amp.corpora.inc/sign-in?return=free-practice"),
    "https://amp.corpora.inc/sign-in",
  );
});

test("GA covers the actual public funded purchase routes", () => {
  for (const path of [
    "/purchase/arizona-esa",
    "/purchase/arkansas-efa",
    "/purchase/new-hampshire-efa",
  ])
    assert.equal(
      googlePage(`https://amp.corpora.inc${path}?email=private@example.test`),
      `https://amp.corpora.inc${path}`,
    );
});

test("GA covers parent, school and actual legal marketing routes", () => {
  for (const path of [
    "/parents",
    "/schools",
    "/legal/privacy",
    "/legal/terms",
    "/legal/refund",
    "/legal/accessibility",
  ])
    assert.equal(
      googlePage(`https://corpora.inc${path}/?email=private@example.test`),
      `https://corpora.inc${path}`,
    );
});
