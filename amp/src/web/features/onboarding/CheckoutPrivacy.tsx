import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { nativeRuntime } from "../../native-runtime";
import { PurchaseMeasurement } from "../privacy/PurchaseMeasurement";
import styles from "./Start.module.css";

/** Independent adult choices, available before the purchase is made. */
export function CheckoutPrivacy({
  session,
  family,
  disabled,
}: {
  session: AuthSession;
  family: SignedInMe["family"];
  disabled: boolean;
}) {
  if (
    nativeRuntime ||
    (!family.purchaseMeasurement?.available &&
      !family.metaPurchaseMeasurement?.available)
  )
    return null;
  return (
    <details className={styles.purchasePrivacy}>
      <summary>Optional purchase sharing</summary>
      <p>
        Choose whether Google or Meta receives your adult purchase details. You
        can buy and learn without allowing either. Manage these choices here or
        in Family → Privacy.
      </p>
      <fieldset disabled={disabled}>
        <legend className={styles.privacyLegend}>
          Purchase-sharing choices
        </legend>
        {family.purchaseMeasurement?.available && (
          <PurchaseMeasurement
            key={`${session.accountId}:google`}
            identity={session.accountId}
            token={session.token}
            view={family.purchaseMeasurement}
          />
        )}
        {family.metaPurchaseMeasurement?.available && (
          <PurchaseMeasurement
            key={`${session.accountId}:meta`}
            identity={session.accountId}
            token={session.token}
            view={family.metaPurchaseMeasurement}
            provider="meta"
          />
        )}
      </fieldset>
    </details>
  );
}
