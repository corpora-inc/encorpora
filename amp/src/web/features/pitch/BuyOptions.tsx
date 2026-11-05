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

/** Whole dollars read "$499"; an amount with cents keeps them ("$49.50"). */
export function formatPrice(minor: number) {
  return minor % 100 === 0
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(minor / 100)
    : formatUsd(minor);
}

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
  // The pitch writes whole-dollar plans as "$499", like the saving badge.
  const plans = offers.map((entry) => ({
    ...entry,
    formattedAmount: formatPrice(entry.amountMinor),
  }));
  const offer =
    plans.find((entry) => entry.interval === interval) ?? plans[0] ?? null;
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
        {fundedOffer.statusLabel && (
          <p className={styles.trust} data-funding-status>
            <span aria-hidden="true">✓ </span>
            {fundedOffer.statusLabel}
          </p>
        )}
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
      <PlanChoice offers={plans} interval={offer.interval} onChange={choose} />
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
