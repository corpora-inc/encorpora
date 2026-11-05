import {
  isPitchEntry,
  signupEntrySchema,
  type SignupIntent,
} from "../../parent-followup/contracts";
import { z } from "zod";
import {
  CAMPAIGN_NAMES,
  CAMPAIGN_PROGRAMS,
  CAMPAIGN_MEDIA,
  CAMPAIGN_SOURCES,
  CAMPAIGN_CREATIVES,
} from "../../analytics/campaign";

/**
 * `fund`: what the program's account is called ("your EFA balance").
 * `guarantee`: the 30-day money-back guarantee on this payment route: where
 * a refund goes and whether it is the full amount. `refundSummary`: the same
 * promise in one line at the point of sale. Policy:
 * https://corpora.inc/legal/refund/. A program without `guarantee` (any
 * future program until it is configured) follows its own refund rules.
 */
export const fundedPrograms = {
  "arkansas-efa": {
    slug: "arkansas-efa",
    path: "/purchase/arkansas-efa",
    id: "ar-efa",
    jurisdiction: "AR",
    name: "Arkansas EFA",
    fund: "EFA",
    // Refunds go to the child's EFA through ClassWallet, never to the account
    // holder: 6 CAR § 35-107(i)(1); ClassWallet, "Refund Overpayments".
    guarantee: { to: "your child’s EFA", full: true },
    refundSummary:
      "Ask within 30 days of payment, for any reason, and we refund the full amount to your child’s EFA account through ClassWallet.",
    helpUrl: "https://corpora.inc/esa/arkansas-efa/",
  },
  "new-hampshire-efa": {
    slug: "new-hampshire-efa",
    path: "/purchase/new-hampshire-efa",
    id: "nh-efa",
    jurisdiction: "NH",
    name: "New Hampshire EFA",
    fund: "EFA",
    // Refunds go to the child's EFA wallet in ClassWallet, issued within 30
    // days: Children's Scholarship Fund New Hampshire, policy PRO-06.
    guarantee: { to: "your child’s EFA", full: true },
    refundSummary:
      "Ask within 30 days of payment, for any reason, and we refund the full amount to your child’s EFA wallet in ClassWallet.",
    helpUrl: "https://corpora.inc/esa/new-hampshire-efa/",
  },
  "arizona-esa": {
    slug: "arizona-esa",
    path: "/purchase/arizona-esa",
    id: "az-esa",
    jurisdiction: "AZ",
    name: "Arizona ESA",
    fund: "ESA",
    // ESA money may not be refunded to the parent or student
    // (https://www.azleg.gov/ars/15/02402.htm, A.R.S. § 15-2402(J)); refunds
    // go by check to the Arizona Department of Education for the child's ESA
    // (ADE "Refund of ESA Award" form). The amount is the purchase as
    // received: the platform's fee may not come back, so never "full".
    guarantee: { to: "your child’s ESA", full: false },
    refundSummary:
      "Ask within 30 days of payment, for any reason, and we refund your purchase to your child’s ESA through the Arizona Department of Education.",
    helpUrl: "https://corpora.inc/esa/arizona-esa/",
  },
} as const;
/** Where a refund under the 30-day money-back guarantee goes, and whether
 * it is the whole payment. */
export type RefundGuarantee = { readonly to: string; readonly full: boolean };
/** Card payments: refunded in full to the card (https://corpora.inc/legal/refund/). */
export const cardGuarantee: RefundGuarantee = { to: "your card", full: true };
/** The guarantee on a payment route: card (no program), or a funded
 * program. A program that does not configure one is not covered. */
export function routeGuarantee(program?: {
  guarantee?: RefundGuarantee;
}): RefundGuarantee | null {
  if (!program) return cardGuarantee;
  return program.guarantee ?? null;
}
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
  program?: "ar-efa" | "az-esa" | "nh-efa";
  entry?: SignupIntent["entry"];
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
    // An ad entry label is measurement; a pitch choice is where the parent
    // asked to go, so it survives a privacy preference.
    ...(isPitchEntry(search.entry) ||
    (signupEntrySchema.safeParse(search.entry).success && !measurementOptOut())
      ? { entry: signupEntrySchema.parse(search.entry) }
      : {}),
    ...(search.program === "ar-efa" ||
    search.program === "az-esa" ||
    search.program === "nh-efa"
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
