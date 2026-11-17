import { AccountOverlay } from "../account/AccountOverlay";
import { PrivacyPanel } from "./PrivacyPanel";

/**
 * Privacy & data, one overlay over the settings hub it opens from (IA v2
 * §2.2 and §3.6; app/account-overlays.tsx): a routed overlay, so a mailed or
 * legal link opens it, ✕, Escape and Back close it to the hub, and a refresh
 * keeps it. Its body is the panels (PrivacyPanel): disclosures, one open at
 * a time, none with an address, opening first on `panels.privacy`.
 */
export function PrivacyOverlay() {
  return (
    <AccountOverlay name="privacy" title="Privacy & data">
      <PrivacyPanel />
    </AccountOverlay>
  );
}
