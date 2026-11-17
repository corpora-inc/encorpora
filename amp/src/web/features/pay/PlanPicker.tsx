import type { ReactNode } from "react";
import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { track } from "../../lib/analytics";
import { chosenPlan } from "../../lib/pending-trial";
import { Segmented } from "../../ui/Segmented";
import { PlanChoice } from "../billing/PlanChoice";
import { usePay } from "./context";
import {
  useLearnerChoice,
  usePayStore,
  type PayInterval,
  type PayMethod,
} from "./store";
import styles from "./Pay.module.css";

/** The plan this learner's flow shows: the one chosen here, else the one
 * chosen on the pitch, else annual. One answer for both methods. */
export function useChosenInterval(): PayInterval {
  const { session, learner } = usePay();
  const choice = useLearnerChoice(session.accountId, learner.id);
  return choice.interval ?? chosenPlan() ?? "year";
}

/**
 * Annual or monthly: the one plan control, the same on both tabs (card and
 * education funds), and the same choice. Prices come only from the offers
 * the server sells for that method.
 */
export function PlanPicker({
  offers,
  extra,
  terms,
  disabled = false,
}: {
  offers: AnnualOffer[];
  extra?: AnnualOffer[];
  terms?: ReactNode;
  disabled?: boolean;
}) {
  const { session, learner } = usePay();
  const choose = usePayStore((state) => state.choose);
  const interval = useChosenInterval();
  const shown =
    offers.find((offer) => offer.interval === interval)?.interval ??
    offers[0]?.interval ??
    interval;
  return (
    <PlanChoice
      offers={offers}
      extra={extra}
      interval={shown}
      disabled={disabled}
      terms={terms}
      onChange={(next) => {
        track("plan_select", { interval: next });
        choose(session.accountId, learner.id, { interval: next });
      }}
    />
  );
}

/** Card | Education funds: two tabs of one screen. Switching is state in
 * the pay store, never a new address or history entry. */
export function MethodTabs() {
  const { session, learner } = usePay();
  const method = useMethod(true);
  const choose = usePayStore((state) => state.choose);
  return (
    <div className={styles.tabs}>
      <Segmented<PayMethod>
        label="How to pay"
        compact
        value={method}
        onChange={(next) => choose(session.accountId, learner.id, { method: next })}
        options={[
          { value: "card", label: "Card" },
          { value: "esa", label: "Education funds" },
        ]}
      />
    </div>
  );
}

/** The tab shown: the one chosen, if education funds are on sale. */
export function useMethod(funds: boolean): PayMethod {
  const { session, learner } = usePay();
  const choice = useLearnerChoice(session.accountId, learner.id);
  return funds && choice.method === "esa" ? "esa" : "card";
}
