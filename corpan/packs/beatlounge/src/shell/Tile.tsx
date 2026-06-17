/**
 * beatlounge — a single Stage tile. ONE place that decides how a module's tile
 * is wrapped, keyed off the module's `tileInteractive` flag:
 *
 *   • DEFAULT (summary tile) — the whole tile is a tap-to-open `<button>` that
 *     enters immersive. Unchanged from the original Shell inline render: calm,
 *     glanceable, one tap opens the full page.
 *
 *   • INTERACTIVE (live widget) — a plain `<div>` so the widget's OWN controls
 *     (dials, ribbons, popover triggers) work without a nested button and
 *     without taps bubbling to enterImmersive. The shell still provides a small,
 *     CONSISTENT corner "expand" control that opens the module's full page, so
 *     every live widget gets the same affordance for free (the module renders
 *     only its widget body, never its own expand button).
 *
 * The expand control is a shell sibling of the ModuleHost mount node — never
 * inside it — so the module's own React root can't tear it out.
 */

import type { BeatloungeHost, BeatloungeModule, FormFactor } from "../contracts/module"
import { ModuleHost } from "./ModuleHost"
import { ct } from "../i18n/strings"

interface Props {
  module: BeatloungeModule
  form: FormFactor
  host: BeatloungeHost
}

export const Tile = ({ module: m, form, host }: Props) => {
  const aspectClass = `bl-tile bl-tile--${m.tileAspect ?? "square"}`

  if (m.tileInteractive) {
    const expandTo = m.tileExpandTo ?? m.id
    return (
      <div className={`${aspectClass} bl-tile--live`}>
        <ModuleHost
          module={m}
          surface="tile"
          form={form}
          host={host}
          className="bl-tile-mount"
        />
        {!m.tileOwnsExpand && (
          <button
            type="button"
            className="bl-tile-expand"
            onClick={() => host.enterImmersive(expandTo)}
            aria-label={ct("shell.openModule", { name: m.title })}
            title={ct("shell.openModule", { name: m.title })}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M12 4h4v4M16 4l-5 5M8 16H4v-4M4 16l5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={aspectClass}
      onClick={() => host.enterImmersive(m.id)}
      aria-label={ct("shell.openModule", { name: m.title })}
    >
      <ModuleHost
        module={m}
        surface="tile"
        form={form}
        host={host}
        className="bl-tile-mount"
      />
    </button>
  )
}
