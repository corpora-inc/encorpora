import { useEffect, type ReactNode } from "react";
import { buttonClass } from "./Button";
import { AppError } from "../lib/AppError";
import { brand } from "../../brand";

/**
 * The first paint and every route-level wait: the brand bar in its final
 * place over an empty page, the same frame index.html paints before any
 * script runs. No loading text flashes; an error appears in the body with
 * its recovery action, and nothing moves when the screen arrives.
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
    <div className="app-loading" aria-busy={!error}>
      <div className="app-loading-bar">{brand.name}</div>
      <main className="app-loading-body">
        {error && (
          <>
            <p role="alert">{error}</p>
            {retry && (
              <button className="loading-retry" disabled={busy} onClick={retry}>
                Try again
              </button>
            )}
            {recovery}
          </>
        )}
      </main>
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
