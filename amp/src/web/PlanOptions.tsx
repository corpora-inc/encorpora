import type { AnnualOffer } from "../billing/stripe/purchase-contracts";
import "./plan-options.css";

export function PlanOptions({
  offers,
  selected,
  onSelect,
  disabled = false,
}: {
  offers: AnnualOffer[];
  selected?: string;
  onSelect?: (offer: AnnualOffer) => void;
  disabled?: boolean;
}) {
  const annual = offers.find((offer) => offer.interval === "year");
  const monthly = offers.find((offer) => offer.interval === "month");
  const saving =
    annual && monthly && annual.currency === monthly.currency
      ? monthly.amountMinor * 12 - annual.amountMinor
      : 0;
  return (
    <div className="plan-options">
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
              <span>
                {offer.formattedAmount} / {offer.interval}
              </span>
            </>
          );
          return onSelect ? (
            <button
              type="button"
              key={offer.id}
              aria-pressed={selected === offer.id}
              disabled={disabled}
              onClick={() => onSelect(offer)}
            >
              {contents}
            </button>
          ) : (
            <div key={offer.id}>{contents}</div>
          );
        })}
      </div>
      {saving > 0 && (
        <p className="plan-saving">
          Save{" "}
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(saving / 100)}{" "}
          a year with annual, before tax, compared with 12 monthly payments.
        </p>
      )}
    </div>
  );
}
