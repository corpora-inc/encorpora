import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { migrate } from "../scripts/migrate";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { createAccounts, accountsAuth, registerAccountRoutes } from "../src/server/accounts";

test("security: TOTP, password/session revocation, linking and concurrent last-method protection", { skip: !process.env.AMP_TEST_DATABASE_URL }, async (t) => {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `security_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url); scoped.searchParams.set("options", `-c search_path=${schema}`);
  const repo = new PostgresRepository(scoped.href, { development: true });
  const origin = "http://127.0.0.1:4310";
  const mail: string[] = []; const info = console.info; console.info = (...args) => mail.push(args.join(" "));
  await admin.query(`CREATE SCHEMA ${schema}`);
  let app: ReturnType<typeof buildApp> | undefined;
  try {
    await migrate(scoped.href);
    const accounts = await createAccounts(repo.pool, { baseURL: origin, secret: "s".repeat(40), production: false, passwords: true, trustedOrigins: [], google: { clientId: "test-client", clientSecret: "test-secret" } });
    app = buildApp({ repository: repo, authenticate: accountsAuth(accounts), development: true });
    await registerAccountRoutes(app, accounts);
    let requestId = 1;
    const post = (path: string, payload: object, cookie = "", extra = {}) => app!.inject({ method: "POST", url: `/api/auth${path}`, payload, remoteAddress: `203.0.113.${requestId++}`, headers: { origin, cookie, ...extra } });
    const get = (path: string, cookie = "") => app!.inject({ method: "GET", url: `/api/auth${path}`, headers: { cookie } });
    const cookies = (response: { headers: Record<string, unknown> }) => ([] as string[]).concat(response.headers["set-cookie"] as string[] ?? []).map((c) => c.split(";")[0]).join("; ");
    const password = "A long test passphrase";
    async function signup(email: string) {
      const result = await post("/sign-up/email", { email, password, name: "Test Parent" });
      assert.equal(result.statusCode, 200);
      return { cookie: cookies(result), user: result.json().user.id as string };
    }
    let owner = await signup("parent@example.com");
    const other = await signup("other@example.com");
    await t.test("TOTP requires password and proof; sign-in, replacement backup codes and disable", async () => {
      assert.equal((await post("/two-factor/enable", { password: "wrong" }, owner.cookie)).statusCode, 400);
      const enrollment = await post("/two-factor/enable", { password }, owner.cookie);
      assert.equal(enrollment.statusCode, 200);
      const data = enrollment.json(); assert.equal(data.backupCodes.length, 10);
      assert.equal((await get("/security/summary", owner.cookie)).json().twoFactorEnabled, false);
      const secret = new URL(data.totpURI).searchParams.get("secret")!;
      const rawSecret = new TextDecoder().decode(base32.decode(secret));
      assert.equal((await post("/two-factor/verify-totp", { code: "000000" }, owner.cookie)).statusCode, 401);
      const verify = await post("/two-factor/verify-totp", { code: await createOTP(rawSecret).totp() }, owner.cookie);
      assert.equal(verify.statusCode, 200); owner.cookie = cookies(verify) || owner.cookie;
      assert.equal((await get("/security/summary", owner.cookie)).json().twoFactorEnabled, true);
      const storage = await repo.pool.query('SELECT secret, "backupCodes" FROM amp_auth_two_factors WHERE "userId"=$1', [owner.user]);
      assert.ok(!storage.rows[0].secret.includes(rawSecret)); assert.ok(!storage.rows[0].backupCodes.includes(data.backupCodes[0]));
      const login = await post("/sign-in/email", { email: "parent@example.com", password });
      assert.equal(login.json().twoFactorRedirect, true);
      const challenge = cookies(login);
      assert.equal((await get("/security/summary", challenge)).statusCode, 401);
      assert.equal((await post("/two-factor/verify-backup-code", { code: data.backupCodes[0] }, challenge)).statusCode, 200);
      const replacement = await post("/two-factor/generate-backup-codes", { password }, owner.cookie);
      assert.equal(replacement.statusCode, 200);
      const challenge2 = cookies(await post("/sign-in/email", { email: "parent@example.com", password }));
      assert.equal((await post("/two-factor/verify-backup-code", { code: data.backupCodes[1] }, challenge2)).statusCode, 401);
      assert.equal((await post("/two-factor/verify-backup-code", { code: replacement.json().backupCodes[0] }, challenge2)).statusCode, 200);
      assert.equal((await post("/two-factor/view-backup-codes", { userId: owner.user }, owner.cookie)).statusCode, 404);
      const disabled = await post("/two-factor/disable", { password }, owner.cookie);
      assert.equal(disabled.statusCode, 200); owner.cookie = cookies(disabled) || owner.cookie;
      assert.equal((await get("/security/summary", owner.cookie)).json().twoFactorEnabled, false);
    });
    await t.test("password change forces session revocation even if caller sends false", async () => {
      const second = await post("/sign-in/email", { email: "parent@example.com", password });
      const changed = await post("/change-password", { currentPassword: password, newPassword: "An entirely new passphrase", revokeOtherSessions: false }, owner.cookie);
      assert.equal(changed.statusCode, 200);
      assert.equal((await get("/security/summary", cookies(second))).statusCode, 401);
      assert.equal((await get("/security/summary", owner.cookie)).statusCode, 401);
      owner.cookie = cookies(changed);
      assert.equal((await get("/security/summary", owner.cookie)).statusCode, 200);
    });
    async function addProvider(userId: string, provider: string) {
      const id = randomUUID(); await repo.pool.query('INSERT INTO amp_auth_accounts (id,"accountId","providerId","userId","createdAt","updatedAt") VALUES ($1,$1,$2,$3,now(),now())', [id, provider, userId]); return id;
    }
    async function addPasskey(userId: string) {
      const id = randomUUID(); await repo.pool.query('INSERT INTO amp_auth_passkeys (id,name,"publicKey","userId","credentialID",counter,"deviceType","backedUp","createdAt") VALUES ($1,\'Test key\',\'test-public-key\',$2,$1,0,\'singleDevice\',false,now())', [id, userId]); return id;
    }
    await t.test("ownership, CSRF, direct-route bypass, disabled provider and cross-method race", async () => {
      const accountId = await addProvider(owner.user, "google"), keyId = await addPasskey(owner.user);
      assert.equal((await post("/security/unlink-account", { id: accountId }, other.cookie)).statusCode, 404);
      assert.equal((await post("/security/delete-passkey", { id: keyId }, other.cookie)).statusCode, 404);
      assert.equal((await post("/passkey/update-passkey", { id: keyId, name: "Stolen" }, other.cookie)).statusCode, 401);
      assert.equal((await post("/security/delete-passkey", { id: keyId }, owner.cookie, { origin: "https://evil.example" })).statusCode, 403);
      assert.equal((await post("/unlink-account", { accountId }, owner.cookie)).statusCode, 403);
      assert.equal((await post("/passkey/delete-passkey", { id: keyId }, owner.cookie)).statusCode, 403);
      assert.notEqual((await post("/delete-user", {}, owner.cookie)).statusCode, 200);
      await repo.pool.query('DELETE FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"=\'credential\'', [owner.user]);
      await addProvider(owner.user, "github");
      const race = await Promise.all([post("/security/unlink-account", { id: accountId }, owner.cookie), post("/security/delete-passkey", { id: keyId }, owner.cookie)]);
      assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 400]);
      const last = race[0].statusCode === 200 ? { path: "/security/delete-passkey", id: keyId } : { path: "/security/unlink-account", id: accountId };
      assert.equal((await post(last.path, { id: last.id }, owner.cookie)).json().code, "LAST_SIGN_IN_METHOD");
      const summary = (await get("/security/summary", owner.cookie)).json();
      assert.equal(summary.accounts.find((a: { provider: string }) => a.provider === "github").available, false);
      assert.ok(!JSON.stringify(summary).includes("test-public-key"));
    });
    await t.test("freshness enforced on every security mutation and linking", async () => {
      await repo.pool.query('UPDATE amp_auth_sessions SET "createdAt"=now()-interval \'6 minutes\' WHERE "userId"=$1', [owner.user]);
      for (const [path, payload] of [["/security/delete-passkey", { id: "absent" }], ["/security/unlink-account", { id: "absent" }], ["/passkey/update-passkey", { id: "absent", name: "new" }], ["/two-factor/enable", { password }], ["/two-factor/disable", { password }], ["/two-factor/generate-backup-codes", { password }], ["/change-password", { currentPassword: password, newPassword: password }], ["/link-social", { provider: "google", callbackURL: "/" }]] as const) {
        assert.equal((await post(path, payload, owner.cookie)).statusCode, 403, path);
      }
      assert.equal((await get("/passkey/generate-register-options", owner.cookie)).statusCode, 403);
      assert.equal((await get("/security/summary", owner.cookie)).statusCode, 200);
    });
    await t.test("social-only password setup uses an emailed single-use link", async () => {
      await addProvider(other.user, "google");
      await repo.pool.query('DELETE FROM amp_auth_accounts WHERE "userId"=$1 AND "providerId"=\'credential\'', [other.user]);
      assert.equal((await post("/request-password-reset", { email: "other@example.com", redirectTo: "/?reset-password" }, other.cookie)).statusCode, 200);
      const link = mail.join("\n").match(/http:\/\/127\.0\.0\.1:4310\/api\/auth\/reset-password\/\S+/)?.[0]; assert.ok(link);
      const next = await app!.inject({ method: "GET", url: new URL(link).pathname + new URL(link).search });
      const token = new URL(next.headers.location as string, origin).searchParams.get("token");
      assert.equal((await post("/reset-password", { token, newPassword: password })).statusCode, 200);
      assert.notEqual((await post("/reset-password", { token, newPassword: password })).statusCode, 200);
      assert.equal((await post("/sign-in/email", { email: "other@example.com", password })).statusCode, 200);
    });
    await t.test("configured provider linking issues OAuth authorization; unconfigured provider fails", async () => {
      const login = await post("/sign-in/email", { email: "other@example.com", password });
      const result = await post("/link-social", { provider: "google", callbackURL: "/" }, cookies(login));
      assert.equal(result.statusCode, 200);
      assert.equal(new URL(result.json().url).hostname, "accounts.google.com");
      assert.ok(new URL(result.json().url).searchParams.get("state"));
      assert.notEqual((await post("/link-social", { provider: "apple", callbackURL: "/" }, cookies(login))).statusCode, 200);
    });
  } finally {
    console.info = info; await app?.close(); await repo.close(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end();
  }
});
