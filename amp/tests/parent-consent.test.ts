import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  ConsentSecrets,
  digest,
  noticeDigest,
  tokenMatches,
} from "../src/parent-consent/crypto.js";
import {
  consentPolicySchema,
  beginConsentSchema,
} from "../src/parent-consent/contracts.js";
import { consentMail } from "../src/parent-consent/mail.js";
import { consentFixture as p } from "./parent-consent.fixture.js";
test("consent secrets bind challenge to account, address, stage and notice; recipient encryption authenticates request", () => {
  const s = new ConsentSecrets(randomBytes(32)),
    b = {
      id: "request",
      account: "parent",
      nonce: "random",
      emailHash: s.addressHash("parent@example.com"),
      noticeHash: noticeDigest(p),
    };
  const token = s.token(b, "initial");
  assert.equal(token.length, 43);
  assert(tokenMatches(token, s.token(b, "initial")));
  for (const changed of [
    { ...b, id: "other" },
    { ...b, account: "other" },
    { ...b, emailHash: "other" },
    { ...b, noticeHash: "other" },
  ])
    assert(!tokenMatches(token, s.token(changed, "initial")));
  assert(!tokenMatches(token, s.token(b, "confirmation")));
  assert(!tokenMatches(token, "short"));
  const encrypted = s.encrypt("parent@example.com", b.id);
  assert(!encrypted.includes("parent"));
  assert.equal(s.decrypt(encrypted, b.id), "parent@example.com");
  assert.throws(() => s.decrypt(encrypted, "other"));
  assert.throws(() => new ConsentSecrets(Buffer.alloc(16)));
  assert.equal(digest({ b: 1, a: 2 }), digest({ a: 2, b: 1 }));
});
test("notice and eligibility contract reject disclosure, incomplete operational contact and inadequate delay", () => {
  assert(consentPolicySchema.safeParse(p).success);
  assert(
    !consentPolicySchema.safeParse({
      ...p,
      review: { ...p.review, noDisclosureUnder312_2: false },
    }).success,
  );
  assert(
    !consentPolicySchema.safeParse({
      ...p,
      notice: {
        ...p.notice,
        operator: { ...p.notice.operator, telephone: "" },
      },
    }).success,
  );
  assert(
    !consentPolicySchema.safeParse({ ...p, confirmationDelayHours: 0 }).success,
  );
  assert(
    !beginConsentSchema.safeParse({
      email: "parent@example.com",
      requestId: "bad",
      noticeDigest: noticeDigest(p),
      parentAttestation: false,
    }).success,
  );
});
test("full notice repeats in both messages and challenge is only a URL fragment", () => {
  for (const stage of ["initial", "confirmation"] as const) {
    const m = consentMail(p, {
      id: "fixture",
      recipient: "parent@example.com",
      stage,
      token: "private-token",
      idempotencyKey: "send",
      noticeHash: noticeDigest(p),
    });
    assert(m.text.includes(p.notice.operator.telephone));
    assert(m.text.includes(p.notice.childData[0]!.retention));
    assert(m.text.includes("revoke consent"));
    assert(m.text.includes("Opening the link does not grant consent"));
    const link = m.text.match(/Review and respond: (\S+)/)![1]!,
      url = new URL(link);
    assert(!url.search);
    assert(url.hash.includes("private-token"));
    assert(!url.origin.includes("private-token"));
  }
});

test("consent fragments are removed before any response and invalid fragments do not become authority", async () => {
  const { takeConsentChallenge } = await import("../src/web/consent-link.js");
  let replaced = "";
  const history = {
    replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
      replaced = String(url);
    },
  };
  const valid = takeConsentChallenge(
    {
      hash:
        "#consent=11111111-1111-4111-8111-111111111111&stage=initial&token=" +
        "a".repeat(43) +
        "&notice=" +
        "b".repeat(64),
      pathname: "/",
      search: "?screen=parent",
    },
    history,
  );
  assert(valid);
  assert.equal(replaced, "/?screen=parent");
  assert(!replaced.includes("token"));
  assert.equal(
    takeConsentChallenge(
      { hash: "#consent=bad&token=private", pathname: "/", search: "" },
      history,
    ),
    null,
  );
  assert.equal(replaced, "/");
});
