import { AppError } from "../../lib/AppError";
import { Button } from "../../ui/Button";
import { frameCard, PageFrame } from "../../ui/PageFrame";
import styles from "./Trial.module.css";

/** What failed and what to do, for an action outside a request helper. */
export function failureMessage(error: unknown, fallback: string) {
  if (error instanceof AppError) return error.message;
  console.error("Free practice action failed", error);
  return fallback;
}

/** The same frame and card size as the screen it stands in for. */
export function TrialSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <PageFrame>
      <section
        className={`${frameCard} ${wide ? styles.panel : styles.start}`}
        aria-busy="true"
        aria-label="Loading free practice"
      >
        <div className={styles.skeleton}>
          <span style={{ width: "40%", height: 14 }} />
          <span style={{ width: "75%", height: 34 }} />
          <span style={{ height: wide ? 260 : 220 }} />
          <span style={{ height: 52 }} />
        </div>
      </section>
    </PageFrame>
  );
}

/** A designed failure state with the one action that can recover. */
export function TrialFailure({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <PageFrame>
      <section className={`${frameCard} ${styles.start}`}>
        <h1 className={styles.title}>Free practice didn’t load</h1>
        <p role="alert" className={styles.lede}>
          {failureMessage(
            error,
            "Check your connection, then try again. Your progress is saved.",
          )}
        </p>
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
      </section>
    </PageFrame>
  );
}
