import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppError } from "../../../lib/AppError";
import { authConfigOptions } from "../../../lib/query";
import { useSessionOrNull } from "../../../lib/session";
import { useLoggedError } from "../../../feedback";
import { cleverEnabled } from "./enabled";
import { linkClever } from "./link";

/** Account → Sign-in: another Clever sign-in for this account (a district
 * admin who also teaches, say). Only while Clever is on. */
export function LinkCleverButton({ className }: { className?: string }) {
  const session = useSessionOrNull();
  const clever = cleverEnabled(useQuery(authConfigOptions).data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  if (!clever || !session) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        aria-busy={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void linkClever(session).catch((failure) => {
            // Account → Sign-in is on most framed pages: logged here, not
            // through lib/report-error (its chunk would ride along).
            console.error("Linking Clever failed", failure);
            setError(
              failure instanceof AppError && failure.code === "reauth_required"
                ? "Sign out and in again, then link Clever."
                : failure instanceof Error
                  ? failure.message
                  : "Clever couldn’t be linked. Try again.",
            );
            setBusy(false);
          });
        }}
      >
        Link Clever
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
