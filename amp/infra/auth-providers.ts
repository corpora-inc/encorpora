/**
 * The intended state of AMP's sign-in apps at each provider. Microsoft is
 * applied through Microsoft Graph (infra/entra.ts). Google OAuth clients,
 * GitHub OAuth Apps and Apple Services IDs have no usable API: this is the
 * checklist a person follows in each console, and `npm run infra -- providers
 * check` finds the common drift (an unregistered redirect URI) without signing
 * in. Client ids and secrets live in each environment's secret, never here.
 */
import { brand } from "../src/brand.ts";
import {
  environments,
  localOrigin,
  type EnvironmentName,
} from "./environments.ts";

export const socialProviders = [
  "google",
  "github",
  "microsoft",
  "apple",
] as const;
export type SocialProvider = (typeof socialProviders)[number];

const prod = environments.prod.origin;
const stage = environments.stage.origin;

/** Better Auth's callback route for a provider. */
export const callbackUrl = (origin: string, provider: SocialProvider) =>
  `${origin}/api/auth/callback/${provider}`;

export interface ConsoleClient {
  name: string;
  homepage: string;
  /** Authorized JavaScript origins (Google only). */
  origins?: string[];
  redirectUris: string[];
}

/** Microsoft Graph delegated permissions, by name and permission id. These are
 * Microsoft's published, tenant-independent ids, not credentials. */
export const graphDelegatedScopes = {
  openid: "37f7f235-527c-4136-accd-4a02d197296e",
  profile: "14dad69e-099b-42c9-810b-d002981feec1",
  email: "64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0",
  offline_access: "7427e0e9-2fba-42fe-b0c0-848c9e6a8182", // gitleaks:allow (public permission id)
  "User.Read": "e1fe6dd8-ba31-4d61-89e7-88639da4683d",
} as const;
export const microsoftGraphAppId = "00000003-0000-0000-c000-000000000000";

export const authProviders = {
  google: {
    console:
      "Google Cloud console > Google Auth Platform (one project for AMP)",
    consentScreen: {
      appName: brand.name,
      homepage: prod,
      authorizedDomains: ["corpora.inc"],
      scopes: ["openid", "email", "profile"],
      audience: "External, In production",
    },
    /** One web client per deployed environment; stage also serves local development. */
    clients: {
      prod: {
        name: `${brand.name} production`,
        homepage: prod,
        origins: [prod],
        redirectUris: [callbackUrl(prod, "google")],
      },
      stage: {
        name: `${brand.name} stage`,
        homepage: stage,
        origins: [stage, localOrigin],
        redirectUris: [
          callbackUrl(stage, "google"),
          callbackUrl(localOrigin, "google"),
        ],
      },
    } satisfies Record<EnvironmentName, ConsoleClient>,
  },
  github: {
    console: "GitHub > corpora-inc organization > Settings > OAuth Apps",
    /** A GitHub OAuth App accepts one callback URL: one app per environment. */
    clients: {
      prod: {
        name: brand.name,
        homepage: prod,
        redirectUris: [callbackUrl(prod, "github")],
      },
      stage: {
        name: `${brand.name} (stage)`,
        homepage: stage,
        redirectUris: [callbackUrl(stage, "github")],
      },
    } satisfies Record<EnvironmentName, ConsoleClient>,
    deviceFlow: false,
  },
  microsoft: {
    console: "Microsoft Graph: npm run infra -- entra plan|apply",
    /** One registration serves every environment. */
    registration: {
      displayName: brand.name,
      signInAudience: "AzureADandPersonalMicrosoftAccount",
      requestedAccessTokenVersion: 2,
      redirectUris: [
        callbackUrl(prod, "microsoft"),
        callbackUrl(stage, "microsoft"),
        callbackUrl(localOrigin, "microsoft"),
      ],
      implicitGrant: false,
      /** xms_edov marks a verified email; without it Microsoft sign-up is refused. */
      idTokenOptionalClaims: ["email", "xms_edov"],
      graphDelegatedScopes: Object.keys(graphDelegatedScopes),
    },
  },
  apple: {
    console:
      "Apple Developer > Certificates, Identifiers & Profiles > Services IDs",
    /** One Services ID serves both deployed environments; Apple requires HTTPS. */
    servicesId: {
      identifier: "inc.corpora.amp.web",
      description: brand.name,
      primaryAppId: "inc.corpora.amp",
      domains: [new URL(prod).hostname, new URL(stage).hostname],
      returnUrls: [callbackUrl(prod, "apple"), callbackUrl(stage, "apple")],
    },
  },
} as const;

/** The redirect URIs the provider app used by an environment must accept. */
export function registeredRedirects(
  provider: SocialProvider,
  environment: EnvironmentName,
): readonly string[] {
  switch (provider) {
    case "google":
    case "github":
      return authProviders[provider].clients[environment].redirectUris;
    case "microsoft":
      return authProviders.microsoft.registration.redirectUris;
    case "apple":
      return authProviders.apple.servicesId.returnUrls;
  }
}
