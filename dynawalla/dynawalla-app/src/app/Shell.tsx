import { Link, Outlet, useMatches } from "react-router"

import { IndexMark } from "../design/IndexMark.tsx"
import { Strapwork } from "../design/Strapwork.tsx"
import { strings } from "./strings.ts"
import { DESTINATIONS, type Destination } from "./routes.ts"

const isDestination = (value: unknown): value is Destination =>
  typeof value === "string" && (DESTINATIONS as readonly string[]).includes(value)

/**
 * The lintel: the carved band every screen hangs beneath. The wordmark is the
 * way home, and the index — the brass mark — names where you currently are.
 */
function Lintel() {
  const matches = useMatches()
  const here = matches.map((match) => match.handle).find(isDestination)

  return (
    <header className="bg-ground-raised">
      <div className="flex items-baseline gap-3 px-[max(var(--safe-left),1rem)] pt-[max(var(--safe-top),0.75rem)] pr-[max(var(--safe-right),1rem)] pb-3">
        <Link
          to="/"
          className="inscription rounded-cut-sm text-lg tracking-[0.22em] text-ink uppercase"
        >
          {strings.appName}
        </Link>

        {here ? (
          <span className="flex items-baseline gap-2 text-sm text-ink-muted">
            <IndexMark className="text-index" />
            {strings.destinations[here]}
          </span>
        ) : null}
      </div>

      <Strapwork />
    </header>
  )
}

export function Shell() {
  return (
    <div className="bg-ground text-ink flex min-h-full flex-col">
      <Lintel />
      <main className="mx-auto w-full max-w-2xl flex-1 px-[max(var(--safe-left),1rem)] pt-6 pr-[max(var(--safe-right),1rem)] pb-[max(var(--safe-bottom),1.5rem)]">
        <Outlet />
      </main>
    </div>
  )
}
