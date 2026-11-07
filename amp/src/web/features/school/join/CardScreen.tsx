import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { claimCardToken, takeCardFragment } from "../../../card-entry";
import { Button, buttonClass } from "../../../ui/Button";
import { LoadingScreen } from "../../../ui/LoadingScreen";
import {
  finishingSignIn,
  signInWithCard,
  useFinishSignIn,
  type JoinError,
} from "./api";
import { JoinFrame } from "./JoinFrame";
import styles from "./Join.module.css";

/** `/c`: a printed card's link signs in at once. Without a token (a reload, or
 * Back), there's nothing to do here, so this goes to `/join`. */
export function CardScreen() {
  const navigate = useNavigate();
  const finish = useFinishSignIn();
  const [failure, setFailure] = useState<JoinError | null>(null);
  const token = useRef<string | null>(null);
  const start = useCallback(() => {
    if (!token.current) return;
    setFailure(null);
    signInWithCard(token.current)
      .then(finish)
      .catch((error: JoinError) => setFailure(error));
  }, [finish]);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || finishingSignIn()) return;
    started.current = true;
    token.current = claimCardToken();
    if (token.current) start();
    else void navigate({ to: "/join", replace: true });
  }, [navigate, start]);
  // Another card's link, opened in this same tab.
  useEffect(() => {
    const changed = () => {
      takeCardFragment();
      token.current = claimCardToken() ?? token.current;
      start();
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [start]);
  if (!failure) return <LoadingScreen />;
  return (
    <JoinFrame>
      <div className={styles.column} data-centered>
        <div role="alert">
          <h1 className={styles.title}>{failure.message}</h1>
        </div>
        {failure.retry && (
          <Button
            variant="primary"
            className={styles.bigButton}
            onClick={start}
          >
            Try again
          </Button>
        )}
        <Link
          to="/join"
          className={buttonClass(
            failure.retry ? "secondary" : "primary",
            styles.bigButton,
          )}
        >
          Type a class code
        </Link>
      </div>
    </JoinFrame>
  );
}
