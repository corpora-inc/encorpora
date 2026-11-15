import { accessGrantsFor, grantReserved } from "../src/account/adult-access.ts";
/**
 * The design preview's prices (scripts/design-preview.sh), development only:
 * with no Stripe account locally, the pitch, Billing and Continue would show
 * "unavailable". This answers the three read-only billing routes with the
 * real price list, in test mode, and each learner's status from the grant
 * ledger. Checkout itself still goes to the API and stays unavailable.
 * Vite loads it only when AMP_PREVIEW_PRICES=1 on the dev server.
 */
import { createHash } from "node:crypto";
import pg from "pg";

const offer = (amountMinor, interval, tier) => ({
  id: createHash("sha256").update(`preview-${tier}-${interval}`).digest("hex"),
  mode: "test",
  currency: "USD",
  amountMinor,
  formattedAmount: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountMinor / 100),
  interval,
  learnerCount: 1,
  tier,
});
const offers = [offer(59900, "year", "full"), offer(5900, "month", "full")];
const extraOffers = [
  offer(39900, "year", "extra"),
  offer(3900, "month", "extra"),
];

export function previewBilling(databaseUrl) {
  const pool = databaseUrl
    ? new pg.Pool({ connectionString: databaseUrl, max: 2 })
    : null;
  const send = (response, body) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(body));
  };
  return async (request, response, next) => {
    const path = (request.url ?? "").split("?")[0];
    if (request.method !== "GET") return next();
    if (path === "/api/v1/billing/prices")
      return send(response, { available: true, offers, extraOffers });
    if (path === "/api/v1/billing/offer")
      return send(response, {
        available: true,
        offer: offers[0],
        offers,
        extraOffers,
      });
    const status = /^\/api\/v1\/billing\/status\/([^/]+)$/.exec(path);
    if (status && pool) {
      const learnerId = decodeURIComponent(status[1]);
      try {
        const client = await pool.connect();
        let grant;
        try {
          await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
          const access = await accessGrantsFor(client, [learnerId]);
          grant = access.grants
            .filter((g) => grantReserved(g, access.now))
            .sort((a, b) => b.ends_at.getTime() - a.ends_at.getTime())[0];
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
        return send(
          response,
          grant
            ? {
                learnerId,
                phase: "licensed",
                interval: "year",
                tier: "full",
                startsAt: grant.starts_at.toISOString(),
                endsAt: grant.ends_at.toISOString(),
              }
            : { learnerId, phase: "ready", tier: "full" },
        );
      } catch (error) {
        console.error("preview billing status", error);
        return next();
      }
    }
    return next();
  };
}
