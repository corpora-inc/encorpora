import { useEffect, type ReactNode } from "react";
import { buttonClass } from "./Button";
import { AppError } from "../lib/AppError";

/**
 * Match the centered first paint in index.html while the destination resolves.
 * The inline stylesheet owns both frames, including before scripts arrive.
 * Keep the mark still: remounting during redirects must not restart an animation.
 */
export function LoadingScreen({
  error = "",
  retry,
  busy = false,
  recovery,
}: {
  error?: string;
  retry?: () => void;
  busy?: boolean;
  recovery?: ReactNode;
}) {
  return (
    <div
      className="app-loading"
      role={error ? undefined : "status"}
      aria-label={error ? undefined : "Loading AMP"}
      aria-busy={!error}
    >
      <div className="app-loading-content">
        <svg
          className="app-loading-mark"
          viewBox="0 0 44 28"
          aria-hidden="true"
        >
          <path d="M1 14C5 0 9 0 13 14S21 28 25 14S33 0 37 14S41 28 43 14" />
        </svg>
        {error && (
          <main className="app-loading-body">
            <p role="alert">{error}</p>
            {retry && (
              <button
                className={buttonClass("primary")}
                disabled={busy}
                onClick={retry}
              >
                Try again
              </button>
            )}
            {recovery}
          </main>
        )}
      </div>
    </div>
  );
}
export function RouteError({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  const pathways =
    window.location.pathname === "/pathways" ||
    window.location.pathname.startsWith("/pathways/");
  const mapHref =
    new URLSearchParams(window.location.search).get("context") === "trial"
      ? "/pathways?context=trial"
      : "/pathways";
  useEffect(() => {
    console.error("Application route failed to load or render.");
  }, [error]);
  return (
    <LoadingScreen
      error={
        error instanceof AppError
          ? error.message
          : "This screen could not be loaded."
      }
      retry={pathways ? undefined : reset}
      recovery={
        pathways && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
          >
            <a className={buttonClass("primary")} href={mapHref}>
              Back to map
            </a>
            <button
              className={buttonClass("secondary")}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        )
      }
    />
  );
}
