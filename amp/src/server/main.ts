import { isIP } from "node:net";
import { offlineSigningConfiguration } from "../offline/signing.js";
import { registerOfflineRoutes } from "../offline/routes.js";
import { loadReimbursementPrograms } from "../billing/evidence/reimbursement-config.js";
import { registerPaymentEvidenceRoutes } from "../billing/evidence/routes.js";
import { consentConfiguration } from "../parent-consent/config.js";
import { ConsentRepository } from "../parent-consent/repository.js";
import { registerConsentRoutes } from "../parent-consent/routes.js";
import { registerFundingPurchaseRoutes } from "../funding-purchase/routes.js";
import { loadFundingOffers } from "../funding-purchase/config.js";
import { registerFamilyRoutes } from "../family/routes.js";
import { stripeConfig } from "../billing/stripe/config.js";
import {
  registerStripeRoutes,
  registerUnavailableBilling,
} from "../billing/stripe/routes.js";
import { buildApp } from "./app";
import { developmentAuth, oidcAuth } from "./auth";
import {
  accountsAuth,
  accountsConfiguration,
  createAccounts,
  registerAccountRoutes,
} from "./accounts";
import { PostgresRepository } from "./repository";
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
const repository = new PostgresRepository(required("AMP_DATABASE_URL"), {
  development,
});
// AMP's own parent accounts (email, passkeys, Google, Apple, Microsoft,
// GitHub), stored in AMP's database.
const accounts =
  authMode === "accounts"
    ? await createAccounts(repository.pool, accountsConfiguration(process.env))
    : null;
const authenticate = development
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
const app = buildApp({
  repository,
  authenticate,
  development,
  logger: true,
  trustedProxies: trustedProxies(process.env.AMP_TRUSTED_PROXIES),
});
if (accounts) await registerAccountRoutes(app, accounts);
// Without AMP accounts, the browser uses the development or OIDC flow.
else
  app.get("/api/v1/auth-config", async () => ({
    mode: development ? "development" : "oidc",
  }));
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate,
  development,
});
await registerFundingPurchaseRoutes(app, {
  pool: repository.pool,
  authenticate,
  offers: await loadFundingOffers(process.env.AMP_FUNDING_OFFERS_FILE),
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
const billingConfig = stripeConfig(process.env);
if (billingConfig) {
  if (development && billingConfig.livemode)
    throw new Error(
      "Live billing is forbidden with development authentication",
    );
  await registerStripeRoutes(app, {
    pool: repository.pool,
    authenticate,
    config: billingConfig,
  });
} else await registerUnavailableBilling(app, authenticate);
await registerOfflineRoutes(app, {
  pool: repository.pool,
  authenticate,
  signer: await offlineSigningConfiguration(process.env),
});
app.addHook("onClose", () => repository.close());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ host, port: Number(process.env.AMP_PORT ?? 4311) });
