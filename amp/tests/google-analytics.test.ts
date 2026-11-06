import test from "node:test";
import assert from "node:assert/strict";
import {
  googleEvent,
  googlePage,
  googleProgram,
  sameGoogleVisit,
  googlePageTitle,
} from "../src/analytics/google-analytics.js";
import { FUNNEL_EVENTS } from "../src/analytics/events.js";

test("public page titles distinguish the journey without private URL data", () => {
  assert.equal(
    googlePageTitle(
      "https://amp.corpora.inc/sign-up?email=private@example.test",
    ),
    "Create Your Account | AMP",
  );
  assert.equal(googlePageTitle("https://amp.corpora.inc/plans"), "Plans | AMP");
  assert.equal(
    googlePageTitle("https://corpora.inc/esa/arizona-esa/"),
    "Arizona ESA | AMP",
  );
  assert.equal(
    googlePageTitle("https://corpora.inc/esa/arkansas-efa/"),
    "Arkansas EFA | AMP",
  );
  assert.equal(
    googlePageTitle("https://amp.corpora.inc/account/private"),
    undefined,
  );
  assert.equal(
    googlePageTitle("https://amp.corpora.inc/constructor"),
    undefined,
  );
});

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

test("the pitch, its funded-program variants and sign-up intents have distinct GA titles", () => {
  const pitch = "https://amp.corpora.inc/";
  assert.equal(
    googlePageTitle(`${pitch}?utm_source=google&gclid=Valid_Click_123`),
    "AMP: Adaptive Math Pathways, a complete math curriculum",
  );
  assert.equal(
    googlePageTitle(`${pitch}?program=ar-efa&utm_campaign=ar-efa-launch`),
    "AMP: Adaptive Math Pathways for Arkansas EFA families",
  );
  assert.equal(
    googlePageTitle(`${pitch}?program=tx-esa`),
    "AMP: Adaptive Math Pathways, a complete math curriculum",
  );
  assert.equal(
    googlePageTitle(
      "https://amp.corpora.inc/sign-up?entry=pitch-try&return=free-practice&email=private@example.test",
    ),
    "Try AMP Free | AMP",
  );
  assert.equal(
    googlePageTitle("https://amp.corpora.inc/sign-up?entry=pitch-buy"),
    "Create Your Account to Buy | AMP",
  );
  // The URL GA keeps still carries no program, entry or private value.
  assert.equal(
    googlePage(
      "https://amp.corpora.inc/sign-up?entry=pitch-try&return=free-practice&program=ar-efa&email=private@example.test",
    ),
    "https://amp.corpora.inc/sign-up",
  );
});

test("the signed-in home at / is a learning screen GA never sees", () => {
  assert.equal(googlePage("https://amp.corpora.inc/", "app"), undefined);
  assert.equal(googlePageTitle("https://amp.corpora.inc/", "app"), undefined);
  // Other public routes do not depend on what / shows.
  assert.equal(
    googlePage("https://amp.corpora.inc/plans", "app"),
    "https://amp.corpora.inc/plans",
  );
});

test("only a listed program on an AMP URL becomes the program parameter", () => {
  assert.equal(
    googleProgram("https://amp.corpora.inc/?program=az-esa"),
    "az-esa",
  );
  assert.equal(
    googleProgram("https://amp.corpora.inc/?program=tx-esa"),
    undefined,
  );
  assert.equal(
    googleProgram("https://amp.corpora.inc/?program=AZ-ESA"),
    undefined,
  );
  assert.equal(googleProgram("https://corpora.inc/?program=az-esa"), undefined);
  assert.equal(googleProgram("not a url"), undefined);
});

test("pitch actions map to GA's recommended names with only allowed parameters", () => {
  const card = "https://amp.corpora.inc/?utm_source=google";
  const funded = "https://amp.corpora.inc/?program=ar-efa";
  assert.deepEqual(googleEvent("video_play", {}, card), {
    name: "video_start",
    params: {},
  });
  for (const percent of [25, 50, 75])
    assert.deepEqual(googleEvent("video_progress", { percent }, card), {
      name: "video_progress",
      params: { video_percent: percent },
    });
  // The mix is measured first-party; GA receives only the fixed parameters.
  assert.deepEqual(
    googleEvent("video_play", { mix: "b" }, card),
    googleEvent("video_play", {}, card),
  );
  assert.deepEqual(
    googleEvent("video_progress", { percent: 50, mix: "b" }, card),
    googleEvent("video_progress", { percent: 50 }, card),
  );
  assert.deepEqual(googleEvent("video_progress", { percent: 100 }, card), {
    name: "video_complete",
    params: { video_percent: 100 },
  });
  assert.deepEqual(googleEvent("buy_click", { path: "card" }, card), {
    name: "buy_click",
    params: { payment_route: "card" },
  });
  assert.deepEqual(googleEvent("buy_click", { path: "funded" }, funded), {
    name: "buy_click",
    params: { payment_route: "ar-efa", program: "ar-efa" },
  });
  assert.deepEqual(googleEvent("buy_click", { path: "card" }, funded), {
    name: "buy_click",
    params: { payment_route: "card", program: "ar-efa" },
  });
  // Buy inside the free trial says where it was pressed; still never a checkout.
  assert.deepEqual(
    googleEvent("buy_click", { path: "funded", from: "invite" }, funded),
    {
      name: "buy_click",
      params: {
        payment_route: "ar-efa",
        from: "trial-invite",
        program: "ar-efa",
      },
    },
  );
  assert.deepEqual(
    googleEvent("buy_click", { path: "card", from: "chrome" }, card),
    {
      name: "buy_click",
      params: { payment_route: "card", from: "trial-toolbar" },
    },
  );
  assert.deepEqual(
    googleEvent(
      "buy_click",
      { path: "card", from: "parent@example.test" },
      card,
    ),
    { name: "buy_click", params: { payment_route: "card" } },
  );
  assert.deepEqual(googleEvent("invite_view", { at: "map" }, card), {
    name: "invite_view",
    params: { invite_at: "map" },
  });
  assert.equal(googleEvent("invite_view", { at: "paywall" }, card), undefined);
  assert.deepEqual(googleEvent("try_click", undefined, funded), {
    name: "try_click",
    params: { program: "ar-efa" },
  });
  assert.deepEqual(googleEvent("workbook_click", {}, card), {
    name: "workbook_click",
    params: {},
  });
});

test("GA drops unlisted actions, out-of-range values and extra props", () => {
  const page = "https://amp.corpora.inc/?program=nh-efa";
  for (const [action, props] of [
    ["video_progress", { percent: 33 }],
    ["video_progress", { percent: "50" }],
    ["video_progress", {}],
    ["buy_click", { path: "parent@example.test" }],
    ["buy_click", {}],
  ] as const)
    assert.equal(googleEvent(action, props, page), undefined, action);
  // A click is never a purchase, and learning or account events never leave.
  for (const action of FUNNEL_EVENTS.filter(
    (name) =>
      ![
        "try_click",
        "workbook_click",
        "buy_click",
        "video_play",
        "video_progress",
        "plan_view",
        "plan_select",
        "checkout_start",
        "checkout_return",
      ].includes(name),
  ))
    assert.equal(googleEvent(action, {}, page), undefined, action);
  const leaky = googleEvent(
    "buy_click",
    { path: "card", email: "parent@example.test", learner: "private" },
    "https://amp.corpora.inc/?program=nh-efa&email=parent%40example.test",
  );
  assert.deepEqual(leaky, {
    name: "buy_click",
    params: { payment_route: "card", program: "nh-efa" },
  });
  assert.equal(googleEvent("checkout_start", {}, page)?.name, "begin_checkout");
});
