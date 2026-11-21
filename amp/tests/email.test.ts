/**
 * The central email check (founder, 2026-11-17: every email has an attractive
 * HTML version). Every email AMP sends is in scripts/email-previews.ts, and
 * every provider call is one of the transports below; both lists are
 * enforced, so a new email or a new send path without HTML fails here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  EMAIL_COLORS,
  EMAIL_MARK_PATH,
  EMAIL_TOKENS,
  linkedEmail,
  renderEmail,
  retryPayload,
  signUpCodeEmail,
  type Email,
} from "../src/email/email.js";
import { accountEmailSender } from "../src/server/accounts.js";
import { ResendConsentTransport } from "../src/parent-consent/resend.js";
import { resendTransport } from "../src/parent-followup/worker.js";
import { followupMail } from "../src/parent-followup/mail.js";
import { emailPreviews } from "../scripts/email-previews.js";

const root = new URL("../", import.meta.url).pathname;
const sources = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory())
      return name === "node_modules" || name === "__tests__"
        ? []
        : sources(path);
    return /\.(ts|tsx|mts|mjs)$/.test(name) ? [path] : [];
  });
const files = [...sources("src"), ...sources("scripts")];
const read = (path: string) => readFileSync(join(root, path), "utf8");

const sample = {
  subject: "Confirm your email for AMP",
  text: "Confirm this address.",
  url: "https://amp.example/verify?t=synthetic",
  action: "Confirm email",
};

/** Each provider call site, and the test below that proves it sends both. */
const TRANSPORTS = [
  "src/parent-consent/resend.ts",
  "src/parent-followup/worker.ts",
  "src/server/accounts.ts",
];

test("every provider call is a known transport", () => {
  const callers = files.filter((path) =>
    /\.emails\.send\(|api\.resend\.com\/emails/.test(read(path)),
  );
  assert.deepEqual(
    callers.sort(),
    TRANSPORTS,
    "A new send path must pass both parts and be exercised in this file",
  );
});

test("every email composer has a preview", () => {
  const previews = read("scripts/email-previews.ts");
  const composers = files.filter(
    (path) =>
      path !== "src/email/email.ts" &&
      path.startsWith("src/") &&
      /\): LinkedMessage \{|\brenderEmail\(|\baccountEmail\(/.test(read(path)),
  );
  assert.ok(composers.length >= 10, composers.join(", "));
  for (const path of composers) {
    const module = relative("scripts", path).replace(/\.tsx?$/, ".js");
    assert.ok(
      previews.includes(`"${module}"`),
      `${path} composes email; add it to scripts/email-previews.ts`,
    );
  }
});

const hrefs = (html: string) =>
  [...html.matchAll(/href="([^"]*)"/g)].map((m) =>
    m[1]!.replace(/&amp;/g, "&"),
  );

test("every email has both parts, in the branded layout", () => {
  const previews = emailPreviews();
  assert.equal(new Set(previews.map((p) => p.id)).size, previews.length);
  for (const { id, email } of previews) {
    const { subject, html, text } = email;
    assert.ok(subject && !/[\r\n]/.test(subject), id);
    assert.ok(text.trim(), `${id}: plain text`);
    assert.doesNotMatch(
      text,
      /<\/?(?:a|p|br|div|span|table|td|tr|img|html|body|ul|li|h1)\b[^@>]*>/i,
      `${id}: tags in plain text`,
    );
    assert.ok(html.startsWith("<!doctype html>"), `${id}: html`);
    // Mail-client safe: no script, no external CSS, no web fonts.
    assert.doesNotMatch(html, /<script|<link|@import|url\(/i, id);
    assert.match(html, /role="presentation"/, `${id}: table layout`);
    assert.match(html, /max-width:600px/, `${id}: 600 px column`);
    assert.match(html, /prefers-color-scheme:dark/, `${id}: dark mode`);
    // One image, the AMP mark from the AMP origin, with alt text; nothing
    // else that loads, so nothing that measures the reader.
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(images.length, 1, `${id}: images`);
    assert.match(images[0]!, /alt="AMP"/);
    assert.match(
      images[0]!,
      new RegExp(`src="https://amp\\.corpora\\.inc${EMAIL_MARK_PATH}"`),
    );
    for (const href of hrefs(html))
      assert.match(href, /^(https:|http:|mailto:)/, `${id}: ${href}`);
    // Every link and address in the text is in the HTML, unchanged.
    for (const url of text.match(/https?:\/\/\S+/g) ?? [])
      assert.ok(
        hrefs(html).includes(url.replace(/[.,;:)]+$/, "")),
        `${id}: ${url}`,
      );
    for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [])
      assert.ok(html.includes(`>${address}<`), `${id}: ${address} shown`);
  }
});

test("both parts come from the same blocks", () => {
  const email = renderEmail({
    origin: "https://amp.example",
    subject: "Subject",
    body: [
      "One\ntwo",
      "",
      { button: { label: "Go", url: "https://amp.example/go" }, lead: "Go:" },
      {
        link: { label: "Stop optional emails", url: "https://amp.example/x" },
        lead: "You asked for these. Stop optional emails:",
      },
      { lines: ["A", "B"] },
      { list: ["x", "y"] },
      { code: "123456" },
    ],
    footer: ["Write to help@example.com."],
  });
  assert.equal(
    email.text,
    "One\ntwo\n\n\n\nGo:\nhttps://amp.example/go\n\nYou asked for these. Stop optional emails:\nhttps://amp.example/x\n\nA\nB\n\n- x\n\n- y\n\n123456\n\nWrite to help@example.com.",
  );
  // A lead that only repeats the label is not shown twice; one that ends
  // with it runs into the link.
  assert.doesNotMatch(email.html, />Go:</);
  assert.match(email.html, /You asked for these\. <a [^>]*>Stop optional/);
  assert.match(email.html, /One<br>two/);
  assert.match(email.html, /<li[^>]*>x<\/li>/);
  assert.match(email.html, /href="mailto:help@example.com"[^>]*>help@/);
});

test("content is escaped, and only web links become links", () => {
  const email = linkedEmail("https://amp.example", {
    subject: "Inquiry: <b>",
    text: `<script>alert(1)</script> & "quotes" javascript:alert(1)`,
    url: "https://amp.example/schools",
    action: "Open",
  });
  assert.doesNotMatch(email.html, /<script>|<b>/);
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp;/);
  assert.ok(!hrefs(email.html).some((h) => h.startsWith("javascript")));
  assert.throws(() =>
    linkedEmail("https://amp.example", {
      subject: "S",
      text: "T",
      url: "javascript:alert(1)",
      action: "Open",
    }),
  );
});

test("the layout's colours are AMP's role tokens", () => {
  const css = read("src/web/ui/tokens.css");
  const block = (start: string) => {
    const from = css.indexOf(start);
    return css.slice(from, css.indexOf("}", from));
  };
  const themes = {
    light: block(":root {"),
    dark: block(':root[data-theme="dark"]:not([data-look="bold"]) {'),
  };
  for (const [role, names] of Object.entries(EMAIL_TOKENS))
    for (const theme of ["light", "dark"] as const) {
      const value = new RegExp(
        `--color-${names[theme]}:\\s*(#[0-9a-f]+);`,
      ).exec(themes[theme])?.[1];
      assert.equal(
        EMAIL_COLORS[theme][role as keyof typeof EMAIL_TOKENS],
        value,
        `${theme} ${role} is --color-${names[theme]}`,
      );
    }
});

test("the sign-up code email shows the code and needs no link", () => {
  const email = signUpCodeEmail({
    code: "428193",
    origin: "https://amp.example",
    expiresInMinutes: 10,
  });
  assert.equal(email.subject, "428193 is your AMP sign-up code");
  assert.match(email.text, /^Enter this code.*\n\n428193\n\n/);
  assert.match(email.text, /expires in 10 minutes/);
  assert.match(email.html, /font-size:34px[^>]*user-select:all;">428193</);
  assert.equal(hrefs(email.html).length, 0);
  for (const code of ["12345", "1234567", "abcdef", "12 456"])
    assert.throws(() =>
      signUpCodeEmail({ code, origin: "https://amp.example" }),
    );
});

test("a retry first sent without HTML resends exactly that payload", () => {
  const mail = { ...linkedEmail("https://amp.example", sample), key: "k" };
  const { html: _html, ...legacy } = mail;
  const bound = (binding: unknown) => (payload: unknown) =>
    JSON.stringify(payload) === JSON.stringify(binding);
  assert.equal(
    retryPayload(mail, () => false),
    mail,
  );
  assert.equal(retryPayload(mail, bound(mail)), mail);
  assert.deepEqual(retryPayload(mail, bound(legacy)), legacy);
});

/** Runs `send` with Resend's API answered here; returns the request body. */
async function captured(send: () => Promise<unknown>) {
  const originalFetch = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    assert.equal(url, "https://api.resend.com/emails");
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ id: randomUUID() });
  };
  try {
    await send();
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(bodies.length, 1);
  return bodies[0]!;
}

function hasBothParts(body: Record<string, unknown>, email: Email) {
  assert.equal(body.subject, email.subject);
  assert.equal(body.html, email.html);
  assert.equal(body.text, email.text);
  assert.ok(String(body.html).startsWith("<!doctype html>"));
}

test("account mail sends both parts and refuses a message missing one", async () => {
  const send = accountEmailSender({
    production: true,
    mail: { apiKey: "re_synthetic_test_key", from: "AMP <amp@example.com>" },
  });
  const email = linkedEmail("https://amp.example", sample);
  hasBothParts(await captured(() => send("parent@example.com", email)), email);
  await assert.rejects(
    send("parent@example.com", { ...email, html: "" }),
    /both its HTML and plain-text parts/,
  );
});

test("consent and funding mail sends both parts", async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const transport = new ResendConsentTransport({
      apiKey: "re_synthetic_credential_for_tests",
      sender: "notice@example.com",
    });
    const email = linkedEmail("https://amp.example", sample);
    const mail = {
      idempotencyKey: "amp-consent:synthetic",
      recipient: "parent@example.com",
      ...email,
    };
    hasBothParts(
      await captured(() =>
        transport.send(mail, { signal: new AbortController().signal }),
      ),
      email,
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("follow-up mail sends both parts", async () => {
  const config = {
    origin: "https://amp.example",
    sender: "AMP <hello@example.com>",
    postalAddress: "100 Example Street",
    apiKey: "re_synthetic_followup_key",
  };
  const mail = followupMail(config, {
    email: "parent@example.com",
    program: null,
    token: "synthetic-token",
    stage: "welcome",
    hasPlace: false,
  });
  hasBothParts(
    await captured(() => resendTransport(config)(mail, "synthetic-id")),
    mail,
  );
});
