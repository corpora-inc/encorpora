import {
  createContext,
  useContext,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";

/** Where the pitch can send a visitor: a path and its search. */
export type PitchPlace = { to: string; search?: Record<string, unknown> };

/**
 * How the pitch moves. In the app, through its router (`router-nav.ts`). On
 * the light home document (`home-entry.tsx`), by handing the page to the app
 * at the place chosen. The pitch never imports the router itself, so the home
 * entry can paint it without loading the app.
 */
export type PitchNav = {
  /** `/`'s search, as the router reads it. */
  search: Record<string, unknown>;
  /** The address a link shows, for a new tab or a long press. */
  href: (place: PitchPlace) => string;
  go: (place: PitchPlace) => void;
  /** A link was pointed at or focused: make going there instant. */
  preload: (place: PitchPlace) => void;
  /** Decide `/` again: a consent link arrived while the pitch shows. */
  reload: () => void;
};

const Context = createContext<PitchNav | null>(null);
export const PitchNavProvider = Context.Provider;

export function usePitchNav(): PitchNav {
  const nav = useContext(Context);
  if (!nav) throw new Error("The pitch renders inside a PitchNavProvider");
  return nav;
}

/** A plain click moves within AMP; a modified click, or another target, is
 * the browser's own (the router's Link makes the same distinction). */
function inPage(event: MouseEvent<HTMLAnchorElement>) {
  const target = event.currentTarget.getAttribute("target");
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) &&
    (!target || target === "_self")
  );
}

/**
 * A link to another AMP screen: a real address, opened in place. `current`
 * marks the page's own link (the brand, on `/`) the way the router's Link
 * marks an active one.
 */
export function PitchLink({
  place,
  current = false,
  className,
  onClick,
  onFocus,
  onMouseEnter,
  onTouchStart,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  place: PitchPlace;
  current?: boolean;
}) {
  const nav = usePitchNav();
  const preload = () => nav.preload(place);
  return (
    <a
      {...props}
      className={current ? `${className ?? ""} active`.trim() : className}
      {...(current
        ? { "data-status": "active", "aria-current": "page" as const }
        : {})}
      href={nav.href(place)}
      onClick={(event) => {
        onClick?.(event);
        if (!inPage(event)) return;
        event.preventDefault();
        nav.go(place);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preload();
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        preload();
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        preload();
      }}
    />
  );
}
