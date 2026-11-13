import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useLoggedError } from "../feedback";
import { Button } from "./Button";
import { Loading } from "./Loading";
import styles from "./QueryBlock.module.css";

/**
 * A part of a screen that waits on one read. While it loads, the wave holds
 * the part's reserved space (`className` sets its height, so nothing moves
 * when it lands). If the read fails, that same space says so, logs it, and
 * offers Try again: a wait never spins forever.
 */
export function QueryBlock<T>({
  query,
  what,
  className = "",
  children,
}: {
  query: Pick<
    UseQueryResult<T>,
    "data" | "isError" | "error" | "isFetching" | "refetch"
  >;
  /** What failed, as a subject: "The class code". */
  what: string;
  className?: string;
  children: (data: T) => ReactNode;
}) {
  const failed = query.isError && query.data === undefined;
  useLoggedError(
    failed ? `${what} didn’t load: ${query.error?.message ?? "unknown"}` : "",
  );
  if (query.data !== undefined) return <>{children(query.data)}</>;
  return (
    <div className={`${styles.block} ${className}`} data-query-block="">
      {failed ? (
        <>
          <p role="alert" className={styles.message}>
            {what} didn’t load. Check your connection, then try again.
          </p>
          <Button
            variant="secondary"
            aria-busy={query.isFetching || undefined}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </>
      ) : (
        <Loading />
      )}
    </div>
  );
}
