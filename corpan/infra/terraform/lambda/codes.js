// ---------------------------------------------------------------------------
// Code normalization + classification (pure, no external deps — unit testable)
// ---------------------------------------------------------------------------
//
// A single overloaded "Offer or affiliate code" field is resolved SERVER-SIDE.
// The client never classifies. It POSTs the raw string to /code/resolve and
// acts on the `kind` + `purchaseAction` we return. See AFFILIATE_CODES_PLAN.md
// §2 and §4.
//
// Registry "kinds" (stored on CODE#<code>/META.kind):
//   appleOfferCode   — Apple custom/one-time offer code, redeemed via the sheet
//   playPromo        — Play promo code (free-trial/free only), redeemed in Play UI
//   playOffer        — Play subscription offer (paid % discount) via offerToken
//   affiliate        — pure attribution, no discount
//   affiliate+offer  — both: a discount offer AND revenue-share attribution (LCCLT)
//
// Unknown (not in registry) codes are classified `affiliate` with a NORMAL
// purchase action and recorded UNVERIFIED — free-text, credited-but-not-paid.

const CODE_FORMAT = /^[A-Z0-9_-]{1,32}$/;

const KINDS = Object.freeze([
  "appleOfferCode",
  "playPromo",
  "playOffer",
  "affiliate",
  "affiliate+offer",
]);

const PURCHASE_ACTIONS = Object.freeze({
  NORMAL: "normal",
  APPLE_OFFER_CODE: "apple_offer_code",
  GOOGLE_PROMO_CODE: "google_promo_code",
  ANDROID_SUBSCRIPTION_OFFER: "android_subscription_offer",
});

/** Upper-case + strip ALL whitespace. Returns "" for nullish/empty. */
function normalizeCode(raw) {
  if (raw == null) return "";
  return String(raw).replace(/\s+/g, "").toUpperCase();
}

function isCodeFormatValid(code) {
  return CODE_FORMAT.test(code);
}

/**
 * Decide the platform purchaseAction.type for a (kind, platform) pair.
 *
 * The registry kind is platform-agnostic where possible; the platform decides
 * which redemption mechanism applies. An `affiliate+offer` code carries BOTH an
 * Apple offer (sheet) and/or a Play offer (token) — we pick by platform.
 */
function purchaseActionFor(kind, platform) {
  const isApple = platform === "ios" || platform === "macos";
  switch (kind) {
    case "appleOfferCode":
      // Apple offer codes only redeem on Apple platforms; elsewhere it is a
      // no-op normal purchase (the offer won't apply, but we still attribute).
      return isApple ? PURCHASE_ACTIONS.APPLE_OFFER_CODE : PURCHASE_ACTIONS.NORMAL;
    case "playPromo":
      return isApple ? PURCHASE_ACTIONS.NORMAL : PURCHASE_ACTIONS.GOOGLE_PROMO_CODE;
    case "playOffer":
      return isApple
        ? PURCHASE_ACTIONS.NORMAL
        : PURCHASE_ACTIONS.ANDROID_SUBSCRIPTION_OFFER;
    case "affiliate+offer":
      // Both: discount via the platform's offer mechanism + attribution.
      return isApple
        ? PURCHASE_ACTIONS.APPLE_OFFER_CODE
        : PURCHASE_ACTIONS.ANDROID_SUBSCRIPTION_OFFER;
    case "affiliate":
    default:
      return PURCHASE_ACTIONS.NORMAL;
  }
}

/** Does this registry kind carry revenue-share attribution we credit? */
function kindIsAffiliate(kind) {
  return kind === "affiliate" || kind === "affiliate+offer";
}

/** Does this registry kind carry a platform discount offer? */
function kindHasOffer(kind) {
  return (
    kind === "appleOfferCode" ||
    kind === "playPromo" ||
    kind === "playOffer" ||
    kind === "affiliate+offer"
  );
}

/** Is the registry entry currently active for the given clock? */
function isRegistryEntryActive(entry, now = Date.now()) {
  if (!entry) return false;
  if (entry.status && entry.status !== "active") return false;
  if (entry.validFrom && Date.parse(entry.validFrom) > now) return false;
  if (entry.validTo && Date.parse(entry.validTo) <= now) return false;
  return true;
}

/**
 * Classify a normalized code against a registry entry (or null if not found).
 *
 * Returns a plain descriptor; callers (the lambda route) turn it into the wire
 * response + mint the resolutionToken. Pure — no I/O, fully unit-testable.
 *
 * @param {string} code      normalized code
 * @param {object|null} entry registry META item (or null if not present)
 * @param {string} platform  "ios" | "macos" | "android"
 * @param {number} now       epoch ms (injectable for tests)
 */
function classifyCode(code, entry, platform, now = Date.now()) {
  // Unknown OR present-but-inactive (expired/paused) → treated as free-text
  // affiliate, UNVERIFIED, normal purchase. We still credit (quarantined) so
  // Ops can promote a frequently-seen organic code later.
  if (!entry || !isRegistryEntryActive(entry, now)) {
    return {
      status: "ok",
      code,
      kind: "affiliate",
      verified: false,
      purchaseAction: { type: PURCHASE_ACTIONS.NORMAL },
      partnerId: null,
      partnerName: undefined,
      discountLabel: undefined,
      registryVersion: 0,
      // An expired/paused KNOWN code is flagged so the response can explain it.
      inactiveKnown: Boolean(entry),
    };
  }

  const kind = KINDS.includes(entry.kind) ? entry.kind : "affiliate";
  const action = purchaseActionFor(kind, platform);

  const descriptor = {
    status: "ok",
    code,
    kind,
    verified: kindIsAffiliate(kind), // verified partner attribution
    purchaseAction: { type: action },
    partnerId: kindIsAffiliate(kind) ? entry.partnerId || null : null,
    partnerName: entry.displayName || entry.partnerName || undefined,
    discountLabel: kindHasOffer(kind) ? entry.discountLabel || undefined : undefined,
    registryVersion: Number(entry.registryVersion) || 1,
  };

  // Offer metadata so the client can re-select the platform offer.
  if (action === PURCHASE_ACTIONS.ANDROID_SUBSCRIPTION_OFFER) {
    descriptor.offer = {
      playOfferId: entry.playOfferId || null,
      playBasePlanId: entry.playBasePlanId || null,
      offerToken: null, // client re-reads from getProducts and matches by id
    };
  }
  if (action === PURCHASE_ACTIONS.APPLE_OFFER_CODE) {
    descriptor.appleOfferId = entry.appleOfferId || null;
    if (entry.appleRedeemUrl) descriptor.appleRedeemUrl = entry.appleRedeemUrl;
  }

  return descriptor;
}

module.exports = {
  CODE_FORMAT,
  KINDS,
  PURCHASE_ACTIONS,
  normalizeCode,
  isCodeFormatValid,
  purchaseActionFor,
  kindIsAffiliate,
  kindHasOffer,
  isRegistryEntryActive,
  classifyCode,
};
