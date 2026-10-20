import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { accountClient } from "../../account-client";
import { authConfigOptions, sessionOptions } from "../../lib/query";
import { Button } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import { passkeysAvailable } from "./passkey";
import styles from "./PasskeyOffer.module.css";

const NOT_SAVED =
  "No passkey was saved. You can add one any time in Family → Security.";
const offered = (account: string) => `amp.passkey-offer.${account}`;
function seen(account: string) {
  try {
    return localStorage.getItem(offered(account)) === "done";
  } catch {
    return false;
  }
}
function remember(account: string) {
  try {
    localStorage.setItem(offered(account), "done");
  } catch (error) {
    console.warn("Passkey offer choice not stored", error);
  }
}
/** Screens where the offer would interrupt: sign-in itself, Security (which
 * manages passkeys) and practice. */
const quiet =
  /^\/(sign-in|sign-up|reset-password|family\/security|learn|try\/)/;

/**
 * After a sign-in with a provider or password, offer a passkey once: a fixed
 * card over the page (it moves nothing), shown while the new session is still
 * fresh enough to add one. "Not now" or adding one ends the offer on this
 * device for this parent; a parent who has a passkey never sees it.
 */
export function PasskeyOffer() {
  const location = useLocation();
  const { data: config } = useQuery(authConfigOptions);
  const { data: session } = useQuery(sessionOptions);
  const account = session?.accountId ?? null;
  const [closed, setClosed] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [added, setAdded] = useState("");
  const [busy, setBusy] = useState(false);
  const eligible =
    config?.mode === "accounts" &&
    !!account &&
    closed !== account &&
    passkeysAvailable() &&
    !seen(account);
  const summary = useQuery({
    queryKey: ["account", account, "security-summary"],
    enabled: eligible,
    staleTime: Infinity,
    queryFn: async () => {
      const response = await fetch("/api/auth/security/summary", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`Security summary ${response.status}`);
      return (await response.json()) as {
        passkeys: unknown[];
        freshForMs: number;
      };
    },
  });
  const hasPasskey = !!summary.data?.passkeys.length;
  useEffect(() => {
    if (hasPasskey && account) remember(account);
  }, [hasPasskey, account]);
  const show =
    eligible &&
    !quiet.test(location.pathname) &&
    !!summary.data &&
    !hasPasskey &&
    summary.data.freshForMs > 0;
  // While shown, the page can scroll its last content clear of the card. The
  // added space is below the content, so nothing visible moves.
  const card = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!show || !card.current) return;
    const style = document.documentElement.style;
    style.setProperty("padding-bottom", `${card.current.offsetHeight + 32}px`);
    return () => {
      style.removeProperty("padding-bottom");
    };
  }, [show]);
  const close = () => {
    if (account) remember(account);
    setClosed(account);
  };
  return (
    <>
      <Toast message={added} tone="status" onDismiss={() => setAdded("")} />
      {show && (
        <aside
          ref={card}
          className={styles.offer}
          aria-labelledby="passkey-offer-title"
        >
          <p id="passkey-offer-title" className={styles.title}>
            Add a passkey for faster sign-in
          </p>
          {/* Both texts share one cell, so a problem never resizes the card. */}
          <p className={styles.body}>
            <span style={{ visibility: problem ? "hidden" : undefined }}>
              Next time, sign in with your face, fingerprint or screen lock.
            </span>
            <span
              role="alert"
              className={styles.problem}
              style={{ visibility: problem ? undefined : "hidden" }}
            >
              {problem || NOT_SAVED}
            </span>
          </p>
          <div className={styles.actions}>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setProblem("");
                void accountClient.passkey
                  .addPasskey({ name: "Passkey" })
                  .then((result) => {
                    if (result?.error) {
                      console.warn("Passkey offer not completed", result.error);
                      setProblem(NOT_SAVED);
                      return;
                    }
                    close();
                    setAdded("Passkey added. Use it next time you sign in.");
                    void summary.refetch();
                  })
                  .catch((error) => {
                    console.error("Passkey offer failed", error);
                    setProblem(NOT_SAVED);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              Add passkey
            </Button>
            <Button variant="quiet" disabled={busy} onClick={close}>
              Not now
            </Button>
          </div>
        </aside>
      )}
    </>
  );
}
