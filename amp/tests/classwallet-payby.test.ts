import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { Pool } from "pg";
import {
  loadClassWalletPayByConfig,
  registerClassWalletPayByRoutes,
} from "../src/funding-purchase/classwallet-payby.js";
test("Pay by ClassWallet is disabled without reviewed config and never exposes provider callbacks", async () => {
  assert.equal(await loadClassWalletPayByConfig({}), null);
  const app = Fastify();
  try {
    await registerClassWalletPayByRoutes(app, {
      pool: {} as Pool,
      offers: [],
      config: null,
      authenticate: async () => "parent",
    });
    assert.deepEqual(
      (
        await app.inject({ url: "/api/v1/funding/classwallet/capabilities" })
      ).json(),
      { offerIds: [] },
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/classwallet/orders/a9829b00-48b2-4eed-835a-91c76636dfd3",
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/funding/requests/a9829b00-48b2-4eed-835a-91c76636dfd3/classwallet-checkout",
          payload: {},
        })
      ).statusCode,
      404,
    );
  } finally {
    await app.close();
  }
});
test("enabled config pins HTTPS origin and requires dedicated strong callback credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "cw-config-test-")),
    path = join(dir, "config.json");
  const good = {
    enabled: true,
    vendorId: "a".repeat(24),
    publicOrigin: "https://example.test",
    setupReference: "synthetic-only",
    offerIds: ["fixture"],
  };
  const env = {
    AMP_CLASSWALLET_PAYBY_FILE: path,
    AMP_CLASSWALLET_BASIC_USER: "fixture",
    AMP_CLASSWALLET_BASIC_PASSWORD: "synthetic-password-only",
  };
  try {
    await writeFile(path, JSON.stringify(good));
    assert.equal(
      (await loadClassWalletPayByConfig(env))?.vendorId,
      good.vendorId,
    );
    await assert.rejects(
      loadClassWalletPayByConfig({
        ...env,
        AMP_CLASSWALLET_BASIC_PASSWORD: "short",
      }),
    );
    for (const publicOrigin of [
      "http://example.test",
      "https://user:secret@example.test",
      "https://example.test/path",
      "https://example.test/?next=evil",
    ]) {
      await writeFile(path, JSON.stringify({ ...good, publicOrigin }));
      await assert.rejects(loadClassWalletPayByConfig(env));
    }
  } finally {
    await rm(dir, { recursive: true });
  }
});
