import { z } from "zod";
import {
  CAMPAIGN_NAMES,
  CAMPAIGN_PROGRAMS,
  CAMPAIGN_MEDIA,
  CAMPAIGN_SOURCES,
  CAMPAIGN_CREATIVES,
} from "../../analytics/campaign";

export const fundedPath = "/purchase/arkansas-efa" as const;
export const fundedPrograms = {
  "arkansas-efa": {
    id: "ar-efa",
    jurisdiction: "AR",
    name: "Arkansas EFA",
    path: "/purchase/arkansas-efa",
  },
  "arizona-esa": {
    id: "az-esa",
    jurisdiction: "AZ",
    name: "Arizona ESA",
    path: "/purchase/arizona-esa",
  },
} as const;
export type FundedReturn = keyof typeof fundedPrograms;
export function isFundedReturn(value: unknown): value is FundedReturn {
  return value === "arkansas-efa" || value === "arizona-esa";
}
export function fundedDestination(value: FundedReturn) {
  return fundedPrograms[value].path;
}
const labels = z.object({
  utm_campaign: z.enum(CAMPAIGN_NAMES),
  utm_source: z.enum(CAMPAIGN_SOURCES),
  utm_medium: z.enum(CAMPAIGN_MEDIA),
  utm_content: z.enum(CAMPAIGN_CREATIVES).optional().catch(undefined),
});
export type CampaignSearch = Partial<z.infer<typeof labels>>;
export type FundedSearch = CampaignSearch & {
  return?: "security" | FundedReturn;
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

/** Only fixed internal destinations can survive authentication. */
export function continuationSearch(
  search: Record<string, unknown>,
): FundedSearch {
  return {
    ...campaignSearch(search),
    ...(search.return === "security" || isFundedReturn(search.return)
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
    safe.return === "security"
      ? "/family/security"
      : isFundedReturn(safe.return)
        ? fundedDestination(safe.return)
        : fallback;
  const params = new URLSearchParams(
    campaignSearch(safe) as Record<string, string>,
  );
  return path + (params.size ? `?${params}` : "");
}

/** Recheck privacy at the moment the parent prepares the financial request. */
export function fundedAttribution(
  search: Record<string, unknown>,
  offer?: { programId: string; jurisdiction: string },
) {
  const safe = campaignSearch(search);
  if (offer && safe.utm_campaign) {
    const expected = CAMPAIGN_PROGRAMS[safe.utm_campaign];
    if (
      offer.programId !== expected.programId ||
      offer.jurisdiction !== expected.state
    )
      return undefined;
  }
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
  labels: labels.partial(),
  destination: z.enum(["arkansas-efa", "arizona-esa"]).default("arkansas-efa"),
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
        labels: campaignSearch(search),
        destination: isFundedReturn(search.return)
          ? search.return
          : "arkansas-efa",
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
    return continuationUrl({ ...safe, return: parsed.data.destination });
  } catch {
    return null;
  }
}
