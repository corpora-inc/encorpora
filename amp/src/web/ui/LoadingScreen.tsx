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
}: {
  error?: string;
  retry?: () => void;
  busy?: boolean;
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
  return (
    <LoadingScreen
      error={
        error instanceof AppError
          ? error.message
          : "This screen could not be loaded. Try again."
      }
      retry={reset}
    />
  );
}
