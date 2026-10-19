import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configSchema } from "../src/config.js";
import { buildSite } from "../src/build.js";
import { fundingFixture } from "./funding-fixture.js";

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
