import test from "node:test";
import assert from "node:assert/strict";
import {
  socialCopy,
  socialCopyFor,
  socialErrorMessage,
} from "../src/web/features/auth/social-copy.js";

test("provider sign-in copy: about fifty complete languages", () => {
  const locales = Object.keys(socialCopy);
  assert.ok(locales.length >= 50, `${locales.length} languages`);
  const keys = Object.keys(socialCopy.en).sort();
  for (const locale of locales) {
    const copy = socialCopy[locale];
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const [key, text] of Object.entries(copy)) {
      assert.ok(text.trim() && text === text.trim(), `${locale}.${key}`);
      // Every message names the provider except the generic ones.
      const named = !["orEmail", "cancelled"].includes(key);
      assert.equal(text.includes("{provider}"), named, `${locale}.${key}`);
      if (locale !== "en")
        assert.notEqual(
          text,
          socialCopy.en[key as keyof typeof copy],
          `${locale}.${key} translated`,
        );
    }
  }
});

test("provider sign-in copy follows the page language", () => {
  assert.equal(socialCopyFor("es-MX"), socialCopy.es);
  assert.equal(socialCopyFor("pt-BR"), socialCopy.pt);
  assert.equal(socialCopyFor("zh-TW"), socialCopy["zh-Hant"]);
  assert.equal(socialCopyFor("zh-Hans-CN"), socialCopy["zh-Hans"]);
  assert.equal(socialCopyFor("zh"), socialCopy["zh-Hans"]);
  assert.equal(socialCopyFor("no"), socialCopy.nb);
  assert.equal(socialCopyFor("xx"), socialCopy.en);
  assert.equal(socialCopyFor(""), socialCopy.en);
});

test("provider callback errors explain what happened and what to do", () => {
  const en = socialCopy.en;
  assert.match(socialErrorMessage(en, "access_denied", "Google"), /cancelled/);
  assert.match(
    socialErrorMessage(en, "user_cancelled_authorize", "Apple"),
    /cancelled/,
  );
  assert.match(
    socialErrorMessage(en, "provider_email_unverified", "GitHub"),
    /^GitHub did not confirm/,
  );
  assert.match(
    socialErrorMessage(en, "account_not_linked", "Microsoft"),
    /link Microsoft in Security/,
  );
  assert.match(
    socialErrorMessage(en, "unable_to_link_account", "Google"),
    /link Google in Security/,
  );
  assert.equal(
    socialErrorMessage(en, "invalid_code", "Apple"),
    "Apple sign-in did not finish. Try again.",
  );
});
