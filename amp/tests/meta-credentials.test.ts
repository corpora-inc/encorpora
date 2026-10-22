import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { metaMeasurementCredentials } from "../src/advertising/meta-credentials.js";
const exec = promisify(execFile);
async function fixture(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "amp-meta-auth-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true });
  }
}
test("Meta credential loader supports rotation, rejects broad modes and symlinks, and redacts failures", () =>
  fixture(async (dir) => {
    const path = join(dir, "credential.json");
    await writeFile(path, JSON.stringify({ access_token: "synthetic-first" }), {
      mode: 0o600,
    });
    const get = metaMeasurementCredentials(path);
    assert.equal(await get(), "synthetic-first");
    await writeFile(path, JSON.stringify({ access_token: "synthetic-second" }));
    assert.equal(await get(), "synthetic-second");
    await symlink(path, path + ".link");
    await assert.rejects(
      metaMeasurementCredentials(path + ".link")(),
      /credentials_unavailable/,
    );
    await chmod(path, 0o644);
    await assert.rejects(get(), /credentials_unavailable/);
    await chmod(path, 0o600);
    for (const value of [
      { access_token: "secret\nprivate" },
      { access_token: "synthetic", token_uri: "https://example.invalid" },
      { refresh_token: "private" },
    ]) {
      await writeFile(path, JSON.stringify(value));
      await assert.rejects(get(), (error) => {
        assert.equal(
          (error as Error).message,
          "Meta purchase measurement: credentials_unavailable",
        );
        assert.doesNotMatch(
          JSON.stringify(error),
          /secret|private|example|synthetic/,
        );
        return true;
      });
    }
  }));
test("disabled Meta CLI stops before database or credentials; malformed commands fail without private data", () =>
  fixture(async (dir) => {
    const path = join(dir, "config.json");
    await writeFile(
      path,
      JSON.stringify({
        enabled: false,
        destination: { datasetId: "1234567890" },
        sources: { stripeNamespace: "acct_fixture:live" },
      }),
      { mode: 0o600 },
    );
    const env = {
      ...process.env,
      AMP_META_MEASUREMENT_CONFIG: path,
      AMP_DATABASE_URL: "",
      AMP_META_MEASUREMENT_CREDENTIALS: "/missing/private-credential.json",
    };
    for (const op of ["collect", "deliver"]) {
      const result = await exec(
        process.execPath,
        ["--import", "tsx", "scripts/meta-measurement.ts", op, "1"],
        { env, timeout: 15000 },
      );
      assert.deepEqual(JSON.parse(result.stdout), { disabled: true });
      assert.equal(result.stderr, "");
    }
    for (const args of [
      ["deliver", "201"],
      ["test"],
      ["deliver", "1", "unexpected"],
    ]) {
      await assert.rejects(
        exec(
          process.execPath,
          ["--import", "tsx", "scripts/meta-measurement.ts", ...args],
          { env, timeout: 15000 },
        ),
        (error) => {
          const output = (error as { stderr: string }).stderr;
          assert.match(output, /Meta measurement command failed/);
          assert.doesNotMatch(
            output,
            /1234567890|acct_fixture|private-credential|config.json/,
          );
          return true;
        },
      );
    }
  }));
