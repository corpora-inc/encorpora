import { useQuery } from "@tanstack/react-query";
import type { SignedInMe } from "../../../account/contracts";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { PageSection } from "../../ui/PageSection";
import { RowLink, RowList } from "../../ui/RowList";
import { useOverlayHub } from "./AccountOverlay";
import { BillingSummary } from "./BillingSummary";
import styles from "./AccountSections.module.css";

/*
 * The account's own sections, composed once (the IA v2 spec, §5,
 * AccountSections): Plan, Privacy and Account, on family Settings and on the
 * adults' `/account`, so the two hubs always match. Every row opens an
 * overlay over the hub it is drawn on (app/account-overlays.tsx); nothing
 * here navigates away.
 */

/** The hub this is drawn on (also while an overlay is open over it), as an
 * app address without its leading slash. */
function useHub() {
  return useOverlayHub().slice(1);
}

/** What the Privacy row says about the family's learning permission. */
export function privacyMeta(
  me: SignedInMe | null,
  consent: boolean,
): string | undefined {
  if (!consent || !me) return "Your data, how long it’s kept, and our policies";
  switch (me.family.consent.status) {
    case "active":
      return "Learning permission given";
    case "withdrawn":
      return "Learning permission withdrawn";
    default:
      return "Learning permission not given yet";
  }
}

export function AccountSections({
  plan,
  consent = false,
  part = "all",
}: {
  /** Which sections: `plan` alone (family Settings puts it second), the
   * `rest` (Privacy and Account, last), or `all`. */
  part?: "plan" | "rest" | "all";
  /** The Plan section: the holder's summary and Billing (`manage`), a line
   * saying who manages it (`note`, a second parent), or none. */
  plan: { kind: "manage" } | { kind: "note"; holder: string | null } | null;
  /** The family's learning permission is this reader's (the holder's). */
  consent?: boolean;
}) {
  const hub = useHub();
  const session = useSession();
  const me = useQuery(meOptions(session)).data;
  const account = me?.signedIn ? me : null;
  const planShown = part !== "rest";
  const restShown = part !== "plan";
  return (
    <>
      {planShown && plan?.kind === "manage" && (
        <PageSection title="Plan" titleId="family-plan" data-settings-plan="">
          <BillingSummary />
          <RowList label="Billing">
            <RowLink
              title="Billing"
              meta="Plans, invoices and receipts"
              to={`${hub}/billing`}
              data-settings-billing=""
            />
          </RowList>
        </PageSection>
      )}
      {planShown && plan?.kind === "note" && (
        <PageSection title="Plan" titleId="family-plan" data-settings-plan="">
          <p className={styles.note}>
            {plan.holder ?? "The parent who invited you"} manages the family’s
            plan.
          </p>
        </PageSection>
      )}
      {restShown && (
        <PageSection
          title="Privacy"
          titleId="family-privacy"
          data-settings-privacy=""
        >
          <RowList label="Privacy">
            <RowLink
              title="Privacy & data"
              meta={privacyMeta(account, consent)}
              to={`${hub}/privacy`}
              data-settings-privacy-row=""
            />
          </RowList>
        </PageSection>
      )}
      {restShown && (
        <PageSection
          title="Account"
          titleId="family-account"
          data-settings-account=""
        >
          <RowList label="Account">
            <RowLink
              title="Sign-in & security"
              meta={account?.account.email ?? undefined}
              to={`${hub}/security`}
              data-settings-security=""
            />
            <RowLink
              title="Delete account"
              tone="danger"
              to={`${hub}/delete-account`}
              data-settings-delete-account=""
            />
          </RowList>
        </PageSection>
      )}
    </>
  );
}
