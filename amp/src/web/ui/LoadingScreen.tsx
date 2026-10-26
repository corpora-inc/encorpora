import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { buttonClass } from "./Button";
import { AppError } from "../lib/AppError";

// Reuse the bootstrap animation's document-timeline start time. Every React
// instance then joins the running wave instead of restarting it on navigation.
const waveStart =
  typeof document === "undefined"
    ? 0
    : (document.querySelector(".app-loading-wave")?.getAnimations?.()[0]
        ?.startTime ?? 0);

/**
 * Match the centered first paint in index.html while the destination resolves.
 * The inline stylesheet owns both frames, including before scripts arrive.
 * CSS handles the motion; JavaScript only synchronizes each newly mounted wave.
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
  const wave = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    if (error) return;
    const sync = () => {
      for (const animation of wave.current?.getAnimations?.() ?? [])
        animation.startTime = waveStart;
    };
    sync();
    const motion = matchMedia("(prefers-reduced-motion: no-preference)");
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, [error]);
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
          <path
            ref={wave}
            className="app-loading-wave"
            d="M-23 14C-19 0-15 0-11 14S-3 28 1 14S9 0 13 14S21 28 25 14S33 0 37 14S45 28 49 14S57 0 61 14S69 28 73 14"
          />
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
