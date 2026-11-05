import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { track } from "../../lib/analytics";
import type { FundedProgram } from "../../lib/funded-entry";
import { rememberPlanChoice } from "../../lib/pending-trial";
import { Button, buttonClass } from "../../ui/Button";
import { PlanChoice } from "../billing";
import { formatUsd } from "../billing/payment-url";
import type { InvoiceOffer } from "../funding/invoice-offers";
import { pitchTarget } from "./targets";
import styles from "./Pitch.module.css";

export const REFUND_POLICY_URL = "https://corpora.inc/legal/refund/";

/** Written like the card plans' server-formatted amounts ("$499.00"). */
export const formatPrice = formatUsd;

/**
 * Buy, offered only through a route that can succeed now. With a funded
 * program and its live offer: that program's no-account invoice first, card
 * second. Otherwise the card plans. With neither, nothing is offered.
 * Shared by the pitch and, later, the free trial.
 */
export function BuyOptions({
  program,
  fundedOffer,
  offers,
  search,
  signedIn = false,
}: {
  program?: FundedProgram;
  fundedOffer?: InvoiceOffer;
  offers: AnnualOffer[];
  search: Record<string, unknown>;
  signedIn?: boolean;
}) {
  const navigate = useNavigate();
  const [interval, choose] = useState<"year" | "month">("year");
  const offer =
    offers.find((entry) => entry.interval === interval) ?? offers[0] ?? null;
  function buyByCard(chosen: "year" | "month") {
    track("buy_click", { path: "card" });
    if (signedIn) {
      void navigate({ to: "/start/plan", search: { interval: chosen } });
      return;
    }
    // Sign-up continues straight to this plan's checkout.
    rememberPlanChoice(chosen);
    void navigate(pitchTarget("card", search));
  }
  if (program && fundedOffer)
    return (
      <div className={styles.buy} data-buy="funded">
        <Link
          className={buttonClass("primary", styles.buyButton)}
          {...pitchTarget("funded", search)}
          onClick={() => track("buy_click", { path: "funded" })}
        >
          Buy with {program.name} funds
        </Link>
        <p className={styles.buyTerms}>
          {formatPrice(fundedOffer.totalMinor)} for{" "}
          {fundedOffer.termMonths ?? 12} months · 30-day full refund
        </p>
        {offers.length > 0 && (
          <Button
            variant="quiet"
            className={styles.cardInstead}
            onClick={() => buyByCard("year")}
          >
            Pay by card instead
          </Button>
        )}
      </div>
    );
  if (!offer) return null;
  return (
    <div className={styles.buy} data-buy="card">
      <PlanChoice offers={offers} interval={offer.interval} onChange={choose} />
      <Button
        variant="primary"
        className={styles.buyButton}
        onClick={() => buyByCard(offer.interval)}
      >
        Buy AMP
      </Button>
      <p className={styles.buyTerms}>
        30-day full refund.{" "}
        <a href={REFUND_POLICY_URL} className={styles.inlineLink}>
          Refund policy
        </a>
      </p>
    </div>
  );
}
