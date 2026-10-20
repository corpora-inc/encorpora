/**
 * A drift check for the sign-in apps that have no API: open each configured
 * provider's authorize URL with every redirect URI the environment's app must
 * accept, without signing in, and look for the provider's "redirect URI not
 * registered" or "unknown client" page. Only a recognised rejection is an
 * error; a network failure or an unfamiliar page is a warning, so a provider's
 * outage or redesign never blocks a deploy.
 *
 * GitHub checks the redirect URI only after sign-in, so it cannot be checked
 * this way; it is reported as skipped.
 */
import { registeredRedirects, type SocialProvider } from "./auth-providers.ts";
import type { EnvironmentName } from "./environments.ts";
import { configuredProviders, settingGroups } from "./secrets.ts";

export type Verdict =
  | { status: "ok" }
  | { status: "drift"; reason: string }
  | { status: "unknown"; reason: string };

export interface Probe {
  provider: SocialProvider;
  redirectUri: string;
  url: string;
}

export function authorizeUrl(
  provider: Exclude<SocialProvider, "github">,
  clientId: string,
  redirectUri: string,
): string {
  const q = (params: Record<string, string>) =>
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      ...params,
    });
  switch (provider) {
    case "google":
      return `https://accounts.google.com/o/oauth2/v2/auth?${q({ response_type: "code", scope: "openid email profile" })}`;
    case "microsoft":
      // The consumers endpoint validates the redirect URI before any sign-in.
      return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${q({ response_type: "code", scope: "openid email profile" })}`;
    case "apple":
      return `https://appleid.apple.com/auth/authorize?${q({ response_type: "code", scope: "name email", response_mode: "form_post" })}`;
  }
}

/** Classify the page the authorize URL ends on. */
export function classify(
  provider: SocialProvider,
  response: { status: number; url: string; body: string },
): Verdict {
  const { status, url, body } = response;
  switch (provider) {
    case "google":
      if (body.includes("redirect_uri_mismatch"))
        return { status: "drift", reason: "redirect URI not registered" };
      if (/invalid_client|deleted_client/.test(body))
        return { status: "drift", reason: "client not found" };
      if (url.includes("/signin/oauth/error"))
        return { status: "drift", reason: "Google shows an error page" };
      if (status === 200 && url.includes("accounts.google.com"))
        return { status: "ok" };
      break;
    case "microsoft":
      if (body.includes("invalid_request") && body.includes("redirect_uri"))
        return { status: "drift", reason: "redirect URI not registered" };
      if (/unauthorized_client|AADSTS700016/.test(body))
        return { status: "drift", reason: "client not found" };
      if (status === 200 && /login\.(live|microsoftonline)\.com/.test(url))
        return { status: "ok" };
      break;
    case "apple":
      if (status === 403 || /invalid_client|invalid_request/.test(body))
        return {
          status: "drift",
          reason: "client id or return URL not registered",
        };
      if (status === 200) return { status: "ok" };
      break;
    case "github":
      break;
  }
  return {
    status: "unknown",
    reason: `HTTP ${status} at ${new URL(url).host}`,
  };
}

export function probes(
  environment: EnvironmentName,
  env: Record<string, string | undefined>,
): { probes: Probe[]; skipped: string[] } {
  const result: Probe[] = [];
  const skipped: string[] = [];
  for (const provider of configuredProviders(env)) {
    if (provider === "github") {
      skipped.push("github: GitHub checks the callback URL only after sign-in");
      continue;
    }
    const clientId = env[settingGroups[provider][0]]!;
    for (const redirectUri of registeredRedirects(provider, environment))
      result.push({
        provider,
        redirectUri,
        url: authorizeUrl(provider, clientId, redirectUri),
      });
  }
  return { probes: result, skipped };
}

export type Fetcher = (
  url: string,
) => Promise<{ status: number; url: string; body: string }>;

export const httpFetcher: Fetcher = async (url) => {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (AMP provider drift check)" },
    signal: AbortSignal.timeout(15_000),
  });
  return {
    status: response.status,
    url: response.url,
    body: await response.text(),
  };
};

export interface DriftReport {
  lines: string[];
  drift: number;
}

export async function checkProviders(
  environment: EnvironmentName,
  env: Record<string, string | undefined>,
  fetcher: Fetcher = httpFetcher,
): Promise<DriftReport> {
  const { probes: list, skipped } = probes(environment, env);
  const lines = [`Sign-in providers: ${environment}`];
  let drift = 0;
  for (const probe of list) {
    let verdict: Verdict;
    try {
      verdict = classify(probe.provider, await fetcher(probe.url));
    } catch (error) {
      verdict = {
        status: "unknown",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    const where = `${probe.provider} ${probe.redirectUri}`;
    if (verdict.status === "ok") lines.push(`  = ${where}`);
    else if (verdict.status === "drift") {
      drift++;
      lines.push(`  ! ${where}: ${verdict.reason}`);
    } else lines.push(`  ? ${where}: not checked (${verdict.reason})`);
  }
  for (const s of skipped) lines.push(`  - ${s}`);
  if (!list.length && !skipped.length)
    lines.push("  (no sign-in provider configured)");
  lines.push(
    drift
      ? `${drift} redirect URI(s) rejected: fix the provider console to match infra/auth-providers.ts.`
      : "No drift found.",
  );
  return { lines, drift };
}
