/**
 * A browser check's own stack, as CI runs it: the real API (accounts mode)
 * on a fresh schema of AMP_TEST_DATABASE_URL, Vite in front of it, and the
 * design preview's synthetic people (scripts/design-personas.ts) seeded
 * through it. Stopping it drops the schema.
 */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open as openFile } from "node:fs/promises";
import pg from "pg";
import { createServer } from "vite";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";

export async function startPersonaStack({
  webPort,
  personas,
  name,
  out,
}: {
  webPort: number;
  /** Persona slugs (src/web/features/dev/persona-list.ts). */
  personas: string[];
  /** A short name for the schema and Vite's cache. */
  name: string;
  /** Where the API's log goes. */
  out: string;
}) {
  const url = process.env.AMP_TEST_DATABASE_URL;
  if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
  assertTestDatabaseTarget(url);
  const apiPort = webPort + 1;
  const origin = `http://127.0.0.1:${webPort}`;
  const schema = `amp_${name}_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(scoped.href);
  await mkdir(out, { recursive: true });
  const log = await openFile(`${out}/api.log`, "w");
  const api = spawn("npx", ["tsx", "src/server/main.ts"], {
    env: {
      ...process.env,
      AMP_DATABASE_URL: scoped.href,
      AMP_AUTH_MODE: "accounts",
      AMP_HOSTED_PILOT_READY: "true",
      AMP_ACCOUNTS_URL: origin,
      // A fresh secret each run: nothing here outlives the process.
      AMP_ACCOUNTS_SECRET: randomBytes(32).toString("hex"),
      AMP_PORT: String(apiPort),
      AMP_HOST: "127.0.0.1",
      NODE_ENV: "development",
    },
    stdio: ["ignore", log.fd, log.fd],
    // Its own process group, so stopping it stops npx's children too.
    detached: true,
  });
  for (let i = 0; ; i++) {
    const up = await fetch(`http://127.0.0.1:${apiPort}/api/v1/auth-config`)
      .then((response) => response.ok)
      .catch(() => false);
    if (up) break;
    if (i > 120 || api.exitCode !== null)
      throw new Error(`The API did not start: ${out}/api.log`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const vite = await createServer({
    cacheDir: `node_modules/.vite-${name}`,
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      proxy: { "/api": `http://127.0.0.1:${apiPort}` },
    },
  });
  await vite.listen();
  // Asynchronously: Vite answers the seeder's requests from this process.
  const seeder = spawn("npx", ["tsx", "scripts/design-personas.ts"], {
    env: {
      ...process.env,
      AMP_DATABASE_URL: scoped.href,
      AMP_PREVIEW_ORIGIN: origin,
      AMP_PERSONAS: personas.join(","),
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  const code = await new Promise<number | null>((resolve) =>
    seeder.on("exit", resolve),
  );
  if (code !== 0) throw new Error(`Seeding ${personas} failed (${code})`);
  return {
    origin,
    async stop() {
      await vite.close();
      if (api.pid && api.exitCode === null) process.kill(-api.pid, "SIGTERM");
      await log.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    },
  };
}
