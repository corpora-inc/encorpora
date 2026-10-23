import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config.js";
import { buildSite } from "../src/build.js";
import { fundingFixture, guidedFundingFixture } from "./funding-fixture.js";

test("program paths reject traversal, duplicates and invalid review windows", () => {
  for (const slug of ["../legal", "a/b", "<script>", "AMP", ""]) {
    assert.equal(
      configSchema.safeParse({
        funding: [
          { ...fundingFixture, page: { ...fundingFixture.page, slug } },
        ],
      }).success,
      false,
    );
  }
  assert.equal(
    configSchema.safeParse({ funding: [fundingFixture, fundingFixture] })
      .success,
    false,
  );
  assert.equal(
    configSchema.safeParse({
      funding: [{ ...fundingFixture, reviewedUntil: "2025-01-01" }],
    }).success,
    false,
  );
});

test("build emits linked program HTML, canonical metadata, safe structured data and sitemap entry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-funding-"));
  try {
    const config = configSchema.parse({
      siteUrl: "https://site.example.invalid",
      funding: [
        {
          ...fundingFixture,
          program: '</script><img src=x onerror="alert(1)">',
        },
      ],
    });
    await buildSite(config, dir);
    const html = await readFile(
      join(dir, "esa/synthetic-program/index.html"),
      "utf8",
    );
    assert.ok(html.includes("AMP approval has not been confirmed"));
    assert.ok(
      html.includes(
        'rel="canonical" href="https://site.example.invalid/esa/synthetic-program/"',
      ),
    );
    assert.ok(!html.includes("<img src=x"));
    const json = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s,
    )?.[1];
    assert.ok(json);
    const data = JSON.parse(json);
    assert.equal(
      data["@graph"][0].name,
      `${config.funding[0]!.program} and AMP Mathematics`,
    );
    assert.equal(data["@graph"][1].itemListElement.length, 3);
    assert.ok(
      (await readFile(join(dir, "esa/index.html"), "utf8")).includes(
        'href="/esa/synthetic-program/"',
      ),
    );
    assert.ok(
      (await readFile(join(dir, "sitemap.xml"), "utf8")).includes(
        "https://site.example.invalid/esa/synthetic-program/",
      ),
    );
    // Preview pages remain non-indexable even when an origin is configured.
    assert.ok(html.includes("noindex, nofollow"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("nationwide guides render without inflating state counts, including a nationwide-only directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-national-funding-"));
  const national = {
    ...fundingFixture,
    state: "US",
    page: { ...fundingFixture.page, slug: "national-savings" },
  };
  try {
    for (const funding of [[national], [national, fundingFixture]]) {
      await buildSite(configSchema.parse({ funding }), dir);
      const html = await readFile(join(dir, "esa/index.html"), "utf8");
      assert.ok(html.includes('id="state-US"'));
      assert.ok(html.includes("Nationwide savings guidance"));
      assert.ok(html.includes(`/esa/national-savings/`));
      assert.ok(!html.includes("2 states"));
      assert.ok(!html.includes("0 states"));
      assert.equal(html.includes("1 state"), funding.length === 2);
      assert.ok(html.includes(`${funding.length} parent guides`));
      const page = await readFile(
        join(dir, "esa/national-savings/index.html"),
        "utf8",
      );
      assert.ok(page.includes("Nationwide"));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guided purchase copy is optional, escaped and uses a safe support action", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-guided-"));
  try {
    await buildSite(
      configSchema.parse({ funding: [guidedFundingFixture] }),
      dir,
    );
    const html = await readFile(
      join(dir, "esa/synthetic-program/index.html"),
      "utf8",
    );
    assert.ok(html.includes('class="funding-guided"'));
    assert.match(html, /href="\/support\/"[^>]*>Request a curriculum invoice/);
    assert.ok(html.includes(guidedFundingFixture.page.presentation.headline));
    assert.equal(
      configSchema.safeParse({
        funding: [
          {
            ...guidedFundingFixture,
            page: {
              ...guidedFundingFixture.page,
              presentation: {
                ...guidedFundingFixture.page.presentation,
                actionSubject: "request\r\nBcc: injected@example.invalid",
              },
            },
          },
        ],
      }).success,
      false,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ClassWallet DirectPay is labeled consistently without marketplace enrollment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-directpay-"));
  try {
    await buildSite(
      configSchema.parse({ funding: [{ ...fundingFixture, kind: "classwallet-direct-pay" }] }),
      dir,
    );
    for (const path of ["esa/index.html", "esa/synthetic-program/index.html"]) {
      const html = await readFile(join(dir, path), "utf8");
      assert.ok(html.includes("ClassWallet DirectPay"));
      assert.ok(!html.includes("Marketplace or direct payment"));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("guided DirectPay shows configured fixed-term prices and an invoice email", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-directpay-prices-"));
  try {
    await buildSite(configSchema.parse({
      supportEmail: "support@example.invalid",
      plans: [
        { interval: "year", amountMinor: 32100, currency: "USD", renews: true },
        { interval: "month", amountMinor: 4200, currency: "USD", renews: true },
      ],
      funding: [{ ...guidedFundingFixture, kind: "classwallet-direct-pay" }],
    }), dir);
    const html = await readFile(join(dir, "esa/synthetic-program/index.html"), "utf8");
    assert.ok(html.includes("$321.00"));
    assert.ok(!html.includes("$42.00"));
    assert.ok(!html.includes("1 month"));
    const product = await readFile(join(dir, "amp/index.html"), "utf8");
    assert.ok(product.includes("$42.00"), "personal monthly pricing remains available");
    assert.ok(html.includes("12 months"));
    assert.ok(html.includes("No automatic renewal."));
    assert.ok(html.includes("How to pay with program funds"));
    assert.ok(html.includes("support@example.invalid</a>"));
    assert.equal((html.match(/data-campaign-action="invoice"/g) ?? []).length, 3);
    const href = html.match(/href="(mailto:[^"]+)"/)?.[1];
    assert.ok(href);
    const body = new URL(href.replaceAll("&amp;", "&")).searchParams.get("body");
    assert.ok(body?.includes("Plan: 12 months ($321.00)"));
    assert.ok(!body?.includes("1 month"));
    assert.ok(!body?.includes("$42.00"));
    assert.ok(body?.includes("Preferred start date:"));
    assert.ok(body?.includes("I have an AMP account: yes / no"));
    assert.ok(!body?.includes("student name"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Arkansas free practice keeps the funded purchase preference without tracking", async () => {
  const dir = await mkdtemp(join(tmpdir(), "corpora-arkansas-entry-"));
  try {
    await buildSite(configSchema.parse({
      appUrl: "https://app.example.invalid",
      funding: [{ ...guidedFundingFixture, page: { ...guidedFundingFixture.page, slug: "arkansas-efa" } }],
    }), dir);
    const html = await readFile(join(dir, "esa/arkansas-efa/index.html"), "utf8");
    assert.ok(html.includes('href="https://app.example.invalid/try?program=ar-efa"'));
    assert.ok(!html.includes("utm_campaign="));
  } finally { await rm(dir, { recursive: true, force: true }); }
});


test("enabled invoice forms link to the correct program without an email request", async () => {
  for (const [slug, state] of [["arkansas-efa", "AR"], ["new-hampshire-efa", "NH"], ["arizona-esa", "AZ"]]) {
    const route = { ...guidedFundingFixture, state, kind: "classwallet-direct-pay",
      page: { ...guidedFundingFixture.page, slug,
        presentation: { ...guidedFundingFixture.page.presentation, invoiceForm: slug } } };
    const input = { appUrl: "https://amp.example.invalid", supportEmail: "help@example.invalid", funding: [route] };
    assert.equal(configSchema.safeParse({ ...input, appUrl: undefined }).success, false);
    assert.equal(configSchema.safeParse({ ...input, funding: [{ ...route, state: "XX" }] }).success, false);
    const dir = await mkdtemp(join(tmpdir(), "corpora-invoice-form-"));
    try {
      await buildSite(configSchema.parse(input), dir);
      const html = await readFile(join(dir, `esa/${slug}/index.html`), "utf8");
      const actions = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]+data-campaign-action="invoice"/g)];
      assert.equal(actions.length, 2);
      for (const action of actions) assert.equal(action[1], `https://amp.example.invalid/invoice/${slug}`);
      assert.ok(html.includes("Create your invoice"));
      assert.ok(!html.includes("No AMP account required"));
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
});
