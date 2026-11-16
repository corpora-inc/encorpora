import styles from "./PaymentMethodChoice.module.css";
import { Segmented } from "../../ui/Segmented";

export type PaymentMethod = "card" | "education-funds";
export type PaymentInterval = "year" | "month";

/** The same payment choice on the card plan and education-fund invoice. */
export function PaymentMethodChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.choice}>
      <Segmented
        label="Payment method"
        compact
        value={value}
        disabled={disabled}
        onChange={onChange}
        options={[
          { value: "card", label: "Card" },
          { value: "education-funds", label: "Education funds (ESA)" },
        ]}
      />
    </div>
  );
}

/** Method changes keep the selected person and term on the existing routes. */
export function paymentMethodHref(
  method: PaymentMethod,
  interval: PaymentInterval,
  learnerId?: string | null,
) {
  const query = new URLSearchParams({ interval });
  if (method === "education-funds") {
    if (learnerId) query.set("learner", learnerId);
    return `/purchase/funded?${query}`;
  }
  return learnerId
    ? `/continue/${encodeURIComponent(learnerId)}?${query}`
    : `/purchase/annual?${query}`;
}
