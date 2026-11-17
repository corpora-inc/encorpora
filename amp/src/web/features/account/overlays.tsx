import { AccountSecurity } from "../../AccountSecurity";
import { AccountOverlay } from "./AccountOverlay";
import { BillingPanel } from "./BillingPage";
import { DeleteAccountPanel } from "./DeleteAccount";

/*
 * The account overlays over a settings hub (app/account-overlays.tsx).
 * Each composes its capability panel (the IA v2 spec, §5): BillingPanel,
 * the sign-in and security settings, DeleteAccountPanel. None knows a route.
 */

export function BillingOverlay() {
  return (
    <AccountOverlay
      name="billing"
      title="Billing"
      description="Plans, education funds and receipts"
    >
      <BillingPanel />
    </AccountOverlay>
  );
}

export function SecurityOverlay() {
  return (
    <AccountOverlay name="security" title="Sign-in & security">
      {/* Deleting the account is its own row on the hub. */}
      <AccountSecurity deleteEntry={false} />
    </AccountOverlay>
  );
}

export function DeleteAccountOverlay() {
  return (
    <AccountOverlay name="delete-account" title="Delete your account">
      <DeleteAccountPanel />
    </AccountOverlay>
  );
}
