import { Loading } from "../../ui/Loading";
import { AccountOverlay } from "../account/AccountOverlay";

/*
 * Privacy & data over a settings hub (app/account-overlays.tsx): the privacy
 * panels as disclosures, one open at a time, opening first on
 * `panels.privacy` (features/account/panels.ts). Owned by the privacy
 * package (the IA v2 spec, WP3); this is its contract.
 */
export function PrivacyOverlay() {
  return (
    <AccountOverlay name="privacy" title="Privacy & data">
      <Loading />
    </AccountOverlay>
  );
}
