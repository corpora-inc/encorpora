/**
 * The Microsoft sign-in app registration as code, through Microsoft Graph.
 * The desired state comes from infra/auth-providers.ts. Plan diffs it against
 * the live registration, or offline against an exported manifest (the Entra
 * portal's Manifest download, in Microsoft Graph format); apply PATCHes only
 * the properties that differ, then reads back and requires an empty plan.
 *
 * The registration is found by its application (client) id, which every
 * environment already has as AMP_MICROSOFT_CLIENT_ID. Graph access comes from
 * AMP_GRAPH_TOKEN, or from `az account get-access-token` after `az login`
 * (docs/external-config.md). Client secrets are never read or changed.
 */
import { execFileSync } from "node:child_process";
import {
  authProviders,
  graphDelegatedScopes,
  microsoftGraphAppId,
} from "./auth-providers.ts";

interface OptionalClaim {
  name: string;
  source: string | null;
  essential: boolean;
  additionalProperties: string[];
}

interface ResourceAccess {
  resourceAppId: string;
  resourceAccess: { id: string; type: string }[];
}

/** The subset of a Graph application this tool manages. */
export interface Registration {
  id?: string;
  appId?: string;
  displayName: string;
  signInAudience: string;
  api: { requestedAccessTokenVersion: number | null; [key: string]: unknown };
  web: {
    redirectUris: string[];
    implicitGrantSettings: {
      enableAccessTokenIssuance: boolean;
      enableIdTokenIssuance: boolean;
    };
    [key: string]: unknown;
  };
  optionalClaims: {
    idToken: OptionalClaim[];
    accessToken: OptionalClaim[];
    saml2Token: OptionalClaim[];
  } | null;
  requiredResourceAccess: ResourceAccess[];
}

const claim = (name: string): OptionalClaim => ({
  name,
  source: null,
  essential: false,
  additionalProperties: [],
});

export function desiredRegistration() {
  const r = authProviders.microsoft.registration;
  return {
    displayName: r.displayName,
    signInAudience: r.signInAudience,
    requestedAccessTokenVersion: r.requestedAccessTokenVersion,
    redirectUris: [...r.redirectUris],
    implicitGrant: r.implicitGrant,
    idTokenClaims: [...r.idTokenOptionalClaims],
    graphScopes: r.graphDelegatedScopes.map(
      (name) => graphDelegatedScopes[name as keyof typeof graphDelegatedScopes],
    ),
  };
}

export interface EntraChange {
  field: string;
  from: string;
  to: string;
}

export interface EntraPlan {
  changes: EntraChange[];
  /** PATCH bodies, in order: api first, because a personal-account audience requires token version 2. */
  patches: Record<string, unknown>[];
}

const list = (values: readonly string[]) =>
  values.length ? [...values].sort().join(", ") : "(none)";
const sameSet = (a: readonly string[], b: readonly string[]) =>
  list(a) === list(b);

export function planRegistration(live: Registration): EntraPlan {
  const want = desiredRegistration();
  const changes: EntraChange[] = [];
  const first: Record<string, unknown> = {};
  const second: Record<string, unknown> = {};

  if (
    live.api?.requestedAccessTokenVersion !== want.requestedAccessTokenVersion
  ) {
    changes.push({
      field: "api.requestedAccessTokenVersion",
      from: String(live.api?.requestedAccessTokenVersion ?? null),
      to: String(want.requestedAccessTokenVersion),
    });
    first.api = {
      ...live.api,
      requestedAccessTokenVersion: want.requestedAccessTokenVersion,
    };
  }
  if (live.displayName !== want.displayName) {
    changes.push({
      field: "displayName",
      from: live.displayName,
      to: want.displayName,
    });
    second.displayName = want.displayName;
  }
  if (live.signInAudience !== want.signInAudience) {
    changes.push({
      field: "signInAudience",
      from: live.signInAudience,
      to: want.signInAudience,
    });
    second.signInAudience = want.signInAudience;
  }

  const implicit = live.web?.implicitGrantSettings ?? {
    enableAccessTokenIssuance: false,
    enableIdTokenIssuance: false,
  };
  const implicitOn =
    implicit.enableAccessTokenIssuance || implicit.enableIdTokenIssuance;
  const redirects = live.web?.redirectUris ?? [];
  if (
    !sameSet(redirects, want.redirectUris) ||
    implicitOn !== want.implicitGrant
  ) {
    if (!sameSet(redirects, want.redirectUris))
      changes.push({
        field: "web.redirectUris",
        from: list(redirects),
        to: list(want.redirectUris),
      });
    if (implicitOn !== want.implicitGrant)
      changes.push({
        field: "web.implicitGrantSettings",
        from: String(implicitOn),
        to: String(want.implicitGrant),
      });
    // web is replaced as a whole: keep the URLs this tool does not manage.
    second.web = {
      ...(live.web?.homePageUrl !== undefined && {
        homePageUrl: live.web.homePageUrl,
      }),
      ...(live.web?.logoutUrl !== undefined && {
        logoutUrl: live.web.logoutUrl,
      }),
      redirectUris: want.redirectUris,
      implicitGrantSettings: {
        enableAccessTokenIssuance: want.implicitGrant,
        enableIdTokenIssuance: want.implicitGrant,
      },
    };
  }

  const idClaims = (live.optionalClaims?.idToken ?? []).map((c) => c.name);
  if (!sameSet(idClaims, want.idTokenClaims)) {
    changes.push({
      field: "optionalClaims.idToken",
      from: list(idClaims),
      to: list(want.idTokenClaims),
    });
    second.optionalClaims = {
      accessToken: live.optionalClaims?.accessToken ?? [],
      saml2Token: live.optionalClaims?.saml2Token ?? [],
      idToken: want.idTokenClaims.map(claim),
    };
  }

  const describe = (access: ResourceAccess[]) =>
    access.flatMap((r) =>
      r.resourceAccess.map((a) => {
        const scope = Object.entries(graphDelegatedScopes).find(
          ([, id]) => id === a.id,
        )?.[0];
        return r.resourceAppId === microsoftGraphAppId &&
          a.type === "Scope" &&
          scope
          ? `Graph ${scope}`
          : `${r.resourceAppId}/${a.type}/${a.id}`;
      }),
    );
  const wantAccess: ResourceAccess[] = [
    {
      resourceAppId: microsoftGraphAppId,
      resourceAccess: want.graphScopes.map((id) => ({ id, type: "Scope" })),
    },
  ];
  if (
    !sameSet(describe(live.requiredResourceAccess ?? []), describe(wantAccess))
  ) {
    changes.push({
      field: "requiredResourceAccess",
      from: list(describe(live.requiredResourceAccess ?? [])),
      to: list(describe(wantAccess)),
    });
    second.requiredResourceAccess = wantAccess;
  }

  return {
    changes,
    patches: [first, second].filter((p) => Object.keys(p).length),
  };
}

export function formatEntraPlan(plan: EntraPlan, target: string) {
  return [
    `Entra app registration: ${target}`,
    ...plan.changes.map((c) => `  ~ ${c.field}: ${c.from} -> ${c.to}`),
    plan.changes.length
      ? `${plan.changes.length} change(s) to apply.`
      : "No changes: the registration matches.",
  ].join("\n");
}

export function formatDesiredRegistration() {
  const want = desiredRegistration();
  return [
    "Entra app registration (desired):",
    `  displayName: ${want.displayName}`,
    `  signInAudience: ${want.signInAudience}`,
    `  api.requestedAccessTokenVersion: ${want.requestedAccessTokenVersion}`,
    `  web.redirectUris: ${want.redirectUris.join(", ")}`,
    `  web.implicitGrantSettings: off`,
    `  optionalClaims.idToken: ${want.idTokenClaims.join(", ")}`,
    `  Microsoft Graph delegated: ${authProviders.microsoft.registration.graphDelegatedScopes.join(", ")}`,
  ].join("\n");
}

const select =
  "id,appId,displayName,signInAudience,api,web,optionalClaims,requiredResourceAccess";

export interface GraphClient {
  read(appId: string): Promise<Registration>;
  patch(appId: string, body: Record<string, unknown>): Promise<void>;
}

export function graphToken(env: NodeJS.ProcessEnv): string {
  if (env.AMP_GRAPH_TOKEN) return env.AMP_GRAPH_TOKEN;
  try {
    return execFileSync(
      "az",
      [
        "account",
        "get-access-token",
        "--resource-type",
        "ms-graph",
        "--query",
        "accessToken",
        "-o",
        "tsv",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw new Error(
      "No Microsoft Graph access: run `az login --allow-no-subscriptions` as an owner of the app, or set AMP_GRAPH_TOKEN (docs/external-config.md).",
    );
  }
}

export function graphClient(token: string): GraphClient {
  const url = (appId: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(appId))
      throw new Error("AMP_MICROSOFT_CLIENT_ID is not an application id");
    return `https://graph.microsoft.com/v1.0/applications(appId='${appId}')`;
  };
  const call = async (input: string, init: RequestInit = {}) => {
    const response = await fetch(input, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      throw new Error(
        `Microsoft Graph ${init.method ?? "GET"} failed: HTTP ${response.status} ${detail?.error?.code ?? ""} ${detail?.error?.message ?? ""}`.trim(),
      );
    }
    return response;
  };
  return {
    async read(appId) {
      return (await (
        await call(`${url(appId)}?$select=${select}`)
      ).json()) as Registration;
    },
    async patch(appId, body) {
      await call(url(appId), { method: "PATCH", body: JSON.stringify(body) });
    },
  };
}

export async function applyRegistration(
  client: GraphClient,
  appId: string,
  log: (line: string) => void = console.log,
): Promise<EntraPlan> {
  const plan = planRegistration(await client.read(appId));
  log(formatEntraPlan(plan, "live"));
  for (const body of plan.patches) await client.patch(appId, body);
  if (plan.changes.length) {
    const after = planRegistration(await client.read(appId));
    if (after.changes.length) {
      log(formatEntraPlan(after, "after apply"));
      throw new Error("The registration still differs after apply.");
    }
    log(
      `Applied ${plan.changes.length} change(s); the registration now matches.`,
    );
  }
  return plan;
}
