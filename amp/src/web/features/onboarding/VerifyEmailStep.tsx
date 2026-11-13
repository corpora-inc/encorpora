import { useMutation } from "@tanstack/react-query";
import { RootLink } from "../../nav/root";
import { Link, useLocation } from "@tanstack/react-router";
import type { SignedInMe } from "../../../account/contracts";
import { continuationUrl } from "../../lib/funded-entry";
import { accountClient } from "../../account-client";
import { AppError } from "../../lib/AppError";
import type { AuthSession } from "../../auth";
import { refreshMe } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { FrameBrand, frameCard } from "../../ui/PageFrame";
import { Toast } from "../../ui/Toast";
import styles from "./Start.module.css";

/** Confirm the parent's address before consent or a funded purchase: they
 * need it, nothing before them does. One primary action, nothing shifts. */
export function VerifyEmailStep({
  session,
  me,
  invitation = false,
  embedded = false,
}: {
  session: AuthSession;
  me: SignedInMe;
  invitation?: boolean;
  /** Inside another screen ("Continue with AMP"), which has the title, the
   * frame and its own "Not now". */
  embedded?: boolean;
}) {
  const email = me.account.email ?? "";
  const location = useLocation();
  const verification = useMutation({
    mutationFn: async () => {
      const result = await accountClient.sendVerificationEmail({
        email,
        callbackURL: invitation
          ? "/access"
          : continuationUrl(location.search, "/"),
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
      return fresh.signedIn && fresh.account.confirmationRequired
        ? "Your email is not confirmed yet. Open the link in your email, then try again."
        : "";
    },
  });
  const busy = confirmation.isPending || verification.isPending;
  const Heading = embedded ? "h2" : "h1";
  return (
    <section
      className={
        embedded
          ? `${styles.step} ${styles.embedded}`
          : `${frameCard} ${styles.step}`
      }
    >
      {!embedded && <FrameBrand expanded />}
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
      <Heading>Confirm your email</Heading>
      <p>
        Confirm your address to continue. We sent a link to{" "}
        <span className={styles.address}>{email || "your email address"}</span>.
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
        {!embedded && (
          <RootLink className={buttonClass("quiet")}>Not now</RootLink>
        )}
      </div>
    </section>
  );
}
