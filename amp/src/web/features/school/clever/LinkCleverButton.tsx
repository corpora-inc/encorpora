import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppError } from "../../../lib/AppError";
import { authConfigOptions, sessionOptions } from "../../../lib/query";
import { useLoggedError } from "../../../feedback";
import { cleverEnabled } from "./enabled";
import { linkClever } from "./link";

/** Account → Sign-in: another Clever sign-in for this account (a district
 * admin who also teaches, say). Only while Clever is on. */
export function LinkCleverButton({ className }: { className?: string }) {
  const session = useQuery(sessionOptions).data;
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
