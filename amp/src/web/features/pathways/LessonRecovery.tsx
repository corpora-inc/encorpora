import { Component, type ReactNode } from "react";
import { Button } from "../../ui/Button";

export function LessonFailure({
  onBack,
  retry,
}: {
  onBack: () => void;
  retry?: () => void;
}) {
  return (
    <section aria-label="Lesson recovery">
      <p role="alert">
        The lesson could not be opened. You can return to your map or reload the
        page.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Button variant="primary" onClick={onBack}>
          Back to map
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
  { children: ReactNode; onBack: () => void },
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
      <LessonFailure onBack={this.props.onBack} />
    ) : (
      this.props.children
    );
  }
}
