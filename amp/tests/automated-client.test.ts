import assert from "node:assert/strict";
import test from "node:test";
import { automatedClient } from "../src/analytics/automated-client";

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const facebookApp = `${iphone.replace(" Safari/604.1", "")} [FBAN/FBIOS;FBAV/489.0.0.40.109;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBLC/en_US]`;

test("Meta's ad-review addresses are automated, plain or IPv6-mapped", () => {
  assert.equal(automatedClient("57.141.4.12", iphone), true);
  assert.equal(automatedClient("::ffff:57.141.0.1", iphone), true);
  assert.equal(automatedClient("57.141.255.255", undefined), true);
});

test("neighbouring and malformed addresses are not", () => {
  for (const address of [
    "57.140.4.12",
    "57.142.0.1",
    "157.141.4.12",
    "57.141.4",
    "57.141.4.999",
    "2a03:2880::1",
    "",
  ])
    assert.equal(automatedClient(address, iphone), false, address);
});

test("headless, driven and crawling browsers are automated", () => {
  for (const agent of [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "AdsBot-Google (+http://www.google.com/adsbot.html)",
  ])
    assert.equal(automatedClient("203.0.113.7", agent), true, agent);
});

test("people's browsers, in-app ones included, are not", () => {
  for (const agent of [iphone, facebookApp, undefined])
    assert.equal(automatedClient("203.0.113.7", agent), false, String(agent));
});
