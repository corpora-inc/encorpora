import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  googleMeasurementCredentials,
  readPrivateMeasurementJson,
} from "../src/advertising/google-credentials.js";
const scope = "https://www.googleapis.com/auth/datamanager";
const credential = {
  client_id: "synthetic-client",
  client_secret: "synthetic-secret",
  refresh_token: "synthetic-refresh",
  token_uri: "https://oauth2.googleapis.com/token",
  scopes: [scope],
};
async function fixture(run: (path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "amp-google-auth-"));
  try {
    const path = join(dir, "credentials.json");
    await writeFile(path, JSON.stringify(credential), { mode: 0o600 });
    await run(path);
  } finally {
    await rm(dir, { recursive: true });
  }
}
test("private credential files reject broad modes, oversized data and symbolic links", () =>
  fixture(async (path) => {
    assert.deepEqual(await readPrivateMeasurementJson(path), credential);
    await symlink(path, path + ".link");
    await assert.rejects(readPrivateMeasurementJson(path + ".link"));
    await chmod(path, 0o644);
    await assert.rejects(readPrivateMeasurementJson(path));
    await chmod(path, 0o600);
    await writeFile(path, "x".repeat(65537));
    await assert.rejects(readPrivateMeasurementJson(path));
  }));
test("refresh is fixed-origin, bounded and cached only in memory; credentials never enter an error", () =>
  fixture(async (path) => {
    let count = 0;
    const get = googleMeasurementCredentials(path, async (url, init) => {
      count++;
      assert.equal(String(url), "https://oauth2.googleapis.com/token");
      assert.equal(init!.redirect, "error");
      assert.ok(init!.signal);
      assert.equal(
        new URLSearchParams(String(init!.body)).get("grant_type"),
        "refresh_token",
      );
      return new Response(
        JSON.stringify({
          access_token: "synthetic-access",
          token_type: "Bearer",
          expires_in: 3600,
          scope,
        }),
      );
    });
    assert.equal(await get(), "synthetic-access");
    assert.equal(await get(), "synthetic-access");
    assert.equal(count, 1);
    const bad = googleMeasurementCredentials(
      path,
      async () =>
        new Response(
          JSON.stringify({
            access_token: "synthetic-access",
            token_type: "Bearer",
            expires_in: 3600,
            scope: "other",
          }),
        ),
    );
    await assert.rejects(bad(), (error) => {
      assert.equal(
        (error as Error).message,
        "Google purchase measurement: credentials_unavailable",
      );
      assert.doesNotMatch(JSON.stringify(error), /synthetic|refresh_token/);
      return true;
    });
  }));
test("unapproved scopes and substituted endpoints never reach HTTP", () =>
  fixture(async (path) => {
    for (const value of [
      { ...credential, scopes: [] },
      { ...credential, token_uri: "https://example.invalid/token" },
    ]) {
      await writeFile(path, JSON.stringify(value));
      let called = false;
      await assert.rejects(
        googleMeasurementCredentials(path, async () => {
          called = true;
          throw new Error();
        })(),
      );
      assert.equal(called, false);
    }
  }));

test("a private FIFO is rejected without waiting for a writer", () =>
  fixture(async (path) => {
    const { execFileSync } = await import("node:child_process");
    execFileSync("mkfifo", [path + ".fifo"]);
    await chmod(path + ".fifo", 0o600);
    await assert.rejects(
      readPrivateMeasurementJson(path + ".fifo"),
      /invalid_private_file/,
    );
  }));
