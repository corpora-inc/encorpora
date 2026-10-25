import { z } from "zod";

export const REFERRER_CATEGORIES = [
  "direct",
  "search",
  "social",
  "email",
  "internal",
  "other",
] as const;
export const DEVICE_CLASSES = ["phone", "tablet", "desktop"] as const;
const label = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._~-]{1,64}$/);
export const entryContextSchema = z.strictObject({
  utmSource: label.optional(),
  utmMedium: label.optional(),
  utmCampaign: label.optional(),
  utmContent: label.optional(),
  referrer: z.enum(REFERRER_CATEGORIES),
  device: z.enum(DEVICE_CLASSES),
});
export type EntryContext = z.infer<typeof entryContextSchema>;

/** Keep only a category; no referring URL is retained. */
export function referrerCategory(
  referrer: string,
  ownHost: string,
): EntryContext["referrer"] {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (
    host === ownHost.toLowerCase() ||
    host === "corpora.inc" ||
    host.endsWith(".corpora.inc")
  )
    return "internal";
  if (/(^|\.)(mail\.google|outlook\.live|mail\.yahoo)\./.test(host))
    return "email";
  if (
    /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\./.test(
      host,
    )
  )
    return "search";
  if (
    /(^|\.)(facebook|instagram|t|x|twitter|linkedin|pinterest|reddit|youtube|tiktok|threads)\.(com|co|net)$/.test(
      host,
    )
  )
    return "social";
  return "other";
}
export function deviceClass(
  width: number,
  coarse: boolean,
): EntryContext["device"] {
  return width < 600 ? "phone" : coarse && width < 1100 ? "tablet" : "desktop";
}
export function entryContext(input: {
  search: string;
  hostname: string;
  referrer: string;
  width: number;
  coarse: boolean;
}): EntryContext {
  const query = new URLSearchParams(input.search);
  const clean = (name: string) => {
    const parsed = label.safeParse(query.get(name));
    return parsed.success ? parsed.data : undefined;
  };
  return {
    utmSource: clean("utm_source"),
    utmMedium: clean("utm_medium"),
    utmCampaign: clean("utm_campaign"),
    utmContent: clean("utm_content"),
    referrer: referrerCategory(input.referrer, input.hostname),
    device: deviceClass(input.width, input.coarse),
  };
}
