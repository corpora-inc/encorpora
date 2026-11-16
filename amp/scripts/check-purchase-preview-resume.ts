/** A preview restart preserves synthetic IDs, allowance, workbooks and payment sessions. */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { purchasePreview } from "./purchase-preview-fixture";
import { Pool } from "pg";

const directory = await mkdtemp(join(tmpdir(), "amp-preview-resume-"));
const stateFile = join(directory, "state.json");
const schema = process.env.AMP_PREVIEW_RESUME_TEST_SCHEMA;
const port = Number(process.env.AMP_PREVIEW_RESUME_TEST_PORT ?? 5032);
let fixture: Awaited<ReturnType<typeof purchasePreview>> | undefined;
const browser = await secureChromium(rawChromium).launch();
let testSchema: string | undefined;
try {
  fixture = await purchasePreview(port, { stateFile, schema });
  testSchema = fixture.schema;
  const snapshot = async () => ({
    learners: (
      await fixture!.db.query(
        "SELECT id,account_id,name,birth_year,free_online_used,free_workbooks_used FROM amp_learners ORDER BY id",
      )
    ).rows,
    workbooks: (
      await fixture!.db.query(
        "SELECT id,learner_id,number,minutes,code,spec FROM amp_workbooks ORDER BY id",
      )
    ).rows,
    attempts: (
      await fixture!.db.query("SELECT count(*)::int AS n FROM amp_attempts")
    ).rows[0].n,
    requests: (
      await fixture!.db.query(
        "SELECT id,status FROM amp_funding_requests ORDER BY id",
      )
    ).rows,
  });
  const before = await snapshot();
  const context = await browser.newContext();
  const login = await context.request.post(
    fixture.origin + "/api/auth/sign-up/email",
    {
      headers: { origin: fixture.origin },
      data: {
        email: `resume-${randomUUID()}@purchase-preview.example`,
        password: fixture.password,
        name: "Preview restart",
      },
    },
  );
  assert.equal(login.status(), 200);
  const accountId = `amp|${(await login.json()).user.id}`;
  // Open an abandoned checkout before restarting, using the installed notice.
  const policy = (
    await fixture.db.query(
      "SELECT notice_digest FROM amp_consent_policy WHERE singleton",
    )
  ).rows[0];
  assert.ok(policy);
  await fixture.billing.checkout(accountId, null, randomUUID(), "month", {
    noticeDigest: policy.notice_digest,
    parentAttestation: true,
  });
  const checkout = (
    await fixture.db.query(
      "SELECT id,session_id FROM amp_stripe_checkouts WHERE account_id=$1 AND subscription_id IS NULL ORDER BY created_at DESC LIMIT 1",
      [accountId],
    )
  ).rows[0];
  assert.ok(checkout);
  await fixture.close();
  fixture = undefined;
  fixture = await purchasePreview(port, { stateFile });
  assert.deepEqual(await snapshot(), before);
  const session = await context.request.get(
    fixture.origin + "/api/auth/get-session",
  );
  assert.equal(session.status(), 200);
  assert.ok(
    (await session.json())?.user,
    "The existing signed-in browser survives the restart",
  );
  // The simulated payment remains usable and creates the expected receipt.
  await fixture.settle(checkout.id);
  assert.ok(
    (
      await fixture.db.query(
        "SELECT invoice_id FROM amp_payment_records WHERE checkout_id=$1",
        [checkout.id],
      )
    ).rowCount,
  );
  assert.deepEqual((await snapshot()).learners, before.learners);
  console.log(
    "PASS preview restart: same learner IDs, names, birth years, allowances, workbooks, attempts and funded requests; browser cookie survives; abandoned checkout settles after restart.",
  );
  const page = await context.newPage();
  await page.goto(fixture.origin + "/start/parent");
  await page.getByRole("textbox", { name: /Name, Child 1/ }).fill("Morgan");
  await page
    .getByRole("button", { name: "Birth year, Morgan", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Birth year, Morgan", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Earlier year…", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Birth year", exact: true })
    .fill("1950");
  await page
    .getByRole("button", { name: "Use this year", exact: true })
    .click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForURL("**/practice", { timeout: 30000 });
  const learner = (
    await fixture.db.query(
      "SELECT name,birth_year FROM amp_learners WHERE account_id=$1 AND name='Morgan'",
      [accountId],
    )
  ).rows[0];
  assert.deepEqual(learner, { name: "Morgan", birth_year: 1950 });
  const secondParent = await context.request.get(
    fixture.origin + "/api/v1/family/second-parent",
    {
      headers: {
        authorization: `Bearer ${(await session.json()).session.token}`,
      },
    },
  );
  assert.equal(secondParent.status(), 200);
  console.log(
    "PASS parent setup: Morgan names the year picker, Earlier year accepts 1950, Next preserves the exact year and enters practice; second-parent endpoint returns 200.",
  );
} finally {
  await browser.close();
  await fixture?.close();
  // Explicitly disposable: the caller supplies only a cloned schema here.
  if (!schema && testSchema) {
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
    });
    await admin.query(`DROP SCHEMA ${testSchema} CASCADE`);
    await admin.end();
  }
  await rm(directory, { recursive: true, force: true });
}
