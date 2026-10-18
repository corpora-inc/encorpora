import assert from "node:assert/strict";
import test from "node:test";
import { configSchema, formatPrice, loadConfig } from "../src/config.js";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("preview has no invented commercial routes; production fails closed", () => {
  assert.deepEqual(configSchema.parse({}).plans, []);
  assert.equal(
    configSchema.safeParse({ siteUrl: "https://example.invalid/subpath/" })
      .success,
    false,
  );
  assert.equal(
    configSchema.parse({ siteUrl: "https://example.invalid/" }).siteUrl,
    "https://example.invalid",
  );
  assert.equal(
    configSchema.safeParse({ mode: "production", legalReviewed: true }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({ appUrl: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({ appUrl: "https://user:password@example.invalid/" })
      .success,
    false,
  );
  assert.equal(
    configSchema.safeParse({ stripePriceId: "price_example" }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({ analytics: "https://example.invalid/tag.js" })
      .success,
    false,
  );
});
test("plan amounts have explicit currency and renewal, not identifiers", () => {
  const plan = {
    interval: "month" as const,
    amountMinor: 1234,
    currency: "USD",
    renews: true,
  };
  assert.equal(formatPrice(plan), "$12.34");
  assert.equal(configSchema.safeParse({ plans: [plan, plan] }).success, false);
  assert.throws(() => formatPrice({ ...plan, currency: "JPY" }));
  assert.equal(
    configSchema.safeParse({ plans: [{ ...plan, amountMinor: -10 }] }).success,
    false,
  );
});
test("stale program guidance blocks a build instead of implying approval", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-site-test-"));
  try {
    const path = join(dir, "config.json");
    await writeFile(
      path,
      JSON.stringify({
        funding: [
          {
            state: "AZ",
            program: "Synthetic test program",
            kind: "reimbursement",
            instructions: "Synthetic guidance",
            sourceUrl: "https://example.invalid/",
            reviewedUntil: "2000-01-01",
          },
        ],
      }),
    );
    await assert.rejects(loadConfig(path), /expired/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("production privacy requires and preserves the reviewed placement basis", () => {
  const input = {
    mode: "production",
    siteUrl: "https://site.example.invalid",
    appUrl: "https://app.example.invalid",
    supportEmail: "support@example.invalid",
    legalReviewed: true,
    operator: {
      legalName: "Synthetic operator",
      postalAddress: "Synthetic address",
      telephone: "Synthetic telephone",
    },
    privacy: {
      retention: "Synthetic retention",
      providers: [
        {
          name: "Synthetic provider",
          purpose: "Synthetic purpose",
          retention: "Synthetic retention",
        },
      ],
    },
  };
  const missing = configSchema.safeParse(input);
  assert.equal(missing.success, false);
  if (!missing.success)
    assert.ok(
      missing.error.issues.some(
        (issue) => issue.path.join(".") === "privacy.placementBasis",
      ),
    );
  const configured = configSchema.parse({
    ...input,
    privacy: {
      ...input.privacy,
      placementBasis: "Synthetic basis, not permission to collect real data.",
    },
  });
  assert.equal(
    configured.privacy!.placementBasis,
    "Synthetic basis, not permission to collect real data.",
  );
});
