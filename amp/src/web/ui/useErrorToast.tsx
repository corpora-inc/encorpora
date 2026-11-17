import { useCallback, useState } from "react";
import { reportError, type ErrorContext } from "../lib/report-error";
import { Toast } from "./Toast";

/**
 * A screen's failures in the one toast (docs/architecture/frontend-patterns.md,
 * "Errors"): `report` logs the failure and shows what happened and what to
 * do, over the content without moving it, until dismissed. Render `toast`
 * once, anywhere in the screen.
 *
 *   const errors = useErrorToast();
 *   const save = useMutation({ …, onError: (error) => errors.report(error, "save the name") });
 *   return <>…{errors.toast}</>;
 */
export function useErrorToast() {
  const [message, setMessage] = useState("");
  const report = useCallback(
    (error: unknown, context: ErrorContext) =>
      setMessage(reportError(error, context)),
    [],
  );
  const clear = useCallback(() => setMessage(""), []);
  return {
    report,
    clear,
    toast: <Toast message={message} onDismiss={clear} />,
  };
}
