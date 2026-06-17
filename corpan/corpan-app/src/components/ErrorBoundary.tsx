import { Component, type ErrorInfo, type ReactNode } from "react"

/**
 * Minimal class error boundary. React error boundaries MUST be class
 * components. Renders `fallback` (default: nothing) when a child throws, and
 * calls `onError` so the host can recover — e.g. tear down a full-screen
 * overlay and proceed, so a render/effect throw can never leave a dead,
 * unclickable screen mounted over the app.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode; onError?: (error: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}
