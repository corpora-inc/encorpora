/** Isolated purchase recovery: fake Stripe, synthetic accounts and undelivered mail. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type BrowserContext } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
const fixture = await purchasePreview(4992);
const { origin } = fixture;
const browser = await secureChromium(rawChromium).launch();
const output = "/tmp/rebuild-funded-purchase/purchase-recovery";
await mkdir(output, { recursive: true });
async function login(context: BrowserContext, email: string) {
  const r = await context.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { origin },
    data: { email, password: fixture.password },
  });
  assert.equal(r.status(), 200);
}
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/purchase/arizona-esa");
  await page.getByLabel("Student name on invoice").fill("New Casey");
  await page
    .getByLabel("Your email")
    .fill("new-family@purchase-preview.example");
  await page.getByRole("radio", { name: /Monthly/ }).click();
  await page.getByRole("button", { name: "Get invoice", exact: true }).click();
  const pdf = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download invoice PDF" }).click();
  assert.equal(await (await pdf).failure(), null);
  const create = page.getByRole("link", {
    name: "Create account & start learning",
  });
  assert.match((await create.getAttribute("href"))!, /return=arizona-esa/);
  await page.screenshot({
    path: `${output}/guest-invoice-390.png`,
    fullPage: true,
  });
  await create.click();
  await page.waitForURL(/\/sign-up\?/);
  // Synthetic completion of email signup/verification. The invoice is matched
  // only after this account proves ownership of the address used on it.
  const signup = await fixture.app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: { origin },
    payload: {
      email: "new-family@purchase-preview.example",
      password: fixture.password,
      name: "Sample Parent",
    },
  });
  assert.equal(signup.statusCode, 200);
  await fixture.db.query(
    'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
    [signup.json().user.id],
  );
  await login(context, "new-family@purchase-preview.example");
  await page.goto(origin + "/purchase/arizona-esa");
  await page.getByRole("link", { name: "Set up learner", exact: true }).click();
  await page.getByLabel("Learner name").fill("New Casey");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "2016", exact: true }).click();
  await page.waitForURL(/\/purchase\/funded/);
  const me = await (await context.request.get(origin + "/api/v1/me")).json();
  const child = me.learners[0];
  assert.ok(child?.id);
  const invoice = page.locator("article").filter({
    has: page.getByRole("heading", { name: "New Casey", exact: true }),
  });
  const batches: string[] = [];
  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (response.ok() && /\/learners\/[^/]+\/batches$/.test(path))
      batches.push(path.split("/").at(-2)!);
  });
  const invoiceUrl = page.url();
  await invoice
    .getByRole("button", { name: "Start learning", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
    true,
  );
  assert.equal(
    await page.evaluate(() => history.state.ampFamilyPractice?.learnerId),
    child.id,
  );
  assert.ok(batches.length > 0 && batches.every((id) => id === child.id));
  await page.screenshot({
    path: `${output}/invoice-to-practice-390.png`,
    fullPage: true,
  });
  await page.goBack();
  await page.waitForURL(invoiceUrl);
  await page
    .getByRole("button", { name: "Download invoice", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
    false,
  );
  await page.goForward();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
    true,
  );
  assert.equal(
    await page.evaluate(() => history.state.ampFamilyPractice?.learnerId),
    child.id,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .waitFor();
  assert.equal(
    await page.evaluate(() => history.state.ampFamilyPractice?.learnerId),
    child.id,
  );
  assert.ok(batches.length >= 3 && batches.every((id) => id === child.id));
  await page.goBack();
  await page.waitForURL(invoiceUrl);
  await page
    .getByRole("button", { name: "Download invoice", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(() => !!sessionStorage.getItem("amp.student")),
    false,
  );

  // A real account replacement must still leave the former buyer's purchase
  // view. This uses a new checked cookie session, with the same event emitted
  // by sign-in in another tab; there is no in-memory pretend identity.
  await page.getByLabel("Student name on invoice").fill("Private draft");
  await context.request.post(`${origin}/api/auth/sign-out`, {
    headers: { origin },
    data: {},
  });
  await login(
    context,
    fixture.personas.find((p) => p.key === "invoice")!.email,
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("amp-account-session-changed")),
  );
  await page.waitForURL((url) => !url.pathname.startsWith("/purchase"));
  assert.equal(await page.locator('input[value="Private draft"]').count(), 0);
  await page.goto(origin + "/purchase/funded");
  await page.getByLabel("Student name on invoice").fill("Signed-out draft");
  await context.request.post(`${origin}/api/auth/sign-out`, {
    headers: { origin },
    data: {},
  });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("amp-account-session-changed")),
  );
  await page.waitForURL((url) => !url.pathname.startsWith("/purchase"));
  assert.equal(
    await page.locator('input[value="Signed-out draft"]').count(),
    0,
  );
  assert.deepEqual(errors, []);
  await context.close();
  console.log(
    "PASS guest invoice → signup return → learner setup → recovered invoice → child practice → Back/Forward/reload; purchase account switch and sign-out.",
  );

  // Both enrollment (no recorded purchase consent) and a normal child purchase
  // may change plans after leaving an unpaid Stripe checkout.
  for (const kind of ["enrollment", "learner"] as const) {
    const persona = fixture.personas.find(
      (p) => p.key === (kind === "enrollment" ? "returning" : "paid"),
    )!;
    let learnerId = persona.learnerId;
    if (kind === "learner") {
      const created = await fixture.app.inject({
        method: "POST",
        url: "/api/v1/learners",
        headers: { origin, authorization: `Bearer ${persona.token}` },
        payload: { name: "Plan Switch", birthYear: 2016 },
      });
      assert.equal(created.statusCode, 201, created.body);
      learnerId = created.json().id;
    }
    const c = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await login(c, persona.email);
    const p = await c.newPage();
    p.setDefaultTimeout(20000);
    const path = `/continue/${learnerId}`;
    await p.goto(origin + path);
    await p
      .getByRole("button", { name: "Continue to Stripe", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Test checkout", exact: true })
      .waitFor();
    const first = new URL(p.url()).searchParams.get("id");
    assert.ok(first);
    await p.goBack();
    await p.getByRole("radio", { name: /Monthly/ }).click();
    await p
      .getByRole("button", { name: "Continue to Stripe", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Test checkout", exact: true })
      .waitFor();
    const second = new URL(p.url()).searchParams.get("id");
    assert.notEqual(second, first);
    await p.goBack();
    await p.getByRole("radio", { name: /Annual/ }).click();
    await p
      .getByRole("button", { name: "Continue to Stripe", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Test checkout", exact: true })
      .waitFor();
    const third = new URL(p.url()).searchParams.get("id");
    assert.notEqual(third, first);
    assert.notEqual(third, second);
    const rows = await fixture.db.query(
      "SELECT billing_interval,closed FROM amp_stripe_checkouts WHERE account_id=$1 AND learner_id IS NOT DISTINCT FROM $2 ORDER BY created_at",
      [persona.accountId, kind === "learner" ? learnerId : null],
    );
    assert.deepEqual(
      rows.rows.map((r) => [r.billing_interval, r.closed]),
      [
        ["year", true],
        ["month", true],
        ["year", false],
      ],
    );
    await c.close();
    console.log(
      `PASS ${kind} checkout: year → month → year creates one open payment session.`,
    );
  }
} finally {
  await browser.close();
  await fixture.close();
}
