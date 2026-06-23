/**
 * beatlounge — Grooves inline-SVG mark (NO emoji): three stacked rhythm lanes
 * with offset hits, evoking a step grid / clave. Inherits currentColor.
 */

interface Props {
  size?: number
}

export const GrooveMark = ({ size = 22 }: Props) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    aria-hidden="true"
  >
    {/* three lanes */}
    <path d="M3 7h18M3 12h18M3 17h18" opacity={0.35} />
    {/* hits on a clave-ish offset */}
    <circle cx="4.5" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="11" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="7.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="14" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="4.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="11" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="20.5" cy="17" r="1.5" fill="currentColor" stroke="none" />
  </svg>
)
