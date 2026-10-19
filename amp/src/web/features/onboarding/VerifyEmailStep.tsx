import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import { accountClient } from "../../account-client";
import { AppError } from "../../lib/AppError";
import type { AuthSession } from "../../auth";
import { refreshMe } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { frameCard } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import styles from "./Start.module.css";

/** Confirm the parent's address in place: one primary action, nothing shifts. */
export function VerifyEmailStep({
  session,
  me,
}: {
  session: AuthSession;
  me: SignedInMe;
}) {
  const email = me.account.email ?? "";
  const verification = useMutation({
    mutationFn: async () => {
      const result = await accountClient.sendVerificationEmail({
        email,
        callbackURL: "/start",
      });
      if (result.error) {
        const error = new AppError(
          "unavailable",
          "We could not send the email. Please try again.",
          true,
        );
        error.log();
        throw error;
      }
      return "Verification email sent. Check your inbox.";
    },
  });
  const confirmation = useMutation({
    mutationFn: async () => {
      const fresh = await refreshMe(session);
      return fresh.signedIn && fresh.next === "verify-email"
        ? "Your email is not confirmed yet. Open the link in your email, then try again."
        : "";
    },
  });
  const busy = confirmation.isPending || verification.isPending;
  return (
    <section className={`${frameCard} ${styles.step}`}>
      <Toast
        message={
          verification.error?.message ??
          confirmation.error?.message ??
          verification.data ??
          confirmation.data ??
          ""
        }
        onDismiss={() => {
          verification.reset();
          confirmation.reset();
        }}
      />
      <h1>Check your email</h1>
      <p>
        We sent a confirmation link to{" "}
        <span className={styles.address}>{email || "your email address"}</span>.
        Open it to continue setting up your family.
      </p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            verification.reset();
            confirmation.mutate();
          }}
        >
          {confirmation.isPending
            ? "Checking confirmation…"
            : "I confirmed my email"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            confirmation.reset();
            verification.mutate();
          }}
        >
          {verification.isPending ? "Sending email…" : "Send another email"}
        </Button>
        <Link to="/sign-in" className={buttonClass("quiet")}>
          Back to sign in
        </Link>
      </div>
    </section>
  );
}
