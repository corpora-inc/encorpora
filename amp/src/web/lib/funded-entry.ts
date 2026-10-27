import { signupEntrySchema } from "../../parent-followup/contracts";
import { z } from "zod";
import {
  CAMPAIGN_NAMES,
  CAMPAIGN_PROGRAMS,
  CAMPAIGN_MEDIA,
  CAMPAIGN_SOURCES,
  CAMPAIGN_CREATIVES,
} from "../../analytics/campaign";

export const fundedPrograms = {
  "arkansas-efa": {
    slug: "arkansas-efa",
    path: "/purchase/arkansas-efa",
    id: "ar-efa",
    jurisdiction: "AR",
    name: "Arkansas EFA",
    helpUrl: "https://corpora.inc/esa/arkansas-efa/",
  },
  "new-hampshire-efa": {
    slug: "new-hampshire-efa",
    path: "/purchase/new-hampshire-efa",
    id: "nh-efa",
    jurisdiction: "NH",
    name: "New Hampshire EFA",
    helpUrl: "https://corpora.inc/esa/new-hampshire-efa/",
  },
  "arizona-esa": {
    slug: "arizona-esa",
    path: "/purchase/arizona-esa",
    id: "az-esa",
    jurisdiction: "AZ",
    name: "Arizona ESA",
    helpUrl: "https://corpora.inc/esa/arizona-esa/",
  },
} as const;
export type FundedProgramSlug = keyof typeof fundedPrograms;
export type FundedProgram = (typeof fundedPrograms)[FundedProgramSlug];
export type FundedPath = FundedProgram["path"];
export const fundedPath = fundedPrograms["arkansas-efa"].path;
export const fundedReturnSchema = z.enum([
  "arkansas-efa",
  "new-hampshire-efa",
  "arizona-esa",
]);
export function isFundedReturn(value: unknown): value is FundedProgramSlug {
  return typeof value === "string" && Object.hasOwn(fundedPrograms, value);
}
export function fundedProgramForPath(path: string): FundedProgram | undefined {
  return Object.values(fundedPrograms).find((program) => program.path === path);
}
const labels = z.object({
  utm_campaign: z.enum(CAMPAIGN_NAMES),
  utm_source: z.enum(CAMPAIGN_SOURCES),
  utm_medium: z.enum(CAMPAIGN_MEDIA),
  utm_content: z.enum(CAMPAIGN_CREATIVES).optional().catch(undefined),
});
export type CampaignSearch = Partial<z.infer<typeof labels>>;
export type FundedSearch = CampaignSearch & {
  return?: "security" | "access" | "free-practice" | FundedProgramSlug;
  program?: "ar-efa" | "az-esa";
  entry?: "openai-math-path" | "openai-math-plans";
};

export function measurementOptOut() {
  if (typeof navigator === "undefined") return false;
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return privacy.globalPrivacyControl === true || navigator.doNotTrack === "1";
}

/** Fixed labels only. No visitor, click, account or learner identifier. */
export function campaignSearch(
  search: Record<string, unknown>,
  optedOut = measurementOptOut(),
): CampaignSearch {
  const parsed = labels.safeParse(search);
  if (optedOut || !parsed.success) return {};
  const { utm_content, ...required } = parsed.data;
  return { ...required, ...(utm_content ? { utm_content } : {}) };
}

/** Only allowlisted internal destinations can survive authentication. */
export function continuationSearch(
  search: Record<string, unknown>,
): FundedSearch {
  return {
    ...campaignSearch(search),
    ...(signupEntrySchema.safeParse(search.entry).success &&
    !measurementOptOut()
      ? { entry: signupEntrySchema.parse(search.entry) }
      : {}),
    ...(search.program === "ar-efa" || search.program === "az-esa"
      ? { program: search.program }
      : {}),
    ...(search.return === "security" ||
    search.return === "access" ||
    search.return === "free-practice" ||
    isFundedReturn(search.return)
      ? { return: search.return }
      : {}),
  };
}

export function continuationUrl(
  search: Record<string, unknown>,
  fallback = "/start",
) {
  const safe = continuationSearch(search);
  const path =
    safe.return === "free-practice"
      ? "/try"
      : safe.return === "access"
        ? "/access"
        : safe.return === "security"
          ? "/family/security"
          : isFundedReturn(safe.return)
            ? fundedPrograms[safe.return].path
            : fallback;
  const params = new URLSearchParams({
    ...campaignSearch(safe),
    ...(safe.program ? { program: safe.program } : {}),
    ...(safe.entry ? { entry: safe.entry } : {}),
    ...(safe.return === "free-practice" ? { return: safe.return } : {}),
  } as Record<string, string>);
  return path + (params.size ? `?${params}` : "");
}

/** Recheck privacy at the moment the parent prepares the financial request. */
export function fundedAttribution(
  search: Record<string, unknown>,
  program?: { programId: string; jurisdiction: string },
) {
  const safe = campaignSearch(search);
  if (
    program &&
    (!safe.utm_campaign ||
      CAMPAIGN_PROGRAMS[safe.utm_campaign].programId !== program.programId ||
      CAMPAIGN_PROGRAMS[safe.utm_campaign].state !== program.jurisdiction)
  )
    return undefined;
  return safe.utm_campaign && safe.utm_source && safe.utm_medium
    ? {
        campaign: safe.utm_campaign,
        source: safe.utm_source,
        medium: safe.utm_medium,
        ...(safe.utm_content ? { creative: safe.utm_content } : {}),
      }
    : undefined;
}

const pendingPrefix = "amp.pending-funded-purchase.";
const pendingLifetime = 7 * 24 * 60 * 60 * 1000;
const pendingSchema = z.strictObject({
  expiresAt: z.number().finite(),
  destination: fundedReturnSchema.optional(),
  labels: labels.partial(),
});

/** A pending parent purchase, scoped to the authenticated account on this device.
 * Needed when the two consent emails open new tabs. Never holds a consent token. */
export function rememberFundedPurchase(
  accountId: string,
  search: Record<string, unknown>,
) {
  try {
    localStorage.setItem(
      pendingPrefix + accountId,
      JSON.stringify({
        expiresAt: Date.now() + pendingLifetime,
        destination: isFundedReturn(search.return)
          ? search.return
          : "arkansas-efa",
        labels: campaignSearch(search),
      }),
    );
  } catch {
    /* The current tab's URL still supports continuation. */
  }
}

export function forgetFundedPurchase(accountId: string) {
  try {
    localStorage.removeItem(pendingPrefix + accountId);
  } catch {}
}

export function pendingFundedPurchase(accountId: string): string | null {
  try {
    const raw = localStorage.getItem(pendingPrefix + accountId);
    if (!raw) return null;
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.expiresAt <= Date.now() ||
      parsed.data.expiresAt > Date.now() + pendingLifetime
    ) {
      forgetFundedPurchase(accountId);
      return null;
    }
    const safe = campaignSearch(parsed.data.labels);
    // Honor a privacy preference changed after the purchase flow began.
    localStorage.setItem(
      pendingPrefix + accountId,
      JSON.stringify({ ...parsed.data, labels: safe }),
    );
    return continuationUrl({
      ...safe,
      return: parsed.data.destination ?? "arkansas-efa",
    });
  } catch {
    return null;
  }
}
