/**
 * AMP's external configuration: plan and apply what lives outside this
 * repository (docs/external-config.md).
 *
 *   npm run infra -- stripe desired                    desired state, no credentials
 *   npm run infra -- stripe plan|apply --env <env>     Stripe product (AMP_STRIPE_* env)
 *   npm run infra -- env check --env <env>             the secret's declared settings
 *   npm run infra -- providers desired                 sign-in apps' intended state
 *   npm run infra -- providers check --env <env>       redirect URI drift, no sign-in
 *   npm run infra -- entra desired                     Microsoft registration, offline
 *   npm run infra -- entra plan --from <manifest.json> offline plan against an export
 *   npm run infra -- entra plan|apply                  live (AMP_MICROSOFT_CLIENT_ID)
 *
 * <env> is stage or prod. Credentials come from the environment and are never
 * printed. Exit status: 0 success, 1 error (nothing applied), 2 usage.
 */
import { readFileSync } from "node:fs";
import { authProviders } from "../infra/auth-providers.ts";
import {
  applyRegistration,
  formatDesiredRegistration,
  formatEntraPlan,
  graphClient,
  graphToken,
  planRegistration,
  type Registration,
} from "../infra/entra.ts";
import { environmentName } from "../infra/environments.ts";
import { checkProviders } from "../infra/provider-drift.ts";
import { checkEnvironment, formatEnvReport } from "../infra/secrets.ts";
import {
  applyCatalog,
  formatDesired,
  formatPlan,
  planCatalog,
  stripeClient,
  stripeRuntime,
} from "../infra/stripe-sync.ts";

class UsageError extends Error {}
const usage = `usage: external-config.ts stripe desired | stripe plan|apply --env <env>
       external-config.ts env check --env <env>
       external-config.ts providers desired | providers check --env <env>
       external-config.ts entra desired | entra plan --from <manifest.json> | entra plan|apply
<env> is stage or prod`;

function option(args: string[], name: string) {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}
const env = (args: string[]) => environmentName(option(args, "--env"));

async function stripe(action: string | undefined, args: string[]) {
  if (action === "desired") return console.log(formatDesired());
  if (action !== "plan" && action !== "apply") throw new UsageError();
  const environment = env(args);
  const runtime = stripeRuntime(process.env);
  const client = stripeClient(runtime.secretKey);
  if (action === "apply")
    return void (await applyCatalog(environment, client, runtime));
  const plan = await planCatalog(environment, client, runtime);
  console.log(formatPlan(plan));
  if (plan.errors.length) process.exitCode = 1;
}

function settings(action: string | undefined, args: string[]) {
  if (action !== "check") throw new UsageError();
  const environment = env(args);
  const report = checkEnvironment(environment, process.env);
  console.log(formatEnvReport(environment, report));
  if (report.errors.length) process.exitCode = 1;
}

async function providers(action: string | undefined, args: string[]) {
  if (action === "desired")
    return console.log(JSON.stringify(authProviders, null, 2));
  if (action !== "check") throw new UsageError();
  const report = await checkProviders(env(args), process.env);
  console.log(report.lines.join("\n"));
  if (report.drift) process.exitCode = 1;
}

async function entra(action: string | undefined, args: string[]) {
  if (action === "desired") return console.log(formatDesiredRegistration());
  if (action !== "plan" && action !== "apply") throw new UsageError();
  const from = option(args, "--from");
  if (from) {
    if (action === "apply") throw new UsageError();
    const manifest = JSON.parse(readFileSync(from, "utf8")) as Registration;
    return console.log(formatEntraPlan(planRegistration(manifest), from));
  }
  const appId = process.env.AMP_MICROSOFT_CLIENT_ID;
  if (!appId) throw new Error("AMP_MICROSOFT_CLIENT_ID is not set");
  const client = graphClient(graphToken(process.env));
  if (action === "apply") return void (await applyRegistration(client, appId));
  console.log(
    formatEntraPlan(planRegistration(await client.read(appId)), "live"),
  );
}

const [area, action, ...rest] = process.argv.slice(2);
try {
  if (area === "stripe") await stripe(action, rest);
  else if (area === "env") settings(action, rest);
  else if (area === "providers") await providers(action, rest);
  else if (area === "entra") await entra(action, rest);
  else throw new UsageError();
} catch (error) {
  if (error instanceof UsageError) {
    console.error(usage);
    process.exitCode = 2;
  } else {
    // Messages name settings and objects, never credential values.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `external-config: ${message.replace(/\b(sk|rk|whsec)_[A-Za-z0-9_*]+/g, "[redacted]")}`,
    );
    process.exitCode = 1;
  }
}
