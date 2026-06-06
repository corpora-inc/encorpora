import type { Continent } from "@world-plaza/contracts"

/**
 * geo.ts — privacy-safe, ON-DEVICE country detection + country→continent map.
 *
 * We need a coarse self-country ONLY to feed the server's k-anonymity histogram
 * (so the server can decide whether revealing it to another player is safe). We
 * derive it from the device's OWN locale region — never from IP, GPS, or any
 * network call. If we can't infer a region, we simply publish no country and the
 * player always reveals as "hidden". This is intentionally lossy: a coarse,
 * self-declared region is all the system ever holds, and the finer your true
 * location, the less of it ever leaves your device (none of it does here).
 *
 * The continent map is the standard ISO-3166 → continent grouping, trimmed to a
 * compact table; an unknown country resolves to no continent (→ hidden).
 */

/** Best-effort device region (ISO-3166-1 alpha-2, uppercase) or undefined. */
export function detectCountry(): string | undefined {
  try {
    // Prefer Intl.Locale.region from the resolved locale (no UGC, no network).
    const tag =
      (typeof Intl !== "undefined" &&
        Intl.DateTimeFormat().resolvedOptions().locale) ||
      (typeof navigator !== "undefined" ? navigator.language : "")
    if (!tag) return undefined
    // e.g. "en-US" → "US"; "es-419" (region code, not a country) → skip.
    const region =
      typeof Intl !== "undefined" && "Locale" in Intl
        ? new Intl.Locale(tag).maximize().region
        : tag.split("-")[1]
    if (region && /^[A-Z]{2}$/.test(region)) return region
    return undefined
  } catch (e) {
    console.warn("[mp/geo] country detection failed (publishing no place):", e)
    return undefined
  }
}

/** Map an ISO-3166-1 alpha-2 country to its continent, or undefined if unknown. */
export function continentOf(country: string | undefined): Continent | undefined {
  if (!country) return undefined
  return COUNTRY_CONTINENT[country.toUpperCase()]
}

/**
 * ISO-3166-1 alpha-2 → continent. Compact but covers the overwhelming majority
 * of players. Missing entries resolve to undefined (→ "hidden"), which is the
 * safe default. (Source: the standard UN/ISO continent grouping.)
 */
const COUNTRY_CONTINENT: Record<string, Continent> = {
  // North America
  US: "north-america", CA: "north-america", MX: "north-america", GT: "north-america",
  CU: "north-america", DO: "north-america", HT: "north-america", HN: "north-america",
  NI: "north-america", CR: "north-america", PA: "north-america", SV: "north-america",
  JM: "north-america", BS: "north-america", BZ: "north-america", TT: "north-america",
  // South America
  BR: "south-america", AR: "south-america", CO: "south-america", PE: "south-america",
  VE: "south-america", CL: "south-america", EC: "south-america", BO: "south-america",
  PY: "south-america", UY: "south-america", GY: "south-america", SR: "south-america",
  // Europe
  GB: "europe", IE: "europe", FR: "europe", DE: "europe", ES: "europe", PT: "europe",
  IT: "europe", NL: "europe", BE: "europe", LU: "europe", CH: "europe", AT: "europe",
  SE: "europe", NO: "europe", DK: "europe", FI: "europe", IS: "europe", PL: "europe",
  CZ: "europe", SK: "europe", HU: "europe", RO: "europe", BG: "europe", GR: "europe",
  HR: "europe", SI: "europe", RS: "europe", BA: "europe", MK: "europe", AL: "europe",
  ME: "europe", UA: "europe", BY: "europe", LT: "europe", LV: "europe", EE: "europe",
  RU: "europe", MD: "europe", MT: "europe", CY: "europe",
  // Asia
  CN: "asia", JP: "asia", KR: "asia", KP: "asia", IN: "asia", PK: "asia", BD: "asia",
  ID: "asia", PH: "asia", VN: "asia", TH: "asia", MY: "asia", SG: "asia", MM: "asia",
  KH: "asia", LA: "asia", NP: "asia", LK: "asia", TW: "asia", HK: "asia", MO: "asia",
  TR: "asia", IR: "asia", IQ: "asia", SA: "asia", AE: "asia", IL: "asia", JO: "asia",
  LB: "asia", SY: "asia", KW: "asia", QA: "asia", BH: "asia", OM: "asia", YE: "asia",
  KZ: "asia", UZ: "asia", AF: "asia", AZ: "asia", GE: "asia", AM: "asia", MN: "asia",
  // Africa
  NG: "africa", EG: "africa", ZA: "africa", KE: "africa", ET: "africa", GH: "africa",
  TZ: "africa", DZ: "africa", MA: "africa", TN: "africa", UG: "africa", SD: "africa",
  AO: "africa", CM: "africa", CI: "africa", SN: "africa", ZW: "africa", ZM: "africa",
  RW: "africa", ML: "africa", MZ: "africa", LY: "africa", MG: "africa",
  // Oceania
  AU: "oceania", NZ: "oceania", FJ: "oceania", PG: "oceania", WS: "oceania", TO: "oceania",
}
