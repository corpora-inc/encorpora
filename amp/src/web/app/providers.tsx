import { NativeGate } from "../NativeGate";
import { nativeRuntime } from "../native-runtime";
import { Toast } from "../ui/Toast";
import { AppError } from "../lib/AppError";
import { clearOnboardingDraft } from "../features/onboarding/state";
import { QueryClientProvider } from "@tanstack/react-query";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { onSessionChanged } from "../auth";
import { queryClient, sessionOptions } from "../lib/query";
export function Providers({ children }: { children: ReactNode }) {
  const session = <SessionProviders>{children}</SessionProviders>;
  return nativeRuntime ? <NativeGate>{session}</NativeGate> : session;
}
function SessionProviders({ children }: { children: ReactNode }) {
  const [error, setError] = useState("");
  const [identityVersion, setIdentityVersion] = useState(0);
  useEffect(
    () =>
      onSessionChanged(
        (session) => {
          setError("");
          const previous = queryClient.getQueryData(sessionOptions.queryKey);
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
          if (session)
            void queryClient.invalidateQueries({
              queryKey: ["account", session.accountId],
            });
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
      ),
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <Fragment key={identityVersion}>{children}</Fragment>
      <Toast message={error} onDismiss={() => setError("")} />
    </QueryClientProvider>
  );
}
