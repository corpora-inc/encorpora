import test from "node:test";
import { userAgents } from "./fixtures/in-app-user-agents";
import assert from "node:assert/strict";
import { browserKind } from "../src/analytics/browser-kind.js";
import {
  funnelPropsSchemas,
  eventBatchSchema,
} from "../src/analytics/events.js";

// Synthetic user agents in each app's published shape.
const ios = (tail: string) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148${tail}`;
const android = (tail: string) =>
  `Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.107 Mobile Safari/537.36${tail}`;

test("in-app webviews are named from their user-agent markers", () => {
  const cases: [string, ReturnType<typeof browserKind>][] = [
    [
      ios(" musical_ly_37.5.0 JsSdk/2.0 BytedanceWebview/d8a21c6"),
      "inapp-tiktok",
    ],
    [android(" trill_370404 JsSdk/1.0 AppName/trill"), "inapp-tiktok"],
    [
      ios(" Instagram 355.0.0.29.82 (iPhone15,2; iOS 18_1; en_US)"),
      "inapp-instagram",
    ],
    [
      android(" Instagram 355.0.0.29.82 Android (34/14; 420dpi)"),
      "inapp-instagram",
    ],
    [ios(" [FBAN/FBIOS;FBAV/489.0.0.40.109;FBSN/iOS]"), "inapp-facebook"],
    [android(" [FB_IAB/FB4A;FBAV/489.0.0.40.109;]"), "inapp-facebook"],
    [android(" [FB_IAB/Orca-Android;FBAV/489.0.0.40.109;]"), "inapp-facebook"],
    [
      ios(" Snapchat/13.20.0.43 (like Safari/8619.1.26.30.5, panda)"),
      "inapp-snapchat",
    ],
    [
      android(" Snapchat/13.20.0.43 (Pixel 8; Android 14; gzip)"),
      "inapp-snapchat",
    ],
    [android(""), "inapp-other"],
    [ios(" Pinterest/iOS"), "inapp-other"],
    [ios(""), "inapp-other"],
  ];
  for (const [agent, kind] of cases)
    assert.equal(browserKind(agent), kind, agent);
});

test("standard browsers stay standard", () => {
  for (const agent of [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.107 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0",
    "",
  ])
    assert.equal(browserKind(agent), "standard", agent);
});

test("errors and landings carry the browser kind; the shared entry context does not", () => {
  assert.ok(
    funnelPropsSchemas.client_error.safeParse({
      kind: "error",
      screen: "pitch",
      source: "external",
      browser: "inapp-tiktok",
    }).success,
  );
  assert.equal(
    funnelPropsSchemas.client_error.safeParse({
      kind: "error",
      screen: "pitch",
      browser: "Mozilla/5.0 (iPhone)",
    }).success,
    false,
  );
  assert.ok(
    funnelPropsSchemas.landing_view.safeParse({
      referrer: "social",
      device: "phone",
      browser: "inapp-instagram",
    }).success,
  );
  const batch = {
    visitorId: "4f6b1a8e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
    events: [{ event: "try_click", at: 1 }],
  };
  assert.ok(
    eventBatchSchema.safeParse({
      ...batch,
      context: { referrer: "social", device: "phone" },
    }).success,
  );
  assert.equal(
    eventBatchSchema.safeParse({
      ...batch,
      context: { referrer: "social", device: "phone", browser: "standard" },
    }).success,
    false,
  );
});

for (const { name, kind, ua } of userAgents) {
  test(`real user agent: ${name}`, () => assert.equal(browserKind(ua), kind));
}

test("overlapping app markers and generic webviews stay embedded", () => {
  assert.equal(
    browserKind(android(" [FBAN/Orca-Android;FBAV/489.0.0.40.109;]")),
    "inapp-facebook",
  );
  assert.equal(
    browserKind(ios(" [FBAN/MessengerForiOS;FBAV/489.0.0.40.109;]")),
    "inapp-facebook",
  );
  assert.equal(
    browserKind(android(" Instagram 355.0 [FBAN/FB4A;]")),
    "inapp-instagram",
  );
  assert.equal(
    browserKind(
      "Mozilla/5.0 (Linux; Android 14; wv; Mobile) Chrome/130.0 Mobile Safari/537.36",
    ),
    "inapp-other",
  );
  assert.equal(
    browserKind("Mozilla/5.0 LinkedIn/9.0 Safari/604.1"),
    "inapp-other",
  );
});
