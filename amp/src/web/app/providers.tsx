import { clearOnboardingDraft } from "../features/onboarding/state";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { onSessionChanged } from "../auth";
import { queryClient, sessionOptions } from "../lib/query";
export function Providers({ children }: { children: ReactNode }) {
  useEffect(
    () =>
      onSessionChanged((session) => {
        const previous = queryClient.getQueryData(sessionOptions.queryKey);
        if (previous?.accountId !== session?.accountId) {
          clearOnboardingDraft();
          void queryClient.cancelQueries({ queryKey: ["account"] });
          queryClient.removeQueries({ queryKey: ["account"] });
        }
        void queryClient.cancelQueries({ queryKey: sessionOptions.queryKey });
        queryClient.setQueryData(sessionOptions.queryKey, session);
        if (session)
          void queryClient.invalidateQueries({
            queryKey: ["account", session.accountId],
          });
      }),
    [],
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
