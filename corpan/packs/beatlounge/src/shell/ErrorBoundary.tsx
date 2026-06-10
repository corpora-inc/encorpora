/**
 * beatlounge — a pack-level error boundary. A render error in any module/shell
 * is contained HERE (with a dignified "reload" affordance) instead of bubbling
 * to the host's React tree and white-screening the whole pack. Noisy-not-silent:
 * the error is logged.
 */

import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  /** Called when the user taps "Reload" — App rebuilds the rig from scratch. */
  onReset?: () => void
}
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[beatlounge] render error contained by boundary:", error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="bl-root" data-skin="midnight">
          <div className="bl-boot" style={{ alignItems: "center", justifyContent: "center" }}>
            <div className="bl-wordmark">beatlounge</div>
            <p style={{ color: "var(--bl-text-dim)", fontSize: "var(--bl-fs-label)", textAlign: "center", maxWidth: 360 }}>
              Something hiccuped. Your loop is safe.
            </p>
            <button
              type="button"
              onClick={this.reset}
              style={{
                appearance: "none",
                WebkitAppearance: "none",
                marginTop: "var(--bl-s3)",
                padding: "var(--bl-s3) var(--bl-s5)",
                minHeight: "var(--bl-hit)",
                background: "var(--bl-accent)",
                color: "var(--bl-bg)",
                border: "none",
                borderRadius: "var(--bl-radius-pill)",
                fontFamily: "var(--bl-font-mono)",
                fontSize: "var(--bl-fs-label)",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
