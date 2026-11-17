import { useQuery } from "@tanstack/react-query";
import { useToRoot } from "../../nav/root";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { invalidateAccount, meOptions, refreshMe } from "../../lib/query";
import { useSession } from "../../lib/session";
import { ParentConsentCenter } from "../../ParentConsentCenter";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { PageFrame } from "../../ui/PageFrame";
import {
  continuationSearch,
  continuationUrl,
  fundedPrograms,
  fundedReturnOf,
  isFundedReturn,
  forgetFundedPurchase,
} from "../../lib/funded-entry";
import { chosenPlan } from "../../lib/pending-trial";
import { chooseProgram } from "../../lib/program-choice";
import { startDestination, startNavigation } from "./guard";
import { LearnerSteps } from "./LearnerSteps";
import { PlanStep } from "./PlanStep";
import { PurchaseStep } from "./PurchaseStep";
import { VerifyEmailStep } from "./VerifyEmailStep";
import { fundedPayHref } from "./pay-link";

/** The funded program these steps are for: the address's on arrival, then
 * the one kept for the account (`fundedSetup`, in the route guard). */
function useFunded() {
  const session = useSession();
  const search = continuationSearch(useLocation().search);
  return isFundedReturn(search.return)
    ? search.return
    : fundedReturnOf(session.accountId);
}

/** After a step changes the account (an address confirmed, consent given):
 * the first-run guard's next address for it, computed once, in one move. */
export function useStartOnward() {
  const session = useSession();
  const navigate = useNavigate();
  const pathname = useLocation().pathname;
  const funded = useFunded();
  return async () => {
    const me = await refreshMe(session);
    const target = startDestination(
      me,
      pathname,
      !!chosenPlan(),
      funded ?? false,
    );
    if (!target) return;
    // A funded program's purchase is its tab of the learner's pay overlay.
    const pay = me.signedIn ? fundedPayHref(session, me, target) : null;
    if (pay) await navigate({ href: pay, replace: true });
    else await navigate({ ...startNavigation(target), replace: true });
  };
}

export function StartScreen() {
  const session = useSession();
  const query = useQuery(meOptions(session)),
    location = useLocation(),
    navigate = useNavigate();
  const toRoot = useToRoot();
  const me = query.data;
  const search = continuationSearch(location.search);
  const funded = useFunded();
  const onward = useStartOnward();
  if (query.error && !me)
    return (
      <RouteError error={query.error} reset={() => void query.refetch()} />
    );
  // Signed out while here, or leaving /start (for example to practice):
  // the page is already on its way.
  if (!me || !me.signedIn || !/^\/start(\/|$)/.test(location.pathname))
    return <LoadingScreen />;
  const step = location.pathname;
  if (step === "/start/consent")
    return (
      <div className="shell start-shell">
        <ParentConsentCenter
          token={session.token}
          identity={session.accountId}
          onChanged={() =>
            void invalidateAccount(session.accountId)
              .then(onward)
              .catch((error: unknown) =>
                console.error("The next step after consent didn’t open", error),
              )
          }
          onClose={() => {
            if (funded) {
              forgetFundedPurchase(session.accountId);
              chooseProgram(fundedPrograms[funded].id);
              toRoot();
            } else if (me.availableAccessGrant || search.return === "access")
              void navigate({ to: "/access" });
            else toRoot();
          }}
        />
      </div>
    );
  return (
    <PageFrame>
      {step === "/start/verify-email" ? (
        <VerifyEmailStep
          me={me}
          // The email's link comes back to this program's setup, on any
          // device.
          continueTo={
            funded ? continuationUrl({ return: funded }, "/start") : undefined
          }
          onConfirmed={onward}
        />
      ) : step === "/start/plan" ? (
        <PlanStep />
      ) : step === "/start/purchase" ? (
        <PurchaseStep metaPermission={me.family.metaPurchaseMeasurement} />
      ) : (
        <LearnerSteps me={me} />
      )}
    </PageFrame>
  );
}
