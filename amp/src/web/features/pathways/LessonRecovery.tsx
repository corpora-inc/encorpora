import { Component, type ReactNode } from "react";
import { Button } from "../../ui/Button";

export function LessonFailure({
  onBack,
  retry,
  backLabel = "Back to map",
}: {
  onBack: () => void;
  retry?: () => void;
  backLabel?: string;
}) {
  return (
    <section aria-label="Lesson recovery">
      <p role="alert">
        The lesson could not be opened. Retry it, or reload the page.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Button variant="primary" onClick={onBack}>
          {backLabel}
        </Button>
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Retry lesson
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </section>
  );
}

/** Keep the dialog shell mounted when a lazy import or lesson render fails. */
export class LessonBoundary extends Component<
  { children: ReactNode; onBack: () => void; backLabel?: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Exception messages can contain request details; log only the failed surface.
    console.error("Pathways lesson failed to load or render.");
  }
  render() {
    // React.lazy retains a rejected import. A reset-only retry cannot recover it.
    return this.state.failed ? (
      <LessonFailure
        onBack={this.props.onBack}
        backLabel={this.props.backLabel}
      />
    ) : (
      this.props.children
    );
  }
}

/** Around the lesson layer's own chunk (nav/LayerHost): when that chunk
 * fails to load, its failure stays in the layer, named for where closing
 * goes, and the page under it stays. Nothing escapes to the route. */
export class LessonLayerBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Exception messages can contain request details; log only the failed surface.
    console.error("Pathways lesson layer failed to load.");
  }
  render() {
    // React.lazy retains a rejected import: Reload page is the way to retry.
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
