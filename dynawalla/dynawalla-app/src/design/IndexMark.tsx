/**
 * The index: the brass lozenge that marks the thing currently being pointed
 * at. It takes its colour from `currentColor` so it belongs to whatever it is
 * marking, and it is always decorative — the state it indicates is carried in
 * the markup as well, never by the mark alone.
 */
export function IndexMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="8"
      height="8"
      viewBox="0 0 8 8"
      focusable="false"
    >
      <path d="M4 0 L8 4 L4 8 L0 4 Z" fill="currentColor" />
    </svg>
  )
}
