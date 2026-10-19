import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { Segmented } from "../../ui/Segmented";
import { annualSaving, formatUsd } from "./payment-url";
import styles from "./Billing.module.css";

const names = { year: "Annual", month: "Monthly" } as const;
/** Annual or monthly, priced only from the server's configured offers. */
export function PlanChoice({
  offers,
  interval,
  onChange,
  disabled = false,
}: {
  offers: AnnualOffer[];
  interval: "year" | "month";
  onChange: (interval: "year" | "month") => void;
  disabled?: boolean;
}) {
  const selected =
    offers.find((offer) => offer.interval === interval) ?? offers[0];
  const saving = annualSaving(offers);
  if (!selected) return null;
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
      <p className={styles.terms}>
        Renews each {selected.interval} until you cancel. Tax is shown at
        checkout.
        {selected.mode === "test" && (
          <span className={styles.sandbox}> Sandbox: no real payment.</span>
        )}
      </p>
    </div>
  );
}
