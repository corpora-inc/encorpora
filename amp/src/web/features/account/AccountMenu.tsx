import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { Menu, MenuItem, MenuLabel } from "../../ui/Menu";
import { Toast } from "../../ui/Toast";
import { nativeRuntime } from "../../native-runtime";
import styles from "./Account.module.css";

/** Account actions stay in the active view, including anonymous practice. */
export function AccountMenu() {
  const session = useQuery(sessionOptions);
  const me = useQuery({
    ...meOptions(session.data ?? { accountId: "", token: "" }),
    enabled: !!session.data,
  });
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (nativeRuntime) return null;
  const account =
    me.data?.signedIn && me.data.account.id === session.data?.accountId
      ? me.data
      : null;
  const email = account?.account.email;
  const checking = session.isPending || (!!session.data && me.isPending);
  const expired = !!session.data && me.data?.signedIn === false;
  const unavailable =
    !!session.error || (!!session.data && !!me.error) || expired;
  return (
    <span className={styles.control} data-account-control>
      <Menu
        label={
          busy ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : email ? (
            <span className={styles.initial} aria-hidden="true">
              {email[0]?.toUpperCase()}
            </span>
          ) : (
            <svg
              className={styles.person}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="3.25" />
              <path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20" />
            </svg>
          )
        }
        aria-label={busy ? "Signing out" : "Account menu"}
        triggerClassName={styles.trigger}
      >
        {checking ? (
          <MenuLabel>Checking sign-in…</MenuLabel>
        ) : session.data ? (
          <>
            <MenuLabel>
              {expired
                ? "Your sign-in expired"
                : account
                  ? "Signed in"
                  : "Account details unavailable"}
              {email ? " as" : ""}
              {email && <strong>{email}</strong>}
            </MenuLabel>
            {expired && (
              <MenuItem
                disabled={busy}
                onSelect={() => void navigate({ to: "/sign-in" })}
              >
                Sign in again
              </MenuItem>
            )}
            {account?.learners.some(
              (learner) => learner.entitlement.active,
            ) && (
              <MenuItem
                disabled={busy}
                onSelect={() =>
                  void navigate({ to: "/$", params: { _splat: "practice" } })
                }
              >
                Continue learning
              </MenuItem>
            )}
            <MenuItem
              disabled={busy}
              onSelect={() =>
                void navigate({
                  to: "/$",
                  params: { _splat: "family/security" },
                })
              }
            >
              Account settings
            </MenuItem>
            <MenuItem
              disabled={busy}
              onSelect={() => void navigate({ to: "/pathways" })}
            >
              Your pathways
            </MenuItem>
            {unavailable && (
              <MenuItem disabled={busy} onSelect={() => void me.refetch()}>
                Retry account details
              </MenuItem>
            )}
            <MenuItem
              disabled={busy}
              onSelect={() => {
                setBusy(true);
                setError("");
                void import("../../auth")
                  .then(({ signOut }) => signOut())
                  .catch((failure) => {
                    console.error("Sign-out failed", failure);
                    setError("Sign out did not finish. Try again.");
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Signing out…" : "Sign out"}
            </MenuItem>
          </>
        ) : unavailable ? (
          <MenuItem onSelect={() => void session.refetch()}>
            Retry sign-in check
          </MenuItem>
        ) : (
          <>
            <MenuLabel>Save your pathways with an account.</MenuLabel>
            <MenuItem onSelect={() => void navigate({ to: "/sign-in" })}>
              Sign in
            </MenuItem>
            <MenuItem onSelect={() => void navigate({ to: "/sign-up" })}>
              Create account
            </MenuItem>
          </>
        )}
      </Menu>
      <Toast message={error} onDismiss={() => setError("")} />
    </span>
  );
}
