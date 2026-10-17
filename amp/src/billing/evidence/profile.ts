import { createHash } from "node:crypto";
import { documentProfileSchema, type DocumentProfile } from "./contracts.js";
import type { StripeBillingConfig } from "../stripe/config.js";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function evidenceDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
export function parseDocumentProfile(
  input: unknown,
  config: StripeBillingConfig,
): DocumentProfile {
  const profile = documentProfileSchema.parse(input);
  const strings = [
    profile.seller.legalName,
    ...profile.seller.address,
    profile.seller.supportEmail,
    profile.seller.supportUrl,
    profile.seller.privacyUrl,
    profile.product.title,
    profile.product.description,
    profile.sku,
    profile.version,
  ];
  if (strings.some((value) => /[^\x20-\x7e\xa0-\xff€‘’“”–—…]/u.test(value)))
    throw new Error(
      "Payment document profile contains unsupported font characters",
    );
  if (
    profile.accountId !== config.accountId ||
    profile.livemode !== config.livemode ||
    profile.productId !== config.productId ||
    profile.priceId !== config.priceId ||
    profile.sku !== config.sku ||
    profile.currency !== config.currency ||
    profile.unitAmountMinor !== config.amountMinor
  )
    throw new Error(
      "Payment document profile does not match the merchant and catalog",
    );
  if (Date.parse(profile.reviewedAt) > Date.now())
    throw new Error("Payment document review cannot be in the future");
  return profile;
}
