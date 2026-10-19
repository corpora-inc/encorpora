import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "@tanstack/react-router";
import type { AuthSession } from "../../auth";
import { invalidateAccount, meOptions, sessionOptions } from "../../lib/query";
import { nativeRuntime } from "../../native-runtime";
import { ParentConsentCenter } from "../../ParentConsentCenter";
import { LoadingScreen, RouteError } from "../../ui/LoadingScreen";
import { PageFrame } from "../../ui/PageFrame";
import { chosenPlan } from "../../lib/pending-trial";
import { startDestination, startNavigation } from "./guard";
import { LearnerSteps } from "./LearnerSteps";
import { PlanStep } from "./PlanStep";
import { PurchaseStep } from "./PurchaseStep";
import { VerifyEmailStep } from "./VerifyEmailStep";

export function StartScreen() {
  const { data: session } = useSuspenseQuery(sessionOptions);
  return session ? (
    <SignedInStart session={session} />
  ) : (
    <Navigate to="/sign-in" />
  );
}
function SignedInStart({ session }: { session: AuthSession }) {
  const query = useQuery(meOptions(session)),
    location = useLocation(),
    navigate = useNavigate();
  const me = query.data;
  if (query.error && !me)
    return (
      <RouteError error={query.error} reset={() => void query.refetch()} />
    );
  if (!me) return <LoadingScreen />;
  // The same guard as route beforeLoad, re-applied whenever `/me` changes.
  // While leaving /start (for example to practice), the location is already
  // the destination; this screen must not redirect again.
  const leaving = !/^\/start(\/|$)/.test(location.pathname);
  const target =
    nativeRuntime || leaving
      ? null
      : startDestination(me, location.pathname, !!chosenPlan());
  if (target) return <Navigate {...startNavigation(target)} replace />;
  if (!me.signedIn) return <Navigate to="/sign-in" />;
  if (leaving) return <LoadingScreen />;
  const step = location.pathname;
  if (step === "/start/consent")
    return (
      <div className="shell start-shell">
        <ParentConsentCenter
          token={session.token}
          identity={session.accountId}
          onChanged={() => void invalidateAccount(session.accountId)}
          onClose={() => void navigate({ to: "/start/plan" })}
        />
      </div>
    );
  return (
    <PageFrame>
      {step === "/start/verify-email" ? (
        <VerifyEmailStep session={session} me={me} />
      ) : step === "/start/plan" ? (
        <PlanStep session={session} trial={me.next === "try"} />
      ) : step === "/start/purchase" ? (
        <PurchaseStep session={session} />
      ) : (
        <LearnerSteps session={session} me={me} />
      )}
    </PageFrame>
  );
}
