/**
 * The settings each environment's secret must hold: names only, never values.
 * `npm run infra -- env check --env <env>` reads the environment the API will
 * run with and fails, naming the settings, when a declared group is missing or
 * a sign-in provider is only partly configured.
 */
import {
  authProviders,
  socialProviders,
  type SocialProvider,
} from "./auth-providers.ts";
import { environments, type EnvironmentName } from "./environments.ts";

export const settingGroups = {
  server: [
    "AMP_DATABASE_URL",
    "AMP_DATABASE_POOL_MAX",
    "AMP_ACCOUNTS_URL",
    "AMP_ACCOUNTS_SECRET",
    "AMP_HOSTED_PILOT_READY",
    "AMP_CONSENT_POLICY_FILE",
  ],
  mail: ["AMP_MAIL_RESEND_API_KEY", "AMP_MAIL_FROM"],
  stripe: [
    "AMP_STRIPE_ENABLED",
    "AMP_STRIPE_MODE",
    "AMP_STRIPE_SECRET_KEY",
    "AMP_STRIPE_WEBHOOK_SECRET",
    "AMP_STRIPE_ACCOUNT_ID",
    "AMP_STRIPE_PRODUCT_ID",
    "AMP_STRIPE_PRICE_ID",
    "AMP_STRIPE_AMOUNT_MINOR",
    "AMP_STRIPE_MONTHLY_PRICE_ID",
    "AMP_STRIPE_MONTHLY_AMOUNT_MINOR",
    "AMP_STRIPE_CURRENCY",
    "AMP_STRIPE_SKU",
    "AMP_STRIPE_APP_ORIGIN",
    "AMP_STRIPE_PORTAL_CONFIGURATION_ID",
    "AMP_STRIPE_AUTOMATIC_TAX",
    "AMP_STRIPE_CONSENT_POLICY_VERSION",
    "AMP_PAYMENT_DOCUMENT_PROFILE",
    "AMP_PAYMENT_MONTHLY_DOCUMENT_PROFILE",
  ],
  "stripe-live": ["AMP_STRIPE_LIVE_APPROVED"],
  google: ["AMP_GOOGLE_CLIENT_ID", "AMP_GOOGLE_CLIENT_SECRET"],
  github: ["AMP_GITHUB_CLIENT_ID", "AMP_GITHUB_CLIENT_SECRET"],
  microsoft: ["AMP_MICROSOFT_CLIENT_ID", "AMP_MICROSOFT_CLIENT_SECRET"],
  apple: [
    "AMP_APPLE_CLIENT_ID",
    "AMP_APPLE_TEAM_ID",
    "AMP_APPLE_KEY_ID",
    "AMP_APPLE_PRIVATE_KEY",
  ],
} as const satisfies Record<string, readonly string[]>;
export type SettingGroup = keyof typeof settingGroups;

/** The groups each environment must have in full. */
export const environmentSettings: Record<
  EnvironmentName,
  readonly SettingGroup[]
> = {
  stage: ["server", "mail", "stripe", "google", "github", "microsoft", "apple"],
  prod: [
    "server",
    "mail",
    "stripe",
    "stripe-live",
    "google",
    "github",
    "microsoft",
    "apple",
  ],
};

export interface EnvReport {
  ok: string[];
  warnings: string[];
  errors: string[];
}

export function checkEnvironment(
  environment: EnvironmentName,
  env: Record<string, string | undefined>,
  declared: readonly SettingGroup[] = environmentSettings[environment],
): EnvReport {
  const report: EnvReport = { ok: [], warnings: [], errors: [] };
  const set = (name: string) => !!env[name]?.trim();
  const required = new Set<SettingGroup>(declared);
  for (const [group, names] of Object.entries(settingGroups) as [
    SettingGroup,
    readonly string[],
  ][]) {
    const missing = names.filter((name) => !set(name));
    const provider = (socialProviders as readonly string[]).includes(group);
    if (!missing.length) {
      report.ok.push(group);
      if (provider && !required.has(group))
        report.warnings.push(
          `${group} is configured but not declared for ${environment} (infra/secrets.ts)`,
        );
    } else if (required.has(group)) {
      report.errors.push(`${group}: missing ${missing.join(", ")}`);
    } else if (provider && missing.length < names.length) {
      // The API refuses to start with a partial provider; say which settings.
      report.errors.push(
        `${group} is partly configured: missing ${missing.join(", ")} (set all or none)`,
      );
    }
  }

  // Public values that must match the declarations.
  const origin = environments[environment].origin;
  const expect = (name: string, wanted: string) => {
    if (set(name) && env[name] !== wanted)
      report.errors.push(`${name} is not ${wanted}`);
  };
  expect("AMP_ACCOUNTS_URL", origin);
  expect("AMP_STRIPE_APP_ORIGIN", origin);
  expect("AMP_STRIPE_MODE", environments[environment].stripe.mode);
  expect("AMP_APPLE_CLIENT_ID", authProviders.apple.servicesId.identifier);
  return report;
}

export function configuredProviders(
  env: Record<string, string | undefined>,
): SocialProvider[] {
  return socialProviders.filter((p) =>
    settingGroups[p].every((name) => !!env[name]?.trim()),
  );
}

export function formatEnvReport(
  environment: EnvironmentName,
  report: EnvReport,
) {
  return [
    `Settings: ${environment}`,
    ...report.errors.map((e) => `  ! ${e}`),
    ...report.warnings.map((w) => `  ? ${w}`),
    `  = complete: ${report.ok.join(", ") || "none"}`,
    report.errors.length
      ? `${report.errors.length} error(s).`
      : "All declared settings are present.",
  ].join("\n");
}
