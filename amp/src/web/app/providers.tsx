import { setAnalyticsSession } from "../lib/analytics";
import { NativeGate } from "../NativeGate";
import { nativeRuntime } from "../native-runtime";
import { Toast } from "../ui/Toast";
import { AppError } from "../lib/AppError";
import { clearInitialConsentChallenge } from "../consent-entry";
import {
  clearOwnedPurchaseReturn,
  clearPurchaseReturn,
} from "../purchase-return";
import { clearOnboardingDraft } from "../features/onboarding/state";
import { QueryClientProvider } from "@tanstack/react-query";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { onSessionChanged, type AuthSession } from "../auth";
import { meKey, meOptions, queryClient, sessionOptions } from "../lib/query";
export function Providers({
  children,
  onAccountExit,
}: {
  children: ReactNode;
  onAccountExit?: () => void;
}) {
  const session = (
    <SessionProviders onAccountExit={onAccountExit}>
      {children}
    </SessionProviders>
  );
  return nativeRuntime ? <NativeGate>{session}</NativeGate> : session;
}
function SessionProviders({
  children,
  onAccountExit,
}: {
  children: ReactNode;
  onAccountExit?: () => void;
}) {
  const [error, setError] = useState("");
  const [identityVersion, setIdentityVersion] = useState(0);
  useEffect(() => {
    let generation = 0;
    async function refreshAccount(session: AuthSession, current: number) {
      const key = meKey(session.accountId);
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (current !== generation) return;
      try {
        // React observers may still close over the revoked token in this turn.
        // Fetch the canonical resource with the session we just checked.
        await queryClient.fetchQuery(meOptions(session));
        if (current !== generation) return;
        await queryClient.invalidateQueries({
          queryKey: ["account", session.accountId],
          predicate: (query) => query.queryKey[2] !== "me",
        });
      } catch {
        if (current !== generation) return;
        const failure = new AppError(
          "unavailable",
          "Your account could not be refreshed. Refresh to try again.",
          true,
        );
        failure.log();
        setError(failure.message);
      }
    }
    const unsubscribe = onSessionChanged(
      (session) => {
        const current = ++generation;
        setAnalyticsSession(session);
        setError("");
        const previous = queryClient.getQueryData(sessionOptions.queryKey);
        if (
          !session ||
          (previous?.accountId && previous.accountId !== session.accountId)
        ) {
          clearInitialConsentChallenge();
          clearOwnedPurchaseReturn();
          clearPurchaseReturn();
        }
        if (previous?.accountId !== session?.accountId) {
          clearOnboardingDraft();
          setIdentityVersion((version) => version + 1);
          void queryClient.cancelQueries({ queryKey: ["trial"] });
          queryClient.setQueryData(["trial", "session"], null);
          queryClient.removeQueries({ queryKey: ["trial"] });
          void queryClient.cancelQueries({ queryKey: ["account"] });
          queryClient.removeQueries({ queryKey: ["account"] });
        }
        void queryClient.cancelQueries({ queryKey: sessionOptions.queryKey });
        queryClient.setQueryData(sessionOptions.queryKey, session);
        if (previous?.accountId && previous.accountId !== session?.accountId)
          onAccountExit?.();
        if (session) {
          if (nativeRuntime)
            void queryClient.invalidateQueries({
              queryKey: ["account", session.accountId],
            });
          else void refreshAccount(session, current);
        }
      },
      () => {
        const failure = new AppError(
          "authentication",
          "Your sign-in could not be checked. Refresh to try again.",
          true,
        );
        failure.log();
        setError(failure.message);
      },
    );
    return () => {
      generation++;
      unsubscribe();
    };
  }, [onAccountExit]);
  return (
    <QueryClientProvider client={queryClient}>
      <Fragment key={identityVersion}>{children}</Fragment>
      <Toast message={error} onDismiss={() => setError("")} />
    </QueryClientProvider>
  );
}
