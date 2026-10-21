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
    assert.ok(html.includes('href="/support/">Request a curriculum invoice'));
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
      plans: [{ interval: "year", amountMinor: 32100, currency: "USD", renews: true }],
      funding: [{ ...guidedFundingFixture, kind: "classwallet-direct-pay" }],
    }), dir);
    const html = await readFile(join(dir, "esa/synthetic-program/index.html"), "utf8");
    assert.ok(html.includes("$321.00"));
    assert.ok(html.includes("12 months"));
    assert.ok(html.includes("No automatic renewal."));
    assert.ok(html.includes("How to pay with EFA funds"));
    assert.ok(html.includes("support@example.invalid</a>"));
    const href = html.match(/href="(mailto:[^"]+)"/)?.[1];
    assert.ok(href);
    const body = new URL(href.replaceAll("&amp;", "&")).searchParams.get("body");
    assert.ok(body?.includes("Preferred start date:"));
    assert.ok(body?.includes("I have an AMP account: yes / no"));
    assert.ok(!body?.includes("student name"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
