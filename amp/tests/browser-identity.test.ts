import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  createBrowserIdentity,
  type IdentityEnvironment,
} from "../src/analytics/browser-identity.js";
function fixture(hostname = "amp.corpora.inc", protocol = "https:") {
  const local = new Map<string, string>(),
    cookies = new Map<string, string>(),
    writes: string[] = [];
  const env: IdentityEnvironment = {
    hostname,
    protocol,
    storage: {
      getItem: (k) => local.get(k) ?? null,
      setItem: (k, v) => {
        local.set(k, v);
      },
    },
    readCookie: () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
    writeCookie: (s) => {
      writes.push(s);
      const [k, v] = s.split(";")[0].split("=");
      cookies.set(k, v);
    },
    randomUUID,
    now: () => 1000,
  };
  return { env, local, cookies, writes };
}
test("marketing and AMP share one first-party identity and staff marker", () => {
  const f = fixture("corpora.inc");
  const a = createBrowserIdentity(f.env),
    id = a.visitor();
  f.local.set("amp.analytics.traffic", "internal");
  assert.equal(a.internal(), true);
  const app = fixture();
  app.env.readCookie = f.env.readCookie;
  app.env.writeCookie = f.env.writeCookie;
  assert.equal(createBrowserIdentity(app.env).visitor(), id);
  assert.equal(createBrowserIdentity(app.env).internal(), true);
  assert.equal(app.local.get("amp.visitor"), id);
  assert.ok(
    f.writes.every(
      (v) =>
        v.includes("Secure; SameSite=Lax") && v.includes("Domain=corpora.inc"),
    ),
  );
});
test("legacy local identity is preserved when there is no shared identity", () => {
  const f = fixture(),
    id = randomUUID();
  f.local.set("amp.visitor", id);
  assert.equal(createBrowserIdentity(f.env).visitor(), id);
  assert.equal(f.cookies.get("amp_analytics_visitor"), id);
});
test("insecure and unrelated hosts cannot read or set the shared domain identity", () => {
  for (const [host, protocol] of [
    ["corpora.inc.attacker.test", "https:"],
    ["corpora.inc", "http:"],
    ["localhost", "http:"],
  ]) {
    const f = fixture(host, protocol),
      foreign = randomUUID();
    f.cookies.set("amp_analytics_visitor", foreign);
    assert.notEqual(createBrowserIdentity(f.env).visitor(), foreign);
    assert.equal(f.writes.length, 0);
  }
});
test("storage denial retains a stable document identity and invalid cookies are replaced", () => {
  const f = fixture();
  f.cookies.set("amp_analytics_visitor", "private@example.test");
  f.env.storage = {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  };
  f.env.writeCookie = () => {
    throw Error("denied");
  };
  const id = createBrowserIdentity(f.env);
  assert.equal(id.visitor(), id.visitor());
  assert.equal(id.internal(), false);
});

test("entry campaign context crosses origins before any collector response", () => {
  const marketing = fixture("corpora.inc"),
    app = fixture();
  app.env.readCookie = marketing.env.readCookie;
  app.env.writeCookie = marketing.env.writeCookie;
  const first = createBrowserIdentity(marketing.env).context({
    utmSource: "google",
    utmContent: "founder",
    referrer: "search",
    device: "phone",
  });
  const next = createBrowserIdentity(app.env).context({
    referrer: "internal",
    device: "phone",
  });
  assert.deepEqual(next, first);
  const broken = fixture();
  broken.cookies.set("amp_analytics_entry", "%broken");
  assert.deepEqual(
    createBrowserIdentity(broken.env).context({
      referrer: "direct",
      device: "phone",
    }),
    { referrer: "direct", device: "phone" },
  );
  // Invalid or unmatched records never leak raw storage to collection.
  const other = fixture();
  other.cookies.set(
    "amp_analytics_entry",
    encodeURIComponent(
      JSON.stringify({
        visitorId: randomUUID(),
        context: first,
        expiresAt: 86400000,
      }),
    ),
  );
  assert.equal(
    createBrowserIdentity(other.env).context({
      referrer: "direct",
      device: "desktop",
    }).utmSource,
    undefined,
  );
});

test("stored campaign context expires after ninety days without use", () => {
  const f = fixture(),
    identity = createBrowserIdentity(f.env);
  identity.context({
    utmSource: "google",
    referrer: "search",
    device: "phone",
  });
  f.env.now = () => 91 * 86400000;
  assert.equal(
    identity.context({ referrer: "direct", device: "phone" }).utmSource,
    undefined,
  );
});
