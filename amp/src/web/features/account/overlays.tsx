import { Loading } from "../../ui/Loading";
import { AccountOverlay } from "./AccountOverlay";

/*
 * The account overlays over a settings hub (app/account-overlays.tsx).
 * Each composes its capability panel (the IA v2 spec, §5): BillingPanel,
 * SecurityPanel with ReauthPanel, DeleteAccountPanel. None knows a route.
 */

export function BillingOverlay() {
  return (
    <AccountOverlay name="billing" title="Billing">
      <Loading />
    </AccountOverlay>
  );
}

export function SecurityOverlay() {
  return (
    <AccountOverlay name="security" title="Sign-in & security">
      <Loading />
    </AccountOverlay>
  );
}

export function DeleteAccountOverlay() {
  return (
    <AccountOverlay name="delete-account" title="Delete account">
      <Loading />
    </AccountOverlay>
  );
}
