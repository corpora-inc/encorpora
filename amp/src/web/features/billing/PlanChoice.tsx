import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { Segmented } from "../../ui/Segmented";
import { annualSaving, formatUsd } from "./payment-url";
import styles from "./Billing.module.css";

const names = { year: "Annual", month: "Monthly" } as const;
/**
 * "Each additional child: $399 a year", from the server's additional-child
 * offer for the plan shown (or its other plan). Undefined when none is sold.
 */
export function additionalChildLine(
  extra: AnnualOffer[] | undefined,
  interval: "year" | "month",
): string | undefined {
  const offer =
    extra?.find((entry) => entry.interval === interval) ?? extra?.[0];
  if (!offer) return undefined;
  // The price and its period stay on one line.
  const price = formatUsd(offer.amountMinor).replace(/\.00$/, "");
  return `Each additional child: ${price}\u00a0a\u00a0${offer.interval}`;
}
/** Annual or monthly, priced only from the server's configured offers. */
export function PlanChoice({
  offers,
  extra,
  interval,
  onChange,
  disabled = false,
}: {
  offers: AnnualOffer[];
  /** The server's additional-child offers, shown as one line when sold. */
  extra?: AnnualOffer[];
  interval: "year" | "month";
  onChange: (interval: "year" | "month") => void;
  disabled?: boolean;
}) {
  const selected =
    offers.find((offer) => offer.interval === interval) ?? offers[0];
  const saving = annualSaving(offers);
  if (!selected) return null;
  const additional = additionalChildLine(extra, selected.interval);
  return (
    <div className={styles.plan}>
      {offers.length > 1 ? (
        <Segmented
          label="Plan"
          value={selected.interval}
          disabled={disabled}
          onChange={onChange}
          options={offers.map((offer) => ({
            value: offer.interval,
            label: names[offer.interval],
            badge:
              offer.interval === "year" && saving > 0
                ? `Save ${formatUsd(saving).replace(/\.00$/, "")}`
                : undefined,
            detail: (
              <>
                <span className={styles.amount}>{offer.formattedAmount}</span>{" "}
                <span>per {offer.interval}</span>
              </>
            ),
          }))}
        />
      ) : (
        <p className={styles.single}>
          <span className={styles.amount}>{selected.formattedAmount}</span>{" "}
          <span>USD per {selected.interval}</span>
        </p>
      )}
      {/* One block after the plans, so layouts that place the plans and
          their terms in their own areas keep the additional-child price with
          the terms. */}
      <div className={styles.notes}>
        {additional && (
          <p className={styles.additional} data-additional-child>
            {additional}
          </p>
        )}
        <p className={styles.terms}>
          Renews each {selected.interval} until you cancel. Tax is shown at
          checkout.
          {selected.mode === "test" && (
            <span className={styles.sandbox}> Sandbox: no real payment.</span>
          )}
        </p>
      </div>
    </div>
  );
}
