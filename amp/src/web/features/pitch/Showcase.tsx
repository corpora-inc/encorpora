import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  darkQuery,
  narrowQuery,
  showcaseFile,
  showcaseSizes,
} from "./showcase-files";
import { showcaseSlides, type ShowcaseSlide } from "./showcase-slides";
import styles from "./Showcase.module.css";
import { mediaMatches, onMediaChange } from "../../lib/media-query";

/** How long each slide rests before the next fades in. */
const ADVANCE_MS = 6500;
const reducedQuery = "(prefers-reduced-motion: reduce)";
const count = showcaseSlides.length;

// Media queries through lib/media-query.ts: an in-app browser may have no
// matchMedia listeners at all (verify-in-app-browser-ui, "apis").
const prefersReducedMotion = () => mediaMatches(reducedQuery);

const subscribeVisibility = (change: () => void) => {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
};
const pageVisible = () => document.visibilityState === "visible";

const subscribeNarrow = (change: () => void) =>
  onMediaChange(narrowQuery, change);

/** True once the page has loaded and the browser is idle: the later slides'
 * files start then, never in the first screen's bandwidth. */
function useWarm() {
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      // Safari has no requestIdleCallback: a short wait after load instead.
      if (typeof window.requestIdleCallback === "function")
        idle = window.requestIdleCallback(() => setWarm(true), {
          timeout: 2500,
        });
      else timer = setTimeout(() => setWarm(true), 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, []);
  return warm;
}

/** True while the showcase is on screen in a visible tab. */
function useOnScreen(element: RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const node = element.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) =>
      setInView(entries.some((entry) => entry.isIntersecting)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  const visible = useSyncExternalStore(
    subscribeVisibility,
    pageVisible,
    () => true,
  );
  return inView && visible;
}

/** A practice screen: the phone's own layout on a phone, the app side by
 * side on anything wider, each in the visitor's theme. */
function AppShot({ slide, first }: { slide: ShowcaseSlide; first: boolean }) {
  const file = (shape: "wide" | "narrow", theme: "light" | "dark") =>
    showcaseFile(`${slide.id}-${shape}-${theme}`);
  return (
    <picture>
      <source
        media={`${narrowQuery} and ${darkQuery}`}
        srcSet={file("narrow", "dark")}
        {...showcaseSizes.narrow}
      />
      <source
        media={narrowQuery}
        srcSet={file("narrow", "light")}
        {...showcaseSizes.narrow}
      />
      <source
        media={darkQuery}
        srcSet={file("wide", "dark")}
        {...showcaseSizes.wide}
      />
      <img
        src={file("wide", "light")}
        {...showcaseSizes.wide}
        alt={slide.alt}
        decoding="async"
        fetchPriority={first ? "high" : "low"}
      />
    </picture>
  );
}

/** Workbook pages as printed: paper on the table, in either theme. A phone
 * shows the first page. */
function PaperShot({ slide }: { slide: ShowcaseSlide }) {
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => mediaMatches(narrowQuery),
    () => false,
  );
  return (
    <div className={styles.paper}>
      {(narrow ? [1] : [1, 2]).map((page) => (
        <img
          key={page}
          className={styles.page}
          src={showcaseFile(`${slide.id}-page-${page}`)}
          {...showcaseSizes.page}
          alt={page === 1 ? slide.alt : ""}
          decoding="async"
          fetchPriority="low"
        />
      ))}
    </div>
  );
}

/**
 * The pitch's first-screen showcase: AMP's best moments, captured from the
 * real app and the real workbooks, one at a time in a fixed box. The first
 * slide paints with the page (the home document preloads its file); the
 * rest load once the page is idle. It moves on by itself, calmly, only while
 * nobody is pointing at it, focused in it or has paused it, and while it is
 * on screen; with reduced motion it never starts by itself. Every slide has
 * the same box, and a change is a fade, so nothing on the page ever moves.
 */
export function Showcase() {
  const [index, setIndex] = useState(0);
  // WCAG 2.2.2 (Pause, Stop, Hide): moving content that starts by itself
  // needs a way to pause it. Reduced motion starts paused.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const warm = useWarm();
  const onScreen = useOnScreen(root);
  const running = playing && warm && onScreen && !hovered && !focused;

  // A visitor who turns on reduced motion mid-visit stops the rotation.
  useEffect(() => {
    return onMediaChange(reducedQuery, () => {
      if (mediaMatches(reducedQuery)) setPlaying(false);
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const next = (index + 1) % count;
      // Fade only to a slide whose pictures are ready to draw.
      const images = [
        ...(root.current?.querySelectorAll<HTMLImageElement>(
          `[data-slide="${next}"] img`,
        ) ?? []),
      ];
      // A picture that fails to decode is logged and the fade goes ahead:
      // the box is reserved, and the rotation never stalls on one file.
      Promise.resolve()
        .then(() => Promise.all(images.map((image) => image.decode?.())))
        .catch((error: unknown) =>
          console.error("pitch showcase: a slide's picture failed", error),
        )
        .then(() => {
          if (!cancelled) setIndex(next);
        });
    }, ADVANCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [running, index]);

  /** The visitor chose: their slide stays until they press play. */
  const choose = (next: number) => {
    setIndex((next + count) % count);
    setPlaying(false);
  };
  // Swipe on touch screens: a mostly sideways stroke of 40 px or more.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipeStart = (event: PointerEvent) => {
    swipe.current =
      event.pointerType === "mouse"
        ? null
        : { x: event.clientX, y: event.clientY };
  };
  const swipeEnd = (event: PointerEvent) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.5)
      choose(index + (dx < 0 ? 1 : -1));
  };
  const blur = (event: FocusEvent) => {
    if (!root.current?.contains(event.relatedTarget as Node | null))
      setFocused(false);
  };

  return (
    <div
      ref={root}
      className={styles.showcase}
      role="region"
      aria-roledescription="carousel"
      aria-label="AMP at work"
      data-showcase=""
      data-warm={warm || undefined}
      data-running={running || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      // Keyboard focus holds a slide; a click's focus doesn't (Play would
      // otherwise wait for the visitor to click elsewhere).
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) setFocused(true);
      }}
      onBlur={blur}
    >
      {/* Announced when the visitor moves it, never while it rotates. */}
      <p className={styles.status} aria-live="polite" aria-atomic="true">
        {playing
          ? ""
          : `${index + 1} of ${count}: ${showcaseSlides[index]!.label}`}
      </p>
      <div
        className={styles.stage}
        onPointerDown={swipeStart}
        onPointerUp={swipeEnd}
        onPointerCancel={() => (swipe.current = null)}
      >
        {showcaseSlides.map((slide, i) => {
          const current = i === index;
          return (
            <figure
              key={slide.id}
              className={styles.slide}
              data-slide={i}
              data-kind={slide.kind}
              data-current={current || undefined}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!current}
              inert={!current}
            >
              {(i === 0 || warm || current) &&
                (slide.kind === "paper" ? (
                  <PaperShot slide={slide} />
                ) : (
                  <AppShot slide={slide} first={i === 0} />
                ))}
            </figure>
          );
        })}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.control}
          aria-label={playing ? "Pause slides" : "Play slides"}
          onClick={() => setPlaying((on) => !on)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {playing ? (
              <path d="M4.5 3h2.25v10H4.5zM9.25 3h2.25v10H9.25z" />
            ) : (
              <path d="M5 3.2v9.6a.6.6 0 0 0 .92.5l7.3-4.8a.6.6 0 0 0 0-1L5.92 2.7A.6.6 0 0 0 5 3.2z" />
            )}
          </svg>
        </button>
        {showcaseSlides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            className={styles.control}
            aria-label={slide.label}
            aria-current={i === index}
            onClick={() => choose(i)}
          >
            <span className={styles.dot} />
          </button>
        ))}
      </div>
    </div>
  );
}
