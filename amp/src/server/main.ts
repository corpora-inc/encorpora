import { stripeConfig } from "../billing/stripe/config.js";
import { registerStripeRoutes } from "../billing/stripe/routes.js";
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
const repository = new PostgresRepository(required("AMP_DATABASE_URL"));
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
}
app.addHook("onClose", () => repository.close());
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void app.close();
  });
await app.listen({ host, port: Number(process.env.AMP_PORT ?? 4311) });
