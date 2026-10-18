import { storedTrial } from "../../lib/pending-trial";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import styles from "./Start.module.css";
import { useEffect } from "react";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { sessionOptions, meOptions, invalidateAccount } from "../../lib/query";
import type { AuthSession } from "../../auth";
import { LoadingScreen, RouteError } from "../../app/LoadingScreen";
import { ParentConsentCenter } from "../../ParentConsentCenter";
import { BirthYearPrompt } from "../../BirthYearPrompt";
import { useLearnerStore } from "../../learner-store";
import { accountClient } from "../../account-client";
import { useDraft } from "./state";
import { useCreateLearner } from "./api";

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
    navigate = useNavigate(),
    location = useLocation();
  const draft = useDraft(),
    name = draft.owner === session.accountId ? draft.name : "";
  const mutation = useCreateLearner(session);
  const verification = useMutation({
    mutationFn: async () => {
      const result = await accountClient.sendVerificationEmail({
        email: query.data?.signedIn ? (query.data.account.email ?? "") : "",
        callbackURL: "/start/name",
      });
      if (result.error)
        throw new Error("We could not send the email. Please try again.");
      return "Verification email sent. Check your inbox.";
    },
  });
  const confirmation = useMutation({
    mutationFn: async () => {
      const result = await query.refetch({ throwOnError: true });
      return result.data?.signedIn && result.data.next === "verify-email"
        ? "Your email is not confirmed yet. Open the link in your email, then try again."
        : "";
    },
  });
  useEffect(() => {
    if (draft.owner !== session.accountId) draft.set(session.accountId, "");
  }, [session.accountId]);
  const me = query.data;
  const allowed = me?.signedIn && me.consent.status === "active";
  useEffect(() => {
    if (location.pathname === "/start/birth-year" && !name.trim())
      void navigate({ to: "/start/name", replace: true });
  }, [location.pathname, name]);
  if (query.error)
    return (
      <RouteError error={query.error} reset={() => void query.refetch()} />
    );
  if (!me) return <LoadingScreen />;
  if (!me.signedIn) return <Navigate to="/sign-in" />;
  if (me.next === "verify-email")
    return (
      <main className={styles.root}>
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
        <section className="start-card">
          <h1>Check your email</h1>
          <p>Confirm your address to continue setting up your family.</p>
          <Button
            disabled={confirmation.isPending || verification.isPending}
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
            disabled={verification.isPending || confirmation.isPending}
            onClick={() => {
              confirmation.reset();
              verification.mutate();
            }}
          >
            {verification.isPending ? "Sending email…" : "Send another email"}
          </Button>
          <Link to="/sign-in">Back to sign in</Link>
        </section>
      </main>
    );
  if (!allowed)
    return (
      <div className="shell start-shell">
        <ParentConsentCenter
          token={session.token}
          identity={session.accountId}
          onChanged={() => void invalidateAccount(session.accountId)}
          onClose={() =>
            void navigate({ to: "/$", params: { _splat: "family/learners" } })
          }
        />
      </div>
    );
  if (storedTrial()) return <Navigate to="/" replace />;
  return (
    <main className={styles.root}>
      <Toast
        message={mutation.error?.message ?? ""}
        onDismiss={() => mutation.reset()}
      />
      {location.pathname === "/start/birth-year" && name.trim() ? (
        <BirthYearPrompt
          name={name.trim()}
          birthYear={null}
          busy={mutation.isPending}
          cancel={() => void navigate({ to: "/start/name" })}
          saveBirthYear={(year) =>
            mutation.mutate(
              { name: name.trim(), birthYear: year },
              {
                onSuccess: (learner) => {
                  useLearnerStore.getState().select(learner.id);
                  draft.clear();
                  void navigate({
                    to: "/$",
                    params: { _splat: "practice" },
                    replace: true,
                  });
                },
              },
            )
          }
        />
      ) : (
        <section className="start-card">
          <div className="setup-progress" aria-label="Step 1 of 2">
            Learner <span>1 / 2</span>
          </div>
          <h1>Who’s learning?</h1>
          <p>
            A first name or nickname helps you keep each learner’s practice
            separate.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) void navigate({ to: "/start/birth-year" });
            }}
          >
            <TextField
              label="Learner name"
              autoComplete="off"
              value={name}
              maxLength={60}
              required
              onChange={(event) =>
                draft.set(session.accountId, event.target.value)
              }
            />
            <Button
              className="go-button"
              disabled={mutation.isPending || !name.trim()}
            >
              Continue
            </Button>
            <Link
              className="text-button"
              to="/$"
              params={{ _splat: "family/learners" }}
            >
              Back to family
            </Link>
          </form>
        </section>
      )}
    </main>
  );
}
