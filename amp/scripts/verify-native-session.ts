/** Controlled system-browser/OS-callback adapter around the production Rust session core. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer as httpServer } from "node:http";
import { createInterface } from "node:readline";
import { mkdir } from "node:fs/promises";
import { Pool } from "pg";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { verifyAccessToken } from "../src/server/auth.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./test-database.js";

const database = process.env.AMP_TEST_DATABASE_URL;
if (!database)
  throw Error(
    "AMP_TEST_DATABASE_URL is required; the fixture creates an isolated schema.",
  );
const schema = `amp_native_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: database, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(database);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const repository = new PostgresRepository(scoped.href);
const origin = "http://127.0.0.1:4441",
  issuer = `${origin}/`,
  clientId = "native-fixture",
  audience = "amp-fixture";
const pair = await generateKeyPair("ES256"),
  otherKey = await generateKeyPair("ES256");
const jwk = {
  ...(await exportJWK(pair.publicKey)),
  kid: "fixture",
  alg: "ES256",
  use: "sig",
};
const authenticate = async (request: any) => {
  const token = request.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ApiError(401, "Sign in to continue");
  try {
    return await verifyAccessToken(token, async () => pair.publicKey, {
      issuer,
      audience,
    });
  } catch {
    throw new ApiError(401, "Invalid session");
  }
};
const app = buildApp({ repository, authenticate });
await registerFamilyRoutes(app, { pool: repository.pool, authenticate });
const accounts = [`${issuer}|parent-a`, `${issuer}|parent-b`];
for (const account of accounts)
  await repository.pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','test-only','fixture')",
    [account],
  );
const learnerA = await repository.create(accounts[0], "Native learner"),
  learnerB = await repository.create(accounts[1], "Other learner");
for (const learner of [learnerA, learnerB])
  await repository.pool.query(
    "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'pilot',$1,'active',now()-interval '1 hour',now()+interval '1 hour')",
    [randomUUID(), learner.id],
  );
let mode = "valid",
  tokenCalls = 0,
  refreshCalls = 0,
  expiry = 3600;
let heldToken: (() => void) | null = null,
  heldApi: (() => void) | null = null;
let holdToken = false,
  holdApi = false;
const codes = new Map<
  string,
  { params: URLSearchParams; subject: string; mode: string }
>();
const refreshes = new Map<string, { subject: string; nonce: string }>();
const callbackQueue: string[] = [];
let trapCalls = 0;
const signing = async (
  payload: Record<string, unknown>,
  typ = "JWT",
  badKey = false,
) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", kid: "fixture", typ })
    .sign((badKey ? otherKey : pair).privateKey);
async function issue(subject: string, nonce: string, kind: string) {
  const now = Math.floor(Date.now() / 1000);
  const access = await signing(
    {
      iss: issuer,
      aud: audience,
      sub: kind === "wrong-access-identity" ? "parent-b" : subject,
      iat: now,
      exp: now + 3600,
    },
    "at+jwt",
  );
  const id = await signing(
    {
      iss: kind === "wrong-issuer" ? `${origin}/other` : issuer,
      aud: kind === "wrong-audience" ? "other-client" : clientId,
      sub: subject,
      iat: now,
      exp: kind === "expired" ? now - 10 : now + 3600,
      nonce: kind === "wrong-nonce" ? "incorrect" : nonce,
      ...(kind === "wrong-at-hash" ? { at_hash: "incorrect" } : {}),
    },
    "JWT",
    kind === "wrong-signature",
  );
  const refresh = randomUUID();
  refreshes.set(refresh, { subject, nonce });
  return {
    access_token: access,
    id_token: id,
    token_type: "Bearer",
    expires_in: expiry,
    refresh_token: refresh,
  };
}
const provider = httpServer(async (req, res) => {
  try {
    const url = new URL(req.url!, origin);
    if (url.pathname === "/trap") {
      trapCalls++;
      res.end();
      return;
    }
    if (url.pathname === "/jwks") {
      if (mode === "redirect-jwks") {
        res.writeHead(302, { location: `${origin}/trap` });
        res.end();
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    if (url.pathname === "/authorize") {
      assert.equal(url.searchParams.get("client_id"), clientId);
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.equal(
        url.searchParams.get("redirect_uri"),
        "inc.corpora.amp://oauth/callback",
      );
      assert.equal(url.searchParams.get("response_type"), "code");
      assert.equal(url.searchParams.get("resource"), audience);
      const code = randomUUID();
      codes.set(code, { params: url.searchParams, subject: "parent-a", mode });
      res.setHeader("content-type", "text/html");
      res.end(
        `<html><body><h1>Fixture parent authorization</h1><form method="post" action="/approve"><input type="hidden" name="code" value="${code}"><label>Parent<select name="parent" aria-label="Parent"><option value="parent-a">Parent A</option><option value="parent-b">Parent B</option></select></label><button>Authorize parent</button></form></body></html>`,
      );
      return;
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (url.pathname === "/approve") {
      const code = new URLSearchParams(raw).get("code")!,
        item = codes.get(code)!;
      item.subject =
        new URLSearchParams(raw).get("parent") === "parent-b"
          ? "parent-b"
          : "parent-a";
      const callback = new URL("inc.corpora.amp://oauth/callback");
      callback.searchParams.set("code", code);
      callback.searchParams.set("state", item.params.get("state")!);
      callback.searchParams.set("iss", issuer);
      callbackQueue.push(callback.href);
      res.setHeader("content-type", "text/html");
      res.end(
        "<h1>Authorization complete</h1><p>The controlled OS callback adapter can return to AMP.</p>",
      );
      return;
    }
    if (url.pathname === "/token") {
      tokenCalls++;
      if (mode === "redirect-token") {
        res.writeHead(302, { location: `${origin}/trap` });
        res.end();
        return;
      }
      const form = new URLSearchParams(raw);
      assert.equal(form.get("client_id"), clientId);
      assert.equal(form.has("client_secret"), false);
      assert.equal(req.headers.authorization, undefined);
      let subject: string,
        nonce: string,
        kind = mode;
      if (form.get("grant_type") === "refresh_token") {
        refreshCalls++;
        const value = refreshes.get(form.get("refresh_token")!);
        assert.ok(value);
        refreshes.delete(form.get("refresh_token")!);
        ({ subject, nonce } = value);
      } else {
        const code = form.get("code")!,
          item = codes.get(code);
        assert.ok(item);
        codes.delete(code);
        assert.equal(
          form.get("redirect_uri"),
          "inc.corpora.amp://oauth/callback",
        );
        assert.equal(
          createHash("sha256")
            .update(form.get("code_verifier")!)
            .digest("base64url"),
          item.params.get("code_challenge"),
        );
        subject = item.subject;
        nonce = item.params.get("nonce")!;
        kind = item.mode;
      }
      if (holdToken)
        await new Promise<void>((resolve) => {
          heldToken = resolve;
        });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(await issue(subject, nonce, kind)));
      return;
    }
    if (url.pathname.startsWith("/api/v1/")) {
      if (holdApi && url.pathname.endsWith("/progress"))
        await new Promise<void>((resolve) => {
          heldApi = resolve;
        });
      const response = await app.inject({
        method: req.method as any,
        url: req.url!,
        headers: req.headers as any,
        ...(raw ? { payload: raw } : {}),
      });
      res.statusCode = response.statusCode;
      res.setHeader(
        "content-type",
        response.headers["content-type"] ?? "application/json",
      );
      res.end(response.body);
      return;
    }
    res.statusCode = 404;
    res.end();
  } catch {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end('{"error":"Fixture request failed"}');
  }
});
await new Promise<void>((resolve) =>
  provider.listen(4441, "127.0.0.1", resolve),
);
const rust = spawn(
  "cargo",
  [
    "test",
    "--locked",
    "--manifest-path",
    "mobile/session-core/Cargo.toml",
    "session::tests::signed_provider_fixture",
    "--",
    "--ignored",
    "--exact",
    "--nocapture",
  ],
  { cwd: new URL("../", import.meta.url), stdio: ["pipe", "pipe", "pipe"] },
);
let sequence = 0;
const pending = new Map<
  number,
  { resolve: (v: any) => void; reject: (e: unknown) => void }
>();
const ready = new Promise<void>((resolve, reject) => {
  createInterface({ input: rust.stdout }).on("line", (line) => {
    if (line.endsWith("AMP_FIXTURE_READY")) resolve();
    if (line.startsWith("AMP_FIXTURE_RESULT ")) {
      const result = JSON.parse(line.slice(19));
      const task = pending.get(result.id);
      pending.delete(result.id);
      if ("error" in result) task?.reject(result.error);
      else task?.resolve(result.ok);
    }
  });
  rust.once("exit", (code) => {
    if (code !== 0) reject(Error(`Rust fixture exited ${code}`));
    for (const task of pending.values())
      task.reject(Error("Rust fixture stopped"));
  });
});
rust.stderr.on("data", (chunk) => process.stderr.write(chunk));
rust.stdin.write(
  JSON.stringify({
    issuer,
    authorization: `${origin}/authorize`,
    token: `${origin}/token`,
    jwks: `${origin}/jwks`,
    api: `${origin}/`,
    clientId,
    resource: audience,
  }) + "\n",
);
function rpc(command: string, args: Record<string, unknown> = {}) {
  return new Promise<any>((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Error("Rust fixture command timed out"));
    }, 60000);
    timeout.unref();
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    rust.stdin.write(JSON.stringify({ id, command, ...args }) + "\n");
  });
}
const vite = await createServer({
  server: { host: "127.0.0.1", port: 4440, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
const providerPage = await browser.newPage();
async function authorize(subject = "parent-a") {
  const url = await rpc("begin");
  const authorizationResponse = await providerPage.goto(url);
  assert.equal(
    authorizationResponse?.status(),
    200,
    "Synthetic authorization endpoint must accept the production authorization URL",
  );
  await providerPage
    .getByLabel("Parent", { exact: true })
    .selectOption(subject);
  await providerPage
    .getByRole("button", { name: "Authorize parent", exact: true })
    .click();
  await providerPage
    .getByRole("heading", { name: "Authorization complete" })
    .waitFor();
  return callbackQueue.shift()!;
}
async function waitUntil(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw Error("Fixture barrier was not reached");
}
try {
  await Promise.race([
    ready,
    new Promise<never>((_, reject) => {
      const timeout = setTimeout(
        () => reject(Error("Rust fixture readiness timed out")),
        180000,
      );
      timeout.unref();
    }),
  ]);
  for (const invalid of [
    "wrong-nonce",
    "wrong-issuer",
    "wrong-audience",
    "wrong-signature",
    "expired",
    "wrong-access-identity",
    "wrong-at-hash",
  ]) {
    mode = invalid;
    const callback = await authorize();
    await assert.rejects(
      rpc("complete", { url: callback }),
      (error) => error === "verification-failed",
    );
    assert.equal(await rpc("current"), null);
  }
  mode = "redirect-jwks";
  await assert.rejects(rpc("begin"), (error) => error === "unavailable");
  mode = "redirect-token";
  await assert.rejects(
    rpc("complete", { url: await authorize() }),
    (error) => error === "verification-failed",
  );
  assert.equal(
    trapCalls,
    0,
    "Identity HTTP requests must not follow redirects",
  );
  mode = "valid";
  let callback = await authorize();
  const wrongState = new URL(callback);
  wrongState.searchParams.set("state", "wrong");
  const before = tokenCalls;
  await assert.rejects(
    rpc("complete", { url: wrongState.href }),
    (error) => error === "invalid-callback",
  );
  await assert.rejects(
    rpc("complete", { url: callback.replace("/callback?", "/other?") }),
    (error) => error === "invalid-callback",
  );
  for (const malformed of [
    callback + "&state=duplicate",
    callback + "#fragment",
    callback + "&unexpected=value",
  ]) {
    await assert.rejects(
      rpc("complete", { url: malformed }),
      (error) => error === "invalid-callback",
    );
  }
  assert.equal(tokenCalls, before);
  const session = await rpc("complete", { url: callback });
  assert.equal(session.accountId, accounts[0]);
  assert.equal(session.token.includes("."), false);
  await assert.rejects(
    rpc("complete", { url: callback }),
    (error) => error === "invalid-callback",
  );
  assert.equal(tokenCalls, before + 1);
  const own = await rpc("request", {
    handle: session.token,
    request: { kind: "learners" },
  });
  assert.deepEqual(own.data.learners, [learnerA]);
  const initialPreference = await rpc("request", {
    handle: session.token,
    request: { kind: "starting-point", learnerId: learnerA.id },
  });
  assert.deepEqual(initialPreference.data, { band: null, policyVersion: null });
  for (const kind of ["starting-point", "set-starting-point"]) {
    const foreign = await rpc("request", {
      handle: session.token,
      request: {
        kind,
        learnerId: learnerB.id,
        ...(kind === "set-starting-point" ? { body: { band: "9–12" } } : {}),
      },
    });
    assert.equal(foreign.status, 404);
  }
  for (const body of [
    { band: "9-12" },
    { band: "9–12", excludedStrands: [] },
  ]) {
    const invalid = await rpc("request", {
      handle: session.token,
      request: { kind: "set-starting-point", learnerId: learnerA.id, body },
    });
    assert.equal(invalid.status, 400);
  }
  const savedPreference = await rpc("request", {
    handle: session.token,
    request: {
      kind: "set-starting-point",
      learnerId: learnerA.id,
      body: { band: "3–5" },
    },
  });
  assert.equal(savedPreference.status, 200);
  assert.deepEqual(savedPreference.data, { band: "3–5", policyVersion: 1 });
  const readPreference = await rpc("request", {
    handle: session.token,
    request: { kind: "starting-point", learnerId: learnerA.id },
  });
  assert.deepEqual(readPreference.data, savedPreference.data);

  const denied = await rpc("request", {
    handle: session.token,
    request: { kind: "batch", learnerId: learnerB.id, body: { count: 1 } },
  });
  assert.equal(denied.status, 404);
  const batch = await rpc("request", {
    handle: session.token,
    request: {
      kind: "batch",
      learnerId: learnerA.id,
      body: { templateId: "add-within-20", count: 1 },
    },
  });
  assert.equal(batch.status, 200);
  assert.equal("answer" in batch.data.problems[0], false);
  await repository.pool.query(
    "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id=$1",
    [accounts[0]],
  );
  const paused = await rpc("request", {
    handle: session.token,
    request: { kind: "batch", learnerId: learnerA.id, body: { count: 1 } },
  });
  assert.equal(
    paused.status,
    403,
    "Verified native identity must not bypass withdrawn consent",
  );
  const pausedPreference = await rpc("request", {
    handle: session.token,
    request: {
      kind: "set-starting-point",
      learnerId: learnerA.id,
      body: { band: "6–8" },
    },
  });
  assert.equal(pausedPreference.status, 403);

  await repository.pool.query(
    "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id=$1",
    [accounts[0]],
  );
  await repository.pool.query(
    "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
    [learnerA.id],
  );
  const unlicensed = await rpc("request", {
    handle: session.token,
    request: { kind: "batch", learnerId: learnerA.id, body: { count: 1 } },
  });
  assert.equal(
    unlicensed.status,
    403,
    "Verified native identity must not supply a learning entitlement",
  );
  await repository.pool.query(
    "UPDATE amp_grants SET status='active' WHERE learner_id=$1",
    [learnerA.id],
  );
  await rpc("logout");
  await assert.rejects(
    rpc("request", { handle: session.token, request: { kind: "learners" } }),
    (error) => error === "sign-in-required",
  );
  callback = await authorize();
  holdToken = true;
  const exchange = rpc("complete", { url: callback });
  void exchange.catch(() => {});
  await waitUntil(() => heldToken !== null);
  await assert.rejects(
    rpc("complete", { url: callback }),
    (error) => error === "invalid-callback",
  );
  await rpc("logout");
  holdToken = false;
  heldToken!();
  heldToken = null;
  await assert.rejects(exchange, (error) => error === "session-changed");
  assert.equal(await rpc("current"), null);
  const heldExchanges: Promise<unknown>[] = [];
  const releases: (() => void)[] = [];
  holdToken = true;
  for (let i = 0; i < 4; i++) {
    callback = await authorize();
    const exchange = rpc("complete", { url: callback });
    void exchange.catch(() => {});
    heldExchanges.push(exchange);
    await waitUntil(() => heldToken !== null);
    releases.push(heldToken!);
    heldToken = null;
  }
  await assert.rejects(rpc("begin"), (error) => error === "busy");
  holdToken = false;
  for (const release of releases) release();
  const exchangeResults = await Promise.allSettled(heldExchanges);
  assert.equal(
    exchangeResults.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.ok(
    exchangeResults
      .slice(0, 3)
      .every(
        (result) =>
          result.status === "rejected" && result.reason === "session-changed",
      ),
  );
  callback = await authorize();
  await rpc("complete", { url: callback });
  await rpc("logout");
  expiry = 20;
  callback = await authorize();
  const short = await rpc("complete", { url: callback });
  expiry = 3600;
  const refreshBefore = refreshCalls;
  await rpc("request", { handle: short.token, request: { kind: "learners" } });
  assert.equal(refreshCalls, refreshBefore + 1);
  holdApi = true;
  const oldRead = rpc("request", {
    handle: short.token,
    request: { kind: "progress", learnerId: learnerA.id },
  });
  void oldRead.catch(() => {});
  await waitUntil(() => heldApi !== null);
  await rpc("logout");
  holdApi = false;
  heldApi!();
  heldApi = null;
  await assert.rejects(oldRead, (error) => error === "session-changed");
  expiry = 20;
  callback = await authorize();
  const rotating = await rpc("complete", { url: callback });
  expiry = 3600;
  holdToken = true;
  const oldRefresh = rpc("request", {
    handle: rotating.token,
    request: { kind: "learners" },
  });
  void oldRefresh.catch(() => {});
  await waitUntil(() => heldToken !== null);
  await rpc("logout");
  holdToken = false;
  const newCallback = await authorize("parent-b");
  const other = await rpc("complete", { url: newCallback });
  (heldToken as (() => void) | null)!();
  heldToken = null;
  await assert.rejects(oldRefresh, (error) => error === "session-changed");
  assert.equal((await rpc("current")).accountId, accounts[1]);
  assert.equal(other.accountId, accounts[1]);
  await rpc("logout");
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  page.on("pageerror", (error) =>
    console.error("Native fixture page error:", error.message),
  );
  const browserApiRequests: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    browserApiRequests.push(route.request().url());
    return route.abort();
  });
  await page.exposeFunction(
    "nativeFixtureInvoke",
    async (command: string, args: any) => {
      if (command === "native_status")
        return {
          apiConfiguration: "configured",
          authentication: true,
          purchases: false,
          downloads: false,
          exports: false,
        };
      if (command === "native_session") return rpc("current");
      if (command === "read_public_resource") {
        const response = await app.inject({ url: `/api/v1/${args.resource}` });
        return response.json();
      }
      if (command === "native_learning_request")
        return rpc("request", { handle: args.handle, request: args.request });
      if (command === "native_sign_out") {
        await rpc("logout");
        await page.evaluate(() => {
          (window as any).nativeEmit({ session: null, error: null });
        });
        return;
      }
      if (command === "native_sign_in") {
        const callback = await authorize();
        const session = await rpc("complete", { url: callback });
        await page.evaluate((session) => {
          (window as any).nativeEmit({ session, error: null });
        }, session);
        return;
      }
      throw Error("Unexpected native command");
    },
  );
  await page.addInitScript(
    `window.isTauri=true;let next=1;const callbacks=new Map(),listeners=new Map();window.nativeEmit=payload=>{for(const [id,handler]of listeners)callbacks.get(handler)({event:'amp-session',id,payload});};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:(_event,id)=>listeners.delete(id)};window.__TAURI_INTERNALS__={transformCallback:fn=>{const id=next++;callbacks.set(id,fn);return id;},unregisterCallback:id=>callbacks.delete(id),invoke:async(command,args)=>{if(command==='plugin:event|listen'){const id=next++;listeners.set(id,args.handler);return id;}if(command==='plugin:event|unlisten'){listeners.delete(args.eventId);return;}return window.nativeFixtureInvoke(command,args);}};`,
  );
  await mkdir(new URL("../artifacts/native-session/", import.meta.url), {
    recursive: true,
  });
  await page.goto("http://127.0.0.1:4440");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const button = page.getByRole("button", {
      name: "Parent sign in",
      exact: true,
    });
    await button.waitFor();
    const box = await button.boundingBox();
    assert.ok(
      box &&
        box.y >= 0 &&
        box.y + box.height <= viewport.height &&
        box.height >= 44,
      "Native parent sign-in action must fit",
    );
    await page.screenshot({
      path: new URL(
        `../artifacts/native-session/sign-in-${viewport.width}.png`,
        import.meta.url,
      ).pathname,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Parent sign in" }).click();
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learnerA.id);
  await page
    .getByRole("button", { name: "Choose a starting point", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Where to begin?", exact: true })
    .waitFor();
  await page.getByRole("button", { name: /Algebra & functions/ }).click();
  await page
    .getByRole("button", {
      name: "Starting point: Algebra & functions",
      exact: true,
    })
    .waitFor();
  assert.equal(
    (
      await repository.pool.query(
        "SELECT starting_band FROM amp_learners WHERE id=$1",
        [learnerA.id],
      )
    ).rows[0].starting_band,
    "9–12",
  );
  await page
    .getByText("Looking for a particular idea?", { exact: true })
    .click();
  await page.getByLabel("Choose your practice").selectOption("add-within-20");
  await page
    .getByRole("button", { name: "Try this idea", exact: true })
    .click();
  await page.locator(".problem-stage").waitFor();
  assert.deepEqual(browserApiRequests, []);
  await mkdir(new URL("../artifacts/native-session/", import.meta.url), {
    recursive: true,
  });
  await page.screenshot({
    path: new URL(
      "../artifacts/native-session/practice-390.png",
      import.meta.url,
    ).pathname,
  });
  const prompt = await page.locator(".question").innerText();
  const givens = /What is (\d+) \+ (\d+)\?/.exec(prompt);
  assert.ok(givens);
  const answer = String(Number(givens[1]) + Number(givens[2]));
  for (const digit of answer)
    await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page.getByText("You’ve got it.", { exact: true }).waitFor();
  const attempts = await repository.pool.query(
    "SELECT outcome FROM amp_attempts WHERE learner_id=$1",
    [learnerA.id],
  );
  assert.equal(attempts.rowCount, 1);
  assert.equal(attempts.rows[0].outcome.correct, true);
  assert.equal(attempts.rows[0].outcome.assisted, false);
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page.locator(".progress-workspace").waitFor();
  await page
    .getByRole("button", { name: "Lesson library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open book", exact: true })
    .first()
    .click();
  await page.getByRole("region", { name: "Reading workspace" }).waitFor();
  assert.equal(await page.getByRole("button", { name: /Download/ }).count(), 0);
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.getByRole("button", { name: "Family menu" }).count();
  await page.getByLabel("Family menu").click();
  await page
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Family settings", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: /Purchase|Export|Delete|Withdraw/ })
      .count(),
    0,
  );
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    for (const name of ["Back to learning", "Sign out"]) {
      const box = await page
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(
        box &&
          box.y >= 0 &&
          box.y + box.height <= viewport.height &&
          box.height >= 44,
        "Native family actions must fit",
      );
    }
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
    await page.screenshot({
      path: new URL(
        `../artifacts/native-session/family-${viewport.width}.png`,
        import.meta.url,
      ).pathname,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Back to learning", exact: true })
    .click();
  await page.waitForFunction(
    () => document.activeElement?.getAttribute("aria-label") === "Family menu",
  );
  await page.getByLabel("Family menu").click();
  await page
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Parent sign in", exact: true })
    .waitFor();
  assert.equal(await page.locator(".problem-stage").count(), 0);
  assert.equal(await rpc("current"), null);
  assert.deepEqual(browserApiRequests, []);
  console.log(
    "Native production Rust session: signed-token negatives, PKCE, one-use callbacks, API identity/ownership, refresh, logout races and actual-app answer, progress, inline reading and sign-out passed.",
  );
} finally {
  holdToken = false;
  (heldToken as (() => void) | null)?.();
  holdApi = false;
  (heldApi as (() => void) | null)?.();
  rust.stdin.write('{"command":"exit"}\n');
  rust.stdin.end();
  await browser.close();
  await vite.close();
  await new Promise<void>((resolve) => provider.close(() => resolve()));
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
