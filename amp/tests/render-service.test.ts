import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";
import type { Browser } from "playwright-core";
import { chromium } from "playwright-core";
import { createRenderService } from "../src/render-service/server.js";

const token = "render-test-token-0123456789abcdef0123";

/** A stand-in browser: each render waits `delay` ms and returns a tiny PDF. */
function fakeBrowser(delay = 0, onRender?: (html: string) => void) {
  let rendering = 0;
  let peak = 0;
  const browser = {
    version: () => "fake",
    isConnected: () => true,
    on: () => browser,
    close: async () => undefined,
    newContext: async () => ({
      close: async () => undefined,
      newPage: async () => ({
        route: async () => undefined,
        setContent: async (html: string) => onRender?.(html),
        emulateMedia: async () => undefined,
        pdf: async () => {
          rendering++;
          peak = Math.max(peak, rendering);
          await new Promise((r) => setTimeout(r, delay));
          rendering--;
          return Buffer.from("%PDF-1.7 fake");
        },
      }),
    }),
  } as unknown as Browser;
  return { browser, peak: () => peak };
}

async function start(options: Parameters<typeof createRenderService>[0]) {
  const logs: Record<string, unknown>[] = [];
  const service = createRenderService({
    log: (entry) => logs.push(entry),
    ...options,
  });
  await new Promise<void>((resolve) =>
    service.server.listen(0, "127.0.0.1", resolve),
  );
  const { port } = service.server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const render = (body: unknown, auth = `Bearer ${token}`) =>
    fetch(`${base}/render`, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  return { service, base, render, logs };
}

test("requests need the shared secret and a valid body; logs never hold the document", async () => {
  const { browser } = fakeBrowser();
  const { service, base, render, logs } = await start({
    token,
    launch: async () => browser,
    maxBytes: 4096,
  });
  try {
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    assert.equal(
      (await render({ html: "<p>x</p>", format: "A4" }, "")).status,
      401,
    );
    assert.equal(
      (await render({ html: "<p>x</p>", format: "A4" }, "Bearer wrong")).status,
      401,
    );
    assert.equal((await render("not json")).status, 400);
    assert.equal((await render({ html: "", format: "A4" })).status, 400);
    assert.equal(
      (await render({ html: "<p>x</p>", format: "Legal" })).status,
      400,
    );
    assert.equal(
      (await render({ html: "<p>x</p>", format: "A4", footer: 3 })).status,
      400,
    );
    assert.equal(
      (await render({ html: "x".repeat(5000), format: "A4" })).status,
      413,
    );
    // A streamed body over the limit gets a 413, not a reset connection.
    const streamed = await new Promise<number>((resolve, reject) => {
      const req = request(`${base}/render`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      req.on("response", (res) => resolve(res.statusCode ?? 0));
      req.on("error", reject);
      for (let i = 0; i < 8; i++) req.write("x".repeat(1024));
      req.end();
    });
    assert.equal(streamed, 413);
    assert.equal((await fetch(`${base}/render`)).status, 405);
    assert.equal((await fetch(`${base}/other`)).status, 404);
    const ok = await render({
      html: "<p>secret learner name</p>",
      format: "Letter",
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("content-type"), "application/pdf");
    assert.equal(
      Buffer.from(await ok.arrayBuffer()).toString(),
      "%PDF-1.7 fake",
    );
    const text = JSON.stringify(logs);
    assert.ok(!text.includes("secret learner name"));
    assert.ok(logs.some((l) => l.msg === "rendered" && l.format === "Letter"));
    assert.ok(
      logs.some((l) => l.msg === "render request failed" && l.status === 401),
    );
  } finally {
    await service.close();
  }
  assert.throws(() => createRenderService({ token: "short" }), /32/);
});

test("concurrency is bounded, a full queue answers 503 and slow renders time out", async () => {
  const fake = fakeBrowser(150);
  const { service, render, logs } = await start({
    token,
    launch: async () => fake.browser,
    concurrency: 2,
    queue: 1,
  });
  try {
    const statuses = await Promise.all(
      Array.from({ length: 5 }, () =>
        render({ html: "<p>x</p>", format: "A4" }).then((r) => r.status),
      ),
    );
    assert.deepEqual(statuses.sort(), [200, 200, 200, 503, 503]);
    assert.equal(fake.peak(), 2);
    assert.ok(logs.some((l) => l.status === 503 && l.level === "error"));
  } finally {
    await service.close();
  }
  const slow = fakeBrowser(500);
  const timed = await start({
    token,
    launch: async () => slow.browser,
    timeoutMs: 100,
  });
  try {
    assert.equal(
      (await timed.render({ html: "<p>x</p>", format: "A4" })).status,
      504,
    );
  } finally {
    await timed.service.close();
  }
});

test("a browser that cannot start reports unhealthy and fails renders with 500", async () => {
  const { service, base, render, logs } = await start({
    token,
    launch: async () => {
      throw new Error("no chromium");
    },
  });
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 503);
    assert.equal(
      (await render({ html: "<p>x</p>", format: "A4" })).status,
      500,
    );
    assert.ok(logs.some((l) => l.error === "no chromium"));
  } finally {
    await service.close();
  }
});

test(
  "real Chromium renders a PDF offline: the document cannot reach the network",
  { skip: !existsSync(chromium.executablePath()) && "Chromium not installed" },
  async () => {
    let hits = 0;
    const beacon = createServer((_req, res) => {
      hits++;
      res.end("x");
    });
    await new Promise<void>((r) => beacon.listen(0, "127.0.0.1", r));
    const port = (beacon.address() as AddressInfo).port;
    const { service, render } = await start({ token });
    try {
      const response = await render({
        html: `<!doctype html><html><head><link rel="stylesheet" href="http://127.0.0.1:${port}/a.css"></head><body><h1>Workbook</h1><img src="http://127.0.0.1:${port}/b.png"><script>fetch("http://127.0.0.1:${port}/c")</script></body></html>`,
        format: "A4",
        footer: "<span class='pageNumber'></span>",
      });
      assert.equal(response.status, 200);
      const pdf = Buffer.from(await response.arrayBuffer());
      assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      assert.ok(pdf.length > 1000);
      assert.equal(hits, 0, "no request left the page");
    } finally {
      await service.close();
      beacon.close();
    }
  },
);
