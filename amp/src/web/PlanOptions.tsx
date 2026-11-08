import type { AnnualOffer } from "../billing/stripe/purchase-contracts";
import "./plan-options.css";
import { annualSaving } from "./features/billing/payment-url";

export function PlanOptions({
  offers,
  selected,
  onSelect,
  disabled = false,
  pending = false,
}: {
  offers: AnnualOffer[];
  selected?: string;
  onSelect?: (offer: AnnualOffer) => void;
  disabled?: boolean;
  /** The learner's price is not known yet: every amount waits in its own
   * space, so no price shows that this learner would not pay. */
  pending?: boolean;
}) {
  const saving = annualSaving(offers);
  const wait = (
    <span className="plan-price-wait" aria-hidden>
      {"\u00a0"}
    </span>
  );
  return (
    <div className="plan-options" aria-busy={pending || undefined}>
      <div
        className="plan-options-grid"
        role={onSelect ? "group" : undefined}
        aria-label="Payment plan"
      >
        {offers.map((offer) => {
          const contents = (
            <>
              <strong>
                {offer.interval === "year" ? "Annual" : "Monthly"}
              </strong>
              {pending ? (
                wait
              ) : (
                <span>
                  {offer.formattedAmount} / {offer.interval}
                </span>
              )}
            </>
          );
          return onSelect ? (
            <button
              type="button"
              key={offer.id}
              className={pending ? "amp-skeleton" : undefined}
              aria-pressed={selected === offer.id}
              disabled={disabled}
              onClick={() => onSelect(offer)}
            >
              {contents}
            </button>
          ) : (
            <div
              key={offer.id}
              className={pending ? "amp-skeleton" : undefined}
            >
              {contents}
            </div>
          );
        })}
      </div>
      {saving > 0 && (
        <p className={`plan-saving${pending ? " amp-skeleton" : ""}`}>
          Save{" "}
          {pending
            ? wait
            : new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(saving / 100)}{" "}
          a year with annual, before tax, compared with 12 monthly payments.
        </p>
      )}
    </div>
  );
}
