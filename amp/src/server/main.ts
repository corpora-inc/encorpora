import { offlineSigningConfiguration } from "../offline/signing.js";
import { registerOfflineRoutes } from "../offline/routes.js";
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
import { PostgresRepository } from "./repository";
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
const development = process.env.AMP_AUTH_MODE === "development";
const host = process.env.AMP_HOST ?? "127.0.0.1";
if (development && !["127.0.0.1", "::1"].includes(host))
  throw new Error("Development API must bind to loopback");
if (!development && process.env.AMP_AUTH_MODE !== "oidc")
  throw new Error("Set AMP_AUTH_MODE to oidc or development");
if (!development && process.env.AMP_HOSTED_PILOT_READY !== "true")
  throw new Error(
    "Hosted pilot requires configured consent, privacy, support and identity flows; see deployment documentation",
  );
const repository = new PostgresRepository(required("AMP_DATABASE_URL"), {
  development,
});
const authenticate = development
  ? developmentAuth()
  : oidcAuth({
      issuer: required("AMP_OIDC_ISSUER"),
      audience: required("AMP_OIDC_AUDIENCE"),
      jwksUrl: required("AMP_OIDC_JWKS_URL"),
      accessTokenProfile:
        process.env.AMP_OIDC_TOKEN_PROFILE === "token-use-access"
          ? "token-use-access"
          : "rfc9068",
    });
const app = buildApp({ repository, authenticate, development, logger: true });
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
