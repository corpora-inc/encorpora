/** Loopback-only purchase preview. Real AMP routes and PDFs, disposable accounts,
 * synthetic payment verification and an undelivered mail outbox. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "../src/server/accounts";
import { refuseStudentTokens } from "../src/server/auth";
import { FamilyRepository } from "../src/family/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { registerParentFollowupRoutes } from "../src/parent-followup/routes";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes";
import { registerPaymentEvidenceRoutes } from "../src/billing/evidence/routes";
import { registerConsentRoutes } from "../src/parent-consent/routes";
import { registerSchoolRoutes } from "../src/schools/routes";
import { ConsentRepository } from "../src/parent-consent/repository";
import { ConsentSecrets, noticeDigest } from "../src/parent-consent/crypto";
import { installConsentPolicy } from "../src/parent-consent/policy";
import { consentFixture } from "../tests/parent-consent.fixture";
import { testFundingOffer } from "../tests/funding-purchase.fixture";
import {
  config as base,
  payment as basePayment,
} from "../tests/stripe-fixtures";
import { syntheticDocumentProfile } from "../tests/payment-evidence-fixtures";
import { StripeGateway } from "../src/billing/stripe/gateway";
import { stripeNamespace } from "../src/billing/stripe/config";
import { registerStripeRoutes } from "../src/billing/stripe/routes";
import type { AnnualPayment } from "../src/billing/stripe/model";
import { claimEnrollment } from "../src/billing/stripe/enrollment";
import { migrate } from "./migrate";
import { previewState, type PreviewSession } from "./purchase-preview-state";
import { assertTestDatabaseTarget } from "./test-database-preflight";

export async function purchasePreview(
  port = 4980,
  options: {
    /** An existing synthetic schema, copied before replacing an old preview. */
    schema?: string;
    /** Private absolute path; persists secrets and simulated gateway state. */
    stateFile?: string;
  } = {},
) {
  const url = process.env.AMP_TEST_DATABASE_URL;
  assert.ok(url);
  assertTestDatabaseTarget(url);
  const origin = `http://127.0.0.1:${port}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const saved = await previewState(options.stateFile, options.schema);
  const { state } = saved;
  const schema = state.schema;
  const resuming = !!(
    await admin.query("SELECT to_regnamespace($1) AS found", [schema])
  ).rows[0].found;
  if (!resuming) {
    if (saved.existed || options.schema)
      throw new Error(
        "The saved preview schema is missing; restore its snapshot before restarting.",
      );
    await admin.query(`CREATE SCHEMA ${schema}`);
  }
  await saved.persist();
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  const repository = new PostgresRepository(scoped.href);
  const db = repository.pool;
  const accounts = await createAccounts(
    db,
    accountsConfiguration({
      AMP_ACCOUNTS_URL: origin,
      AMP_ACCOUNTS_SECRET: state.accountsSecret,
      NODE_ENV: "development",
      AMP_PARENT_FOLLOWUP: "enabled",
    } as NodeJS.ProcessEnv),
  );
  const authenticate = refuseStudentTokens(accountsAuth(accounts));
  const policy = {
    ...consentFixture,
    review: { ...consentFixture.review, paymentNotificationsReviewed: true },
    notice: {
      ...consentFixture.notice,
      version: base.consentPolicyVersion,
      operator: { ...consentFixture.notice.operator, name: "Corpora Inc" },
      processors: [
        ...consentFixture.notice.processors,
        {
          name: "Resend",
          service: "Email",
          data: "Invoice",
          purpose: "Requested delivery",
          retention: "Limited",
        },
      ],
    },
  };
  await installConsentPolicy(db, policy);
  const config = {
    ...base,
    appOrigin: origin,
    amountMinor: 59900,
    documentProfile: {
      ...syntheticDocumentProfile,
      unitAmountMinor: 59900,
      product: {
        title: "AMP Mathematics · Annual",
        description: "One learner · 12 months",
      },
    },
    monthlyPriceId: "price_monthly",
    monthlyAmountMinor: 5900,
    monthlyDocumentProfile: {
      ...syntheticDocumentProfile,
      priceId: "price_monthly",
      unitAmountMinor: 5900,
      product: {
        title: "AMP Mathematics · Monthly",
        description: "One learner · 1 month",
      },
    },
  };
  const gateway = new StripeGateway(config);
  const payments = new Map<string, AnnualPayment>(state.payments);
  const sessions = new Map<string, PreviewSession>(state.sessions);
  // Import an older fixture's settled payments and checkout states from its
  // database. The private state file carries future simulated gateway writes.
  for (const row of (
    await db.query("SELECT invoice_id,payment FROM amp_account_entitlements")
  ).rows)
    payments.set(row.invoice_id, row.payment);
  for (const row of (
    await db.query(
      "SELECT id,session_id,session_url,subscription_id,closed FROM amp_stripe_checkouts WHERE session_id IS NOT NULL",
    )
  ).rows) {
    if (sessions.has(row.session_id)) continue;
    sessions.set(
      row.session_id,
      row.subscription_id
        ? { status: "complete", subscriptionId: row.subscription_id, url: null }
        : row.closed
          ? { status: "expired", url: null }
          : {
              status: "open",
              url:
                row.session_url ??
                `https://checkout.stripe.com/c/pay/amp_preview_${row.id}`,
            },
    );
  }
  const persistGateway = () => {
    state.payments = [...payments];
    state.sessions = [...sessions];
    return saved.persist();
  };
  await persistGateway();
  gateway.verifyMerchant =
    gateway.verifyCatalog =
    gateway.verifyPortal =
      async () => {};
  gateway.createCustomer = async (id) => `cus_${id}`;
  gateway.createCheckout = async (id) => {
    const url = `https://checkout.stripe.com/c/pay/amp_preview_${id}`;
    sessions.set(`cs_${id}`, { status: "open", url });
    await persistGateway();
    return { id: `cs_${id}`, url };
  };
  gateway.checkoutStatus = async (id) => sessions.get(id)!;
  gateway.expireCheckout = async (id) => {
    const session = sessions.get(id);
    assert.equal(session?.status, "open");
    assert.equal(session.subscriptionId, undefined);
    sessions.set(id, { status: "expired", url: null });
    await persistGateway();
  };
  gateway.annualPayment = async (id) => {
    const p = payments.get(id);
    assert.ok(p);
    return {
      ...p,
      financial: {
        kind: "verified",
        observation: {
          invoiceReason: "subscription_create",
          preTaxMinor: p.subtotal,
          paidMinor: p.paid,
          currency: "usd",
          tax: [],
          refunds: [],
          paymentMethod: p.paymentMethod,
        },
      },
      refunded: false,
      partialRefund: false,
    } as Awaited<ReturnType<StripeGateway["annualPayment"]>>;
  };
  gateway.client.subscriptions.retrieve = async (id) => {
    const p = [...payments.values()].find((p) => p.subscriptionId === id)!;
    return {
      id,
      livemode: false,
      customer: p.customerId,
      metadata: { amp_checkout_id: p.checkoutId },
      status: "active",
    } as never;
  };
  gateway.portal = async () =>
    "https://billing.stripe.com/p/session/amp_preview";
  const app = buildApp({ repository, authenticate, publicUrl: origin });
  await registerAccountRoutes(app, accounts, authenticate);
  await registerFamilyRoutes(app, {
    pool: db,
    authenticate,
    billingConfig: config,
    billingNamespace: stripeNamespace(config),
    approvals: {
      secret: state.approvalsSecret,
      origin,
      // Preview delivery stays local; no invitation leaves the fixture.
      mail: async () => {},
    },
  });
  await registerSchoolRoutes(app, {
    pool: db,
    authenticate,
    services: {
      secret: state.schoolSecret,
      origin,
      learning: repository,
    },
  });
  await registerParentFollowupRoutes(app, {
    pool: db,
    authenticate,
    origin,
    enabled: true,
  });
  const programs = [
    ["ar-efa", "AR", "Arkansas Education Freedom Account"],
    ["az-esa", "AZ", "Arizona Empowerment Scholarship Account"],
    ["nh-efa", "NH", "New Hampshire Education Freedom Account"],
  ];
  const offers = programs.flatMap(([programId, jurisdiction, programName]) =>
    ([12, 1] as const).map((termMonths) => ({
      ...testFundingOffer,
      id: `${programId}-${termMonths}`,
      programId: programId!,
      jurisdiction: jurisdiction!,
      programName: programName!,
      termMonths,
      termPolicy:
        termMonths === 12
          ? ("twelve-months-from-verified-provisioning" as const)
          : ("one-month-from-verified-provisioning" as const),
      subtotalMinor: termMonths === 12 ? 59900 : 5900,
      productTitle: `AMP Mathematics · ${termMonths === 12 ? "annual" : "monthly"} learner license`,
      productDescription:
        "Adaptive math practice, lessons and printable workbooks for one learner.",
      documentPolicy: "named-student-invoice" as const,
      route: "direct-pay" as const,
      activationPolicy: "after-settlement" as const,
      destinationUrl: "https://app.classwallet.com",
      instructions:
        "In ClassWallet choose Pay Vendor, select Corpora Inc and upload your invoice.",
      merchant: {
        ...testFundingOffer.merchant,
        legalName: "Corpora Inc",
        supportEmail: "support@corpora.inc",
      },
    })),
  );
  await registerFundingPurchaseRoutes(app, { pool: db, authenticate, offers });
  await registerConsentRoutes(app, {
    authenticate,
    repository: new ConsentRepository(
      db,
      policy,
      new ConsentSecrets(Buffer.from(state.consentSecret, "hex")),
      true,
    ),
  });
  await registerPaymentEvidenceRoutes(app, { pool: db, authenticate });
  const billing = await registerStripeRoutes(app, {
    pool: db,
    authenticate,
    config,
    gateway,
    consentPolicy: policy,
  });
  async function settle(id: string) {
    const checkout = (
      await db.query("SELECT * FROM amp_stripe_checkouts WHERE id=$1", [id])
    ).rows[0];
    assert.ok(checkout);
    const now = Math.floor(Date.now() / 1000),
      monthly = checkout.billing_interval === "month",
      amount = monthly ? 5900 : 59900;
    const payment: AnnualPayment = payments.get(`in_${id}`) ?? {
      ...basePayment,
      invoiceId: `in_${id}`,
      chargeId: `ch_${id}`,
      subscriptionId: `sub_${id}`,
      checkoutId: id,
      customerId: checkout.customer_id,
      periodStart: now,
      paidAt: now,
      periodEnd: now + (monthly ? 30 : 365) * 86400,
      paymentMethod: "card",
      invoiceReason: "subscription_create",
      priceId: monthly ? config.monthlyPriceId : config.priceId,
      paid: amount,
      subtotal: amount,
    };
    payments.set(payment.invoiceId, payment);
    sessions.set(`cs_${id}`, {
      status: "complete",
      subscriptionId: payment.subscriptionId,
      url: null,
    });
    await persistGateway();
    await billing.repository.enqueue({
      eventId: randomUUID(),
      type: "invoice.paid",
      objectId: payment.invoiceId,
      created: now,
      hash: "synthetic-preview",
    });
    await billing.runBatch();
  }
  app.post("/api/_purchase-preview/pay/:id", async (request, reply) => {
    const accountId = await authenticate(request);
    const id = (request.params as { id: string }).id;
    const checkout = (
      await db.query(
        "SELECT learner_id FROM amp_stripe_checkouts WHERE id=$1 AND account_id=$2",
        [id, accountId],
      )
    ).rows[0];
    if (!checkout) return reply.code(404).send({ error: "not_found" });
    await settle(id);
    return {
      returnTo: `${checkout.learner_id ? "/purchase/annual" : "/start/purchase"}?billing=processing&purchase=${id}`,
    };
  });
  await app.listen({ host: "127.0.0.1", port: port + 1 });
  const password = "synthetic purchase preview passphrase";
  const personas: {
    key: string;
    label: string;
    email: string;
    accountId: string;
    learnerId: string;
    token: string;
  }[] = [];
  for (const [key, label, child] of [
    ["returning", "Returning parent · free practice", "Jordan"],
    ["paid", "Parent with a paid subscription", "Avery"],
    ["invoice", "Parent using education funds", "Casey"],
  ]) {
    const email = `${key}@purchase-preview.example`;
    const login = await app.inject({
      method: "POST",
      url: resuming ? "/api/auth/sign-in/email" : "/api/auth/sign-up/email",
      headers: { origin },
      payload: {
        email,
        password,
        ...(resuming ? {} : { name: "Sample Parent" }),
      },
    });
    assert.equal(
      login.statusCode,
      200,
      "Synthetic preview account could not be opened",
    );
    const data = login.json();
    const token = data.token as string;
    const accountId = `amp|${data.user.id}`;
    let learnerId: string;
    if (resuming) {
      const learner = (
        await db.query(
          "SELECT id FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
          [accountId],
        )
      ).rows[0];
      assert.ok(learner, "The saved preview account has no learner");
      learnerId = learner.id;
    } else {
      await db.query(
        'UPDATE amp_auth_users SET "emailVerified"=true WHERE id=$1',
        [data.user.id],
      );
      const start = await app.inject({
        method: "POST",
        url: "/api/v1/start",
        headers: { origin, authorization: `Bearer ${token}` },
        payload: { as: "parent", children: [{ birthYear: 2016 }] },
      });
      assert.equal(start.statusCode, 200, start.body);
      learnerId = start.json().learnerId as string;
      await new FamilyRepository(db).rename(accountId, learnerId, child!);
      await db.query("UPDATE amp_learners SET free_online_used=5 WHERE id=$1", [
        learnerId,
      ]);
    }
    personas.push({
      key: key!,
      label: label!,
      email,
      accountId,
      learnerId,
      token,
    });
    if (key === "paid" && !resuming) {
      await billing.checkout(accountId, null, randomUUID(), "year", {
        noticeDigest: noticeDigest(policy),
        parentAttestation: true,
      });
      const checkout = (
        await db.query(
          "SELECT id FROM amp_stripe_checkouts WHERE account_id=$1",
          [accountId],
        )
      ).rows[0];
      await settle(checkout.id);
      await claimEnrollment(billing, accountId, checkout.id, learnerId);
    }
  }
  const vite = await createServer({
    plugins: [
      {
        name: "purchase-preview-entry",
        // This transform exists only in this isolated preview server. The app's
        // production Stripe allowlist stays unchanged; simulated payments never
        // leave loopback and use the real settlement/assignment code.
        transform(code, id) {
          if (!id.endsWith("/features/billing/payment-url.ts")) return;
          return code.replace(
            "return url.href;",
            `return url.pathname.startsWith('/c/pay/amp_preview_') ? ${JSON.stringify(origin)} + '/__checkout?id=' + url.pathname.split('amp_preview_')[1] : url.pathname === '/p/session/amp_preview' ? ${JSON.stringify(origin)} + '/__portal' : url.href;`,
          );
        },
        configureServer(server) {
          server.middlewares.use("/__checkout", (req, res) => {
            const id = new URL(req.url ?? "", origin).searchParams.get("id");
            if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
              res.statusCode = 400;
              res.end("Invalid preview checkout");
              return;
            }
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(
              `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test checkout</title><style>body{font:18px/1.6 system-ui;max-width:580px;margin:60px auto;padding:24px;background:#f8f7ef;color:#173e38}button,a{font:inherit;padding:16px;display:inline-block}button{background:#206459;color:white;border:0;border-radius:12px}</style><h1>Test checkout</h1><p>This is a local payment simulation. No card details or money are collected. The live app opens Stripe here.</p><button id="pay">Complete test payment</button><a href="/start/purchase?billing=canceled&purchase=${id}">Cancel</a><p id="status"></p><script>document.querySelector('#pay').onclick=async()=>{document.querySelector('#pay').disabled=true;document.querySelector('#status').textContent='Processing…';const s=await(await fetch('/api/auth/get-session')).json();const r=await fetch('/api/_purchase-preview/pay/${id}',{method:'POST',headers:{authorization:'Bearer '+s.session.token,'content-type':'application/json'},body:'{}'});const result=await r.json();if(r.ok)location.href=result.returnTo;else document.querySelector('#status').textContent='Test payment failed';}</script>`,
            );
          });
          server.middlewares.use("/__portal", (_req, res) => {
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(
              '<h1>Subscription management preview</h1><p>The live app opens your Stripe customer portal here to update payment methods or cancel subscriptions.</p><a href="/account/billing">Back to billing</a>',
            );
          });
          server.middlewares.use("/__preview", (_req, res) => {
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end(
              `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>AMP billing preview</title><style>body{font:18px system-ui;background:#f8f7ef;color:#163f3a;max-width:680px;margin:60px auto;padding:24px}button,a{font:inherit;color:inherit}button{padding:18px;border:1px solid;border-radius:12px;background:transparent;margin:10px 0;display:block;width:100%;text-align:left;cursor:pointer}p{line-height:1.6}</style><h1>AMP billing preview</h1><p>Sample accounts. Invoices are test documents. No emails are sent and no real payment is taken.</p>${personas.map((p) => `<button onclick='enter(${JSON.stringify(p.email)})'>${p.label}</button>`).join("")}<a href="/purchase/funded">View invoices without signing in</a><p id="status"></p><script>async function enter(email){document.querySelector('#status').textContent='Opening…';await fetch('/api/auth/sign-out',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const r=await fetch('/api/auth/sign-in/email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:${JSON.stringify(password)}})});if(!r.ok){document.querySelector('#status').textContent='Sign-in failed';return}localStorage.clear();sessionStorage.clear();location.href='/account/billing'}</script></html>`,
            );
          });
        },
      },
    ],
    cacheDir: `/tmp/amp-purchase-vite-${port}`,
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${port + 1}` },
    },
  });
  await vite.listen();
  return {
    origin,
    schema,
    app,
    db,
    personas,
    password,
    settle,
    billing,
    async close() {
      await vite.close();
      await app.close();
      await persistGateway();
      await db.end();
      if (!options.stateFile && !options.schema)
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}
