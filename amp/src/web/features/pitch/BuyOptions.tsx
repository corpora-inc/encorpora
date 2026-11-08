import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { track } from "../../lib/analytics";
import { queryClient } from "../../lib/query";
import type { FundedProgram } from "../../lib/funded-entry";
import { rememberPlanChoice } from "../../lib/pending-trial";
import { Button, buttonClass, type ButtonVariant } from "../../ui/Button";
import { PlanChoice } from "../billing";
import { formatUsd } from "../billing/payment-url";
import {
  invoiceOffersOptions,
  offerRefunds,
  type InvoiceOffer,
} from "../funding/invoice-offers";
import { pricesOptions } from "../trial/api";
import { pitchProgram, pitchTarget } from "./targets";
import styles from "./Pitch.module.css";

export const REFUND_POLICY_URL = "https://corpora.inc/legal/refund/";
/** The guarantee, the same on every route that carries it; the asterisk
 * points to `GUARANTEE_FOOTNOTE` (https://corpora.inc/legal/refund/). */
// Non-breaking hyphens (U+2011): "money‑back" never splits across lines.
export const GUARANTEE_LINE = "30‑day money‑back guarantee*";
/** Without its asterisk: where the asterisk is a link to the policy. */
export const GUARANTEE_SHORT = "30‑day money‑back";
export const GUARANTEE_FOOTNOTE =
  "*Refunds go back the way you paid: to your card, or to your child’s education‑fund account. A few education programs don’t allow refunds; if yours is one, we’ll tell you before you pay.";

/** Whole dollars read "$599"; an amount with cents keeps them ("$49.50"). */
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

/** The annual price per day, rounded up to the next 10 cents, so "under" is
 * always true: $599 a year is $1.641 a day, written "under $1.70". */
export function underPerDay(annualMinor: number) {
  return formatUsd((Math.floor(annualMinor / 365 / 10) + 1) * 10);
}

/** Loads what Buy needs before a screen paints, so Buy never appears late
 * and moves the page. A failure stays for the screen to show in place. */
export function loadBuyData(search: Record<string, unknown>) {
  const program = pitchProgram(search.program);
  return Promise.all([
    queryClient.ensureQueryData(pricesOptions).catch(() => undefined),
    program
      ? queryClient
          .ensureQueryData(invoiceOffersOptions(program.id))
          .catch(() => undefined)
      : undefined,
  ]);
}

export type BuyData = {
  program?: FundedProgram;
  fundedOffer?: InvoiceOffer;
  offers: AnnualOffer[];
  /** Each additional child's price, when this environment sells one. */
  extraOffers?: AnnualOffer[];
  failed: boolean;
  retry: () => void;
};
/** What Buy can sell here: the named funded program's live offer and the card
 * plans. Both come from the server; nothing is priced in the client. */
export function useBuyData(search: Record<string, unknown>): BuyData {
  const program = pitchProgram(search.program);
  const prices = useQuery(pricesOptions);
  const funded = useQuery({
    ...invoiceOffersOptions(program?.id ?? ""),
    enabled: !!program,
  });
  const fundedOffer = funded.data?.offers[0];
  return {
    program,
    fundedOffer,
    offers: prices.data?.available ? prices.data.offers : [],
    extraOffers: prices.data?.available ? prices.data.extraOffers : undefined,
    failed: !!prices.error && (!program || !fundedOffer),
    retry: () => {
      void prices.refetch();
      if (program) void funded.refetch();
    },
  };
}

export type BuyFrom = "pitch" | "chrome" | "invite";

/**
 * Buy, offered only through a route that can succeed now. With a funded
 * program and its live offer: that program's no-account invoice first, card
 * second. Otherwise the card plans. With neither, nothing is offered.
 * `full` shows the plan choice and terms (the pitch); `button` is one
 * control (the pitch's closing, the trial's toolbar and invitations).
 */
export function BuyOptions({
  data,
  search,
  signedIn = false,
  from,
  variant = "full",
  buttonVariant = "primary",
  label,
  ariaLabel,
  interval: chosen,
  onInterval,
}: {
  data: Pick<BuyData, "program" | "fundedOffer" | "offers" | "extraOffers">;
  search: Record<string, unknown>;
  signedIn?: boolean;
  from: BuyFrom;
  variant?: "full" | "button";
  buttonVariant?: ButtonVariant;
  /** A shorter label where space is tight (the trial toolbar). */
  label?: ReactNode;
  /** The accessible name when the visible label is shortened. */
  ariaLabel?: string;
  /** The plan shown on the pitch, shared by its Buy controls. */
  interval?: "year" | "month";
  onInterval?: (interval: "year" | "month") => void;
}) {
  const navigate = useNavigate();
  const [own, setOwn] = useState<"year" | "month">("year");
  const interval = chosen ?? own;
  const choose = onInterval ?? setOwn;
  const { program, fundedOffer, offers } = data;
  // Whole-dollar plans read "$599", like the saving badge.
  const plans = offers.map((entry) => ({
    ...entry,
    formattedAmount: formatPrice(entry.amountMinor),
  }));
  const offer =
    plans.find((entry) => entry.interval === interval) ?? plans[0] ?? null;
  const className =
    variant === "full" ? styles.buyButton : styles.buyCompactButton;
  function buyByCard(next: "year" | "month") {
    track("buy_click", { path: "card", from });
    if (signedIn) {
      void navigate({ to: "/start/plan", search: { interval: next } });
      return;
    }
    // Sign-up continues straight to this plan's checkout.
    rememberPlanChoice(next);
    void navigate(pitchTarget("card", search));
  }
  if (program && fundedOffer) {
    const link = (
      <Link
        className={buttonClass(buttonVariant, className)}
        {...pitchTarget("funded", search)}
        onClick={() => track("buy_click", { path: "funded", from })}
        aria-label={ariaLabel}
      >
        {label ?? `Buy with ${program.name} funds`}
      </Link>
    );
    if (variant === "button") return link;
    return (
      <div className={styles.buy} data-buy="funded">
        {link}
        <p className={styles.buyTerms} data-buy-terms>
          {formatPrice(fundedOffer.totalMinor)} for{" "}
          {(fundedOffer.termMonths ?? 12) === 12
            ? "the year"
            : `${fundedOffer.termMonths} months`}
          , paid from your {program.fund} balance
          {/* A program that does not refund (or has not said) shows the
              price only; the page's footnote covers the exception. */}
          .
          {offerRefunds(fundedOffer) && (
            <span className={styles.guaranteeLine}>{GUARANTEE_LINE}</span>
          )}
        </p>
        {(fundedOffer.statusLabel || offers.length > 0) && (
          <div className={styles.extras}>
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
        )}
      </div>
    );
  }
  if (!offer) return null;
  const button = (
    <Button
      variant={buttonVariant}
      className={className}
      onClick={() => buyByCard(offer.interval)}
      aria-label={ariaLabel}
    >
      {label ?? "Buy AMP"}
    </Button>
  );
  if (variant === "button") return button;
  return (
    <div className={styles.buy} data-buy="card">
      <PlanChoice
        offers={plans}
        extra={data.extraOffers}
        interval={offer.interval}
        onChange={choose}
      />
      {button}
      <p className={styles.buyTerms} data-buy-terms>
        {offer.formattedAmount}{" "}
        {offer.interval === "year" ? "for the year" : "a month"}.
        <span className={styles.guaranteeLine}>{GUARANTEE_LINE}</span>
      </p>
    </div>
  );
}
