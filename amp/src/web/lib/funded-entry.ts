import { z } from "zod";
import {
  CAMPAIGN_MEDIA,
  CAMPAIGN_SOURCES,
  CAMPAIGN_CREATIVES,
} from "../../analytics/campaign";

export const fundedPath = "/purchase/arkansas-efa" as const;
const labels = z.object({
  utm_campaign: z.literal("ar-efa-launch"),
  utm_source: z.enum(CAMPAIGN_SOURCES),
  utm_medium: z.enum(CAMPAIGN_MEDIA),
  utm_content: z.enum(CAMPAIGN_CREATIVES).optional().catch(undefined),
});
export type CampaignSearch = Partial<z.infer<typeof labels>>;
export type FundedSearch = CampaignSearch & {
  return?: "security" | "arkansas-efa";
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

/** Only these two internal destinations can survive authentication. */
export function continuationSearch(
  search: Record<string, unknown>,
): FundedSearch {
  return {
    ...campaignSearch(search),
    ...(search.return === "security" || search.return === "arkansas-efa"
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
      : safe.return === "arkansas-efa"
        ? fundedPath
        : fallback;
  const params = new URLSearchParams(
    campaignSearch(safe) as Record<string, string>,
  );
  return path + (params.size ? `?${params}` : "");
}

/** Recheck privacy at the moment the parent prepares the financial request. */
export function fundedAttribution(search: Record<string, unknown>) {
  const safe = campaignSearch(search);
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
    return continuationUrl({ ...safe, return: "arkansas-efa" });
  } catch {
    return null;
  }
}
