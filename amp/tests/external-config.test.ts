import assert from "node:assert/strict";
import { test } from "node:test";
import { SOCIAL_PROVIDERS } from "../src/server/accounts.ts";
import {
  authProviders,
  registeredRedirects,
  socialProviders,
} from "../infra/auth-providers.ts";
import {
  applyRegistration,
  desiredRegistration,
  planRegistration,
  type GraphClient,
  type Registration,
} from "../infra/entra.ts";
import { environments } from "../infra/environments.ts";
import { checkProviders, classify } from "../infra/provider-drift.ts";
import {
  checkEnvironment,
  environmentSettings,
  settingGroups,
} from "../infra/secrets.ts";

/** Every declared setting for an environment, with synthetic values. */
function completeEnv(environment: "stage" | "prod") {
  const env: Record<string, string> = {};
  for (const group of environmentSettings[environment])
    for (const name of settingGroups[group]) env[name] = "synthetic";
  env.AMP_ACCOUNTS_URL = environments[environment].origin;
  env.AMP_STRIPE_APP_ORIGIN = environments[environment].origin;
  env.AMP_STRIPE_MODE = environments[environment].stripe.mode;
  if (env.AMP_APPLE_CLIENT_ID)
    env.AMP_APPLE_CLIENT_ID = authProviders.apple.servicesId.identifier;
  return env;
}

test("the declared providers are the ones the server offers", () => {
  assert.deepEqual([...socialProviders].sort(), [...SOCIAL_PROVIDERS].sort());
});

test("redirect URIs use HTTPS except local development, and Apple has none local", () => {
  for (const environment of ["stage", "prod"] as const)
    for (const provider of socialProviders)
      for (const uri of registeredRedirects(provider, environment)) {
        const url = new URL(uri);
        assert.equal(url.pathname, `/api/auth/callback/${provider}`);
        assert.ok(
          url.protocol === "https:" ||
            (url.hostname === "localhost" && provider !== "apple"),
          uri,
        );
      }
});

test("a complete environment passes the settings check", () => {
  for (const environment of ["stage", "prod"] as const)
    assert.deepEqual(
      checkEnvironment(environment, completeEnv(environment)).errors,
      [],
    );
});

test("a missing setting or a partial provider fails, naming the settings", () => {
  const env = completeEnv("stage");
  delete env.AMP_STRIPE_WEBHOOK_SECRET;
  delete env.AMP_APPLE_KEY_ID;
  assert.deepEqual(checkEnvironment("stage", env).errors, [
    "stripe: missing AMP_STRIPE_WEBHOOK_SECRET",
    "apple: missing AMP_APPLE_KEY_ID",
  ]);

  // An undeclared provider may be absent or complete, never partial.
  const prod = completeEnv("prod");
  for (const name of settingGroups.github) delete prod[name];
  assert.match(checkEnvironment("prod", prod).errors[0], /^github: missing/);
});

test("an undeclared provider is complete or absent, never partial", () => {
  const declared = environmentSettings.stage.filter((g) => g !== "github");
  const env = completeEnv("stage");
  assert.deepEqual(checkEnvironment("stage", env, declared).warnings, [
    "github is configured but not declared for stage (infra/secrets.ts)",
  ]);
  delete env.AMP_GITHUB_CLIENT_SECRET;
  assert.deepEqual(checkEnvironment("stage", env, declared).errors, [
    "github is partly configured: missing AMP_GITHUB_CLIENT_SECRET (set all or none)",
  ]);
  for (const name of settingGroups.github) delete env[name];
  assert.deepEqual(checkEnvironment("stage", env, declared).errors, []);
});

test("public values must match the declarations", () => {
  const env = completeEnv("prod");
  env.AMP_ACCOUNTS_URL = environments.stage.origin;
  env.AMP_STRIPE_MODE = "test";
  assert.deepEqual(checkEnvironment("prod", env).errors, [
    `AMP_ACCOUNTS_URL is not ${environments.prod.origin}`,
    "AMP_STRIPE_MODE is not live",
  ]);
});

test("provider pages are classified by their own rejection markers", () => {
  const google = "https://accounts.google.com";
  assert.deepEqual(
    classify("google", {
      status: 200,
      url: `${google}/v3/signin/identifier`,
      body: "",
    }),
    { status: "ok" },
  );
  assert.equal(
    classify("google", {
      status: 200,
      url: `${google}/signin/oauth/error?authError=x`,
      body: 'data-error="redirect_uri_mismatch"',
    }).status,
    "drift",
  );
  assert.equal(
    classify("microsoft", {
      status: 200,
      url: "https://login.live.com/oauth20_authorize.srf",
      body: "invalid_request: The provided value for the input parameter 'redirect_uri' is not valid.",
    }).status,
    "drift",
  );
  assert.equal(
    classify("microsoft", {
      status: 200,
      url: "https://login.live.com/oauth20_authorize.srf",
      body: "<form>",
    }).status,
    "ok",
  );
  assert.equal(
    classify("apple", {
      status: 403,
      url: "https://appleid.apple.com/auth/authorize",
      body: "",
    }).status,
    "drift",
  );
  assert.equal(
    classify("apple", {
      status: 503,
      url: "https://appleid.apple.com/auth/authorize",
      body: "",
    }).status,
    "unknown",
  );
});

test("only a recognised rejection counts as drift; outages are warnings", async () => {
  const env = completeEnv("stage");
  const rejectGoogle = await checkProviders("stage", env, async (url) =>
    url.includes("accounts.google.com")
      ? {
          status: 200,
          url: "https://accounts.google.com/signin/oauth/error",
          body: "redirect_uri_mismatch",
        }
      : {
          status: 200,
          url: url.replace("login.microsoftonline.com", "login.live.com"),
          body: "",
        },
  );
  assert.equal(
    rejectGoogle.drift,
    registeredRedirects("google", "stage").length,
  );
  assert.ok(rejectGoogle.lines.some((l) => l.startsWith("  - github")));

  const outage = await checkProviders("stage", env, async () => {
    throw new Error("network down");
  });
  assert.equal(outage.drift, 0);
  assert.ok(outage.lines.some((l) => l.includes("not checked (network down)")));
});

test("Apple's bare 403 is drift only when Apple answered another return URL", async () => {
  const env = completeEnv("stage");
  const [first] = registeredRedirects("apple", "stage");
  const answer = (blockAll: boolean) => async (url: string) => {
    if (!url.includes("appleid.apple.com"))
      return {
        status: 200,
        url: url
          .replace("login.microsoftonline.com", "login.live.com")
          .replace(/o\/oauth2.*/, "v3/signin/identifier"),
        body: "",
      };
    const rejected = blockAll || url.includes(encodeURIComponent(first));
    return { status: rejected ? 403 : 200, url, body: "" };
  };
  assert.equal((await checkProviders("stage", env, answer(false))).drift, 1);
  const blocked = await checkProviders("stage", env, answer(true));
  assert.equal(blocked.drift, 0);
  assert.ok(
    blocked.lines.some((l) => l.includes("Apple refused every request")),
  );
});

/** A registration as the Entra portal creates it, before the setup steps. */
function portalDefault(): Registration {
  return {
    id: "object-id",
    appId: "00000000-0000-0000-0000-000000000000",
    displayName: "AMP",
    signInAudience: "AzureADMyOrg",
    api: { requestedAccessTokenVersion: null, oauth2PermissionScopes: [] },
    web: {
      homePageUrl: null,
      redirectUris: ["https://amp.corpora.inc/api/auth/callback/microsoft"],
      implicitGrantSettings: {
        enableAccessTokenIssuance: false,
        enableIdTokenIssuance: true,
      },
    },
    optionalClaims: null,
    requiredResourceAccess: [
      {
        resourceAppId: "00000003-0000-0000-c000-000000000000",
        resourceAccess: [
          { id: "e1fe6dd8-ba31-4d61-89e7-88639da4683d", type: "Scope" },
        ],
      },
    ],
  };
}

class FakeGraph implements GraphClient {
  patches: Record<string, unknown>[] = [];
  constructor(public registration: Registration) {}
  async read() {
    return structuredClone(this.registration);
  }
  async patch(_appId: string, body: Record<string, unknown>) {
    if (
      body.signInAudience === "AzureADandPersonalMicrosoftAccount" &&
      this.registration.api.requestedAccessTokenVersion !== 2
    )
      throw new Error("personal accounts require token version 2 first");
    this.patches.push(body);
    Object.assign(this.registration, structuredClone(body));
  }
}

test("the Entra plan names every difference and patches the token version first", () => {
  const plan = planRegistration(portalDefault());
  assert.deepEqual(
    plan.changes.map((c) => c.field),
    [
      "api.requestedAccessTokenVersion",
      "signInAudience",
      "web.redirectUris",
      "web.implicitGrantSettings",
      "optionalClaims.idToken",
      "requiredResourceAccess",
    ],
  );
  assert.deepEqual(Object.keys(plan.patches[0]), ["api"]);
  assert.equal(
    (plan.patches[0].api as { oauth2PermissionScopes: unknown[] })
      .oauth2PermissionScopes.length,
    0,
    "keeps the api properties it does not manage",
  );
});

test("Entra apply converges, then a second apply changes nothing", async () => {
  const graph = new FakeGraph(portalDefault());
  await applyRegistration(graph, "app", () => {});
  assert.equal(graph.patches.length, 2);
  assert.deepEqual(planRegistration(graph.registration).changes, []);
  const want = desiredRegistration();
  assert.deepEqual(graph.registration.web.redirectUris, want.redirectUris);
  assert.deepEqual(
    graph.registration.optionalClaims?.idToken.map((c) => c.name),
    ["email", "xms_edov"],
  );
  await applyRegistration(graph, "app", () => {});
  assert.equal(graph.patches.length, 2);
});
