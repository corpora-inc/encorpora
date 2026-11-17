import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import { meOptions } from "../../lib/query";
import { useSession } from "../../lib/session";
import { buttonClass } from "../../ui/Button";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Page } from "../../ui/Page";
import { PageHeader } from "../../ui/PageHeader";
import { PageSection } from "../../ui/PageSection";
import { OwnPractice } from "../me/OwnPractice";
import { PayLink } from "../pay/link";
import { secondParentOnly } from "../second-parent/api";
import { AccountSections } from "./AccountSections";
import { managesPlan } from "./BillingSummary";
import { NameEditor } from "./NameEditor";

/**
 * The account (`/account`, the IA v2 spec, §4): one page for every adult,
 * with no tabs. You, your own practice when you have one, the plan when the
 * account holds one, then Privacy and Account, one row each, every row an
 * overlay over this page (app/account-overlays.tsx). The same sections as
 * a family's Settings (AccountSections), without the family's: a family's
 * parent keeps all of this in their family's Settings, and this page still
 * opens for them, so mailed and returned links keep working.
 */
export function AccountHubScreen() {
  const session = useSession();
  const me = useQuery(meOptions(session));
  const account = me.data?.signedIn ? me.data : null;
  if (!account)
    return (
      <Page data-account-hub="">
        <LoadingScreen overlay />
      </Page>
    );
  const own = account.adultPractice?.learner ?? null;
  const ownLearner = own
    ? account.family.learners.find((learner) => learner.id === own.id)
    : undefined;
  const practice = !!own || account.adultPractice?.eligible === true;
  const plan = managesPlan(account, secondParentOnly(account));
  return (
    <Page data-account-hub="">
      <PageHeader title="Account" />
      <PageSection title="You" titleId="account-you">
        <NameEditor />
      </PageSection>
      {practice && (
        <PageSection titleId="account-practice" aria-label="Your practice">
          <OwnPractice />
          {own && ownLearner && !ownLearner.hasAccess && !plan && (
            <PayLink learnerId={own.id} className={buttonClass("primary")}>
              Continue with AMP
            </PayLink>
          )}
        </PageSection>
      )}
      <AccountSections plan={plan ? { kind: "manage" } : null} />
    </Page>
  );
}

/** The account, and the overlay open over it: the page stays mounted. */
export function AccountHost() {
  return (
    <>
      <AccountHubScreen />
      <Outlet />
    </>
  );
}
