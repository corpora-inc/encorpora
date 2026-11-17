import { useEffect, useState } from "react";
import { useReturnNotices } from "../../app/third-party-returns";
import { useSession } from "../../lib/session";
import { Button } from "../../ui/Button";
import { SUPPORT_EMAIL } from "../support/SupportAddress";
import styles from "./PurchaseReturnNotice.module.css";

/**
 * Why Billing opened after a checkout: Stripe's return named a purchase the
 * server couldn't match to this account (app/third-party-returns.ts sets the
 * notice; it lands here, at the top of Billing). Said once, inline, with
 * what to do. It is taken from the store as it shows, so it never shows
 * again; Dismiss hides it.
 */
export function PurchaseReturnNotice() {
  const { accountId } = useSession();
  // Read once as Billing opens: the store's notice is spent by showing it.
  const [notice, setNotice] = useState(
    () => useReturnNotices.getState().accounts[accountId],
  );
  useEffect(() => {
    if (!notice) return;
    console.warn("A Stripe purchase return wasn’t matched to this account");
    useReturnNotices.getState().set(accountId, undefined);
  }, [accountId, notice]);
  if (notice !== "purchase-unmatched") return null;
  return (
    <div className={styles.notice} role="alert" data-purchase-unmatched="">
      <div>
        <p className={styles.title}>
          We couldn’t match that payment to this account.
        </p>
        <p>
          If you paid while signed in to another account, sign in to that one
          to see the plan. Otherwise check your plans below in a few minutes.
          If the plan still isn’t there, email {SUPPORT_EMAIL} with the
          receipt Stripe sent you, and we’ll connect it.
        </p>
      </div>
      <Button variant="quiet" onClick={() => setNotice(undefined)}>
        Dismiss
      </Button>
    </div>
  );
}
