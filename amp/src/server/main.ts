import { userSchema } from "../schools/clever/model.js";
import { registerSchoolAdoptionRoutes } from "../schools/adoption-routes.js";
import { CleverClient } from "../schools/clever/client.js";
import { SchoolError } from "../schools/contracts.js";
import { serverPoolOptions } from "./database.js";
import {
  registerDatabaseHealth,
  warmServer,
  watchRuntimeHealth,
} from "./runtime-health.js";
import { registerParentFollowupRoutes } from "../parent-followup/routes.js";
import { followupConfiguration } from "../parent-followup/mail.js";
import { registerAccessGiftRoutes } from "../access-grants/routes.js";
import { registerParentFeedbackRoutes } from "../feedback/parent-routes.js";
import { registerMetaPurchaseContextRoutes } from "../advertising/meta-context.js";
import { registerAcquisitionRoutes } from "../advertising/acquisition.js";
import { withAdvertisingPrivacySignals } from "../advertising/permission.js";
import { registerAdvertisingPermissionRoutes } from "../advertising/permission-routes.js";
import { isIP } from "node:net";
import {
  campaignOrigin,
  registerCampaignRoutes,
} from "../analytics/campaign-routes.js";
import { offlineSigningConfiguration } from "../offline/signing.js";
import { registerOfflineRoutes } from "../offline/routes.js";
import { registerAnalyticsRoutes } from "../analytics/routes.js";
import { loadReimbursementPrograms } from "../billing/evidence/reimbursement-config.js";
import { registerPaymentEvidenceRoutes } from "../billing/evidence/routes.js";
import { consentConfiguration } from "../parent-consent/config.js";
import { ConsentRepository } from "../parent-consent/repository.js";
import { registerConsentRoutes } from "../parent-consent/routes.js";
import { registerFundingPurchaseRoutes } from "../funding-purchase/routes.js";
import { loadFundingOffers } from "../funding-purchase/config.js";
import {
  loadClassWalletPayByConfig,
  registerClassWalletPayByRoutes,
} from "../funding-purchase/classwallet-payby.js";
import { registerFamilyRoutes } from "../family/routes.js";
import { registerDeleteAccountRoutes } from "../account/delete-account-routes.js";
import { linkSecretConfiguration } from "./link-secret.js";
import { startDemoWarmer } from "../schools/demo/shared.js";
import { shippedTermsProblem } from "../schools/demo/snapshot.js";
import { registerSchoolRoutes } from "../schools/routes.js";
import { registerCleverOnboarding } from "../schools/clever-onboarding.js";
import { schoolClock } from "../schools/clock.js";
import { schoolOidcProviders } from "../schools/oidc.js";
import { stripeConfig, stripeNamespace } from "../billing/stripe/config.js";
import {
  registerStripeRoutes,
  registerUnavailableBilling,
} from "../billing/stripe/routes.js";
import { buildApp } from "./app";
import { registerSearch } from "./search";
import { workbookRendererFromEnv } from "../workbook/pdf.js";
import { developmentAuth, oidcAuth, refuseStudentTokens } from "./auth";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "./accounts";
import { PostgresRepository } from "./repository";
import { freeProblemsSetting } from "./trials";
import { cleverAuthOptions, cleverConfiguration } from "./clever.js";
import { withProviderSessions } from "../identity/provider-principals.js";
import { registerCleverAuthRoutes } from "../schools/clever-auth.js";
import { resolveCleverPerson } from "../schools/clever/identity.js";
/** Comma-separated CIDRs, e.g. Google's load-balancer ranges plus the
 * ingress address. Anything else is a configuration error. */
function trustedProxies(value: string | undefined) {
  const list = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of list)
    if (!isIP(entry.split("/")[0]!) || !/^[^/]+(\/\d{1,3})?$/.test(entry))
      throw new Error(`Invalid AMP_TRUSTED_PROXIES entry: ${entry}`);
  return list;
}
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
const development = process.env.AMP_AUTH_MODE === "development";
const host = process.env.AMP_HOST ?? "127.0.0.1";
if (development && !["127.0.0.1", "::1"].includes(host))
  throw new Error("Development API must bind to loopback");
const authMode = process.env.AMP_AUTH_MODE;
if (!development && authMode !== "oidc" && authMode !== "accounts")
  throw new Error("Set AMP_AUTH_MODE to accounts, oidc or development");
if (!development && process.env.AMP_HOSTED_PILOT_READY !== "true")
  throw new Error(
    "Hosted pilot requires configured consent, privacy, support and identity flows; see deployment documentation",
  );
const accountsConfig =
  authMode === "accounts" ? accountsConfiguration(process.env) : undefined;
const cleverConfig = cleverConfiguration(process.env, accountsConfig);
const linkSecret = linkSecretConfiguration(process.env);
if (accountsConfig) accountsConfig.clever = !!cleverConfig;
const repository = new PostgresRepository(required("AMP_DATABASE_URL"), {
  pool: serverPoolOptions,
  development,
  freeProblems: freeProblemsSetting(process.env.AMP_FREE_PROBLEMS),
});
// AMP's own parent accounts (email, passkeys, Google, Apple, Microsoft,
// GitHub), stored in AMP's database.
const followupConfig = followupConfiguration(process.env);
const accounts = accountsConfig
  ? await createAccounts(repository.pool, accountsConfig)
  : null;
const baseIdentity = development
  ? developmentAuth()
  : accounts
    ? accountsAuth(accounts)
    : oidcAuth({
        issuer: required("AMP_OIDC_ISSUER"),
        audience: required("AMP_OIDC_AUDIENCE"),
        jwksUrl: required("AMP_OIDC_JWKS_URL"),
        accessTokenProfile:
          process.env.AMP_OIDC_TOKEN_PROFILE === "token-use-access"
            ? "token-use-access"
            : "rfc9068",
      });
const cleverPerson = (claims: {
  environment: "sandbox" | "production";
  districtId: string;
  userId: string;
}) => resolveCleverPerson(repository.pool, claims);
const authenticateIdentity = refuseStudentTokens(
  cleverConfig
    ? withProviderSessions(repository.pool, baseIdentity, {
        resolvePerson: cleverPerson,
      })
    : baseIdentity,
);
const authenticate = withAdvertisingPrivacySignals(
  repository.pool,
  authenticateIdentity,
);
const workbookRenderer = await workbookRendererFromEnv(
  process.env,
  development,
);
const app = buildApp({
  repository,
  authenticate,
  development,
  logger: true,
  trustedProxies: trustedProxies(process.env.AMP_TRUSTED_PROXIES),
  workbookRenderer,
  publicUrl: accounts?.config.baseURL,
});
if (!development && !process.env.AMP_RENDER_URL)
  app.log.warn(
    "AMP_RENDER_URL is not set: workbook PDF downloads answer 503 until the render service is configured",
  );
if (accounts) await registerAccountRoutes(app, accounts, authenticate);
// Without AMP accounts, the browser uses the development or OIDC flow.
else
  app.get("/api/v1/auth-config", async () => ({
    mode: development ? "development" : "oidc",
  }));
if (accounts && cleverConfig)
  await registerCleverAuthRoutes(
    app,
    cleverAuthOptions(repository.pool, accounts, cleverConfig, authenticate),
  );
await registerAdvertisingPermissionRoutes(app, {
  pool: repository.pool,
  authenticate,
});
if (accounts)
  await registerParentFollowupRoutes(app, {
    pool: repository.pool,
    authenticate,
    origin: accounts.config.baseURL,
    enabled: !!followupConfig,
  });
const billingConfig = stripeConfig(process.env);
await registerMetaPurchaseContextRoutes(app, {
  pool: repository.pool,
  authenticate,
  stripeNamespace: billingConfig ? stripeNamespace(billingConfig) : null,
});
await registerAccessGiftRoutes(app, {
  pool: repository.pool,
  authenticate,
  development,
});
await registerFamilyRoutes(app, {
  billingConfig,
  pool: repository.pool,
  authenticate,
  development,
  renderer: workbookRenderer,
  billingNamespace: billingConfig ? stripeNamespace(billingConfig) : null,
  approvals: {
    secret: linkSecret,
    origin: accounts?.config.baseURL ?? "",
    ...(accounts ? { mail: accounts.send } : {}),
  },
});
await registerDeleteAccountRoutes(app, {
  pool: repository.pool,
  authenticate,
  accounts: accounts ?? undefined,
  ...(cleverConfig ? { resolveCleverPerson: cleverPerson } : {}),
});
const schoolNow = schoolClock(process.env);
await registerSchoolRoutes(app, {
  pool: repository.pool,
  authenticate,
  services: {
    ...(schoolNow ? { now: schoolNow } : {}),
    secret: linkSecret,
    origin: accounts?.config.baseURL ?? "",
    learning: repository,
    renderer: workbookRenderer,
    ...(accounts ? { mail: accounts.send } : {}),
    signIn: {
      ...(accounts?.config.google
        ? { google: accounts.config.google.clientId }
        : {}),
      ...(accounts?.config.microsoft
        ? { microsoft: accounts.config.microsoft.clientId }
        : {}),
    },
    ...(accounts
      ? {
          oidc: schoolOidcProviders({
            ...(accounts.config.google
              ? { google: accounts.config.google }
              : {}),
            ...(accounts.config.microsoft
              ? { microsoft: accounts.config.microsoft }
              : {}),
          }),
        }
      : {}),
  },
});
await registerCleverOnboarding(app, {
  pool: repository.pool,
  authenticate,
  config: cleverConfig,
  worker: false,
  maintenance: true,
  origin: accounts?.config.baseURL,
});
await registerSchoolAdoptionRoutes(app, {
  pool: repository.pool,
  authenticate,
  origin: accounts?.config.baseURL,
  secret: linkSecret,
  ...(cleverConfig
    ? {
        cleverUser: async (connectionId: string, userId: string) => {
          const connection = (
            await repository.pool.query(
              "SELECT district_id FROM amp_clever_connections WHERE id=$1 AND environment=$2 AND status='active'",
              [connectionId, cleverConfig.environment],
            )
          ).rows[0];
          if (!connection) throw new SchoolError(404, "not_found");
          const client = new CleverClient(cleverConfig);
          return client.get(
            `/users/${userId}`,
            await client.districtToken(connection.district_id),
            userSchema,
          );
        },
      }
    : {}),
});
const fundingOffers = await loadFundingOffers(
  process.env.AMP_FUNDING_OFFERS_FILE,
);
await registerFundingPurchaseRoutes(app, {
  pool: repository.pool,
  authenticate,
  offers: fundingOffers,
});
await registerClassWalletPayByRoutes(app, {
  pool: repository.pool,
  authenticate,
  offers: fundingOffers,
  config: await loadClassWalletPayByConfig(process.env),
});
const consentConfig = await consentConfiguration(process.env);
await registerConsentRoutes(app, {
  authenticate,
  repository: new ConsentRepository(
    repository.pool,
    consentConfig.policy,
    consentConfig.secrets,
    consentConfig.transportEnabled,
  ),
});
await registerPaymentEvidenceRoutes(app, {
  pool: repository.pool,
  authenticate,
  reimbursementPrograms: await loadReimbursementPrograms(
    process.env.AMP_REIMBURSEMENT_PROGRAMS_FILE,
  ),
});
if (billingConfig) {
  if (development && billingConfig.livemode)
    throw new Error(
      "Live billing is forbidden with development authentication",
    );
  await registerStripeRoutes(app, {
    pool: repository.pool,
    authenticate,
    config: billingConfig,
    consentPolicy: consentConfig.policy,
  });
} else await registerUnavailableBilling(app, authenticate);
await registerOfflineRoutes(app, {
  pool: repository.pool,
  authenticate,
  signer: await offlineSigningConfiguration(process.env),
});
await registerAnalyticsRoutes(app, {
  pool: repository.pool,
  authenticate: authenticateIdentity,
  origin: campaignOrigin(process.env.AMP_CAMPAIGN_SITE_ORIGIN),
});
await registerParentFeedbackRoutes(app, { pool: repository.pool });
await registerCampaignRoutes(app, {
  pool: repository.pool,
  origin: campaignOrigin(process.env.AMP_CAMPAIGN_SITE_ORIGIN),
});
await registerAcquisitionRoutes(app, {
  pool: repository.pool,
  origin: campaignOrigin(process.env.AMP_CAMPAIGN_SITE_ORIGIN),
});
// Lesson search: lexical plus nearest neighbours, loading in the background.
registerSearch(app);
app.addHook("onClose", () => repository.close());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void app.close();
  });
registerDatabaseHealth(app, repository.pool);
const stopWatching = watchRuntimeHealth(app.log);
app.addHook("onClose", async () => stopWatching());
// Warm before listening: readiness passes only once the first parent is fast.
await warmServer(app, repository.pool);
await app.listen({ host, port: Number(process.env.AMP_PORT ?? 4311) });
// The demo's terms ship in the image; a pod never simulates one
// (src/schools/demo/snapshot.ts). Missing terms are a build bug: say so now.
const demoTermsProblem = shippedTermsProblem();
if (demoTermsProblem)
  app.log.error(
    { problem: demoTermsProblem },
    "demo terms are missing from this image; demos answer demo_preparing",
  );
// Each demo zone's shared school is written ahead of its day from those
// terms, so a visitor never waits for it (src/schools/demo/shared.ts): a
// bulk write once a night per zone. Outside production it is off unless
// AMP_DEMO_WARM=on; there the first demo request writes it.
const demoWarm = process.env.AMP_DEMO_WARM;
if (
  demoWarm === "on" ||
  (process.env.NODE_ENV === "production" && demoWarm !== "off")
)
  startDemoWarmer(repository.pool, app.log, repository);
