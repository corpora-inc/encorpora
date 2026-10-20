/**
 * AMP's external configuration: plan and apply what lives outside this
 * repository (docs/external-config.md).
 *
 *   npm run infra -- stripe desired                 desired state, no credentials
 *   npm run infra -- stripe plan  --env stage|prod  diff live state (AMP_STRIPE_* env)
 *   npm run infra -- stripe apply --env stage|prod  plan, then apply only the differences
 *
 * Credentials come from the environment the API runs with and are never
 * printed. Exit status: 0 success, 1 error (nothing applied), 2 usage.
 */
import { environmentName } from "../infra/environments.ts";
import {
  applyCatalog,
  formatDesired,
  formatPlan,
  planCatalog,
  stripeClient,
  stripeRuntime,
} from "../infra/stripe-sync.ts";

const usage = `usage: external-config.ts stripe desired
       external-config.ts stripe plan|apply --env stage|prod`;

function option(args: string[], name: string) {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

async function stripe(action: string | undefined, args: string[]) {
  if (action === "desired") {
    console.log(formatDesired());
    return;
  }
  if (action !== "plan" && action !== "apply") throw new UsageError();
  const environment = environmentName(option(args, "--env"));
  const runtime = stripeRuntime(process.env);
  const client = stripeClient(runtime.secretKey);
  if (action === "plan") {
    const plan = await planCatalog(environment, client, runtime);
    console.log(formatPlan(plan));
    if (plan.errors.length) process.exitCode = 1;
  } else await applyCatalog(environment, client, runtime);
}

class UsageError extends Error {}

const [area, action, ...rest] = process.argv.slice(2);
try {
  if (area === "stripe") await stripe(action, rest);
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
