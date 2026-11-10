import { useNavigate, useRouterState, useSearch } from "@tanstack/react-router";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Segmented } from "../../ui/Segmented";
import { EmptyState } from "../../ui/EmptyState";
import "../school/SchoolFrame.module.css";
import { contents, GallerySections, specimens } from "./catalog";
import { setFrameTheme } from "./Gallery";
import {
  designWidths,
  type DesignSearch,
  type DesignTheme,
  type DesignWidth,
} from "./search";
import { systemTheme, useDesignTheme, useNoIndex } from "./theme";
import styles from "./Design.module.css";

const SECTION = "amp-design-section";

/** `/design`: every shared component in its states, from fixtures only. */
export function DesignScreen() {
  const search = useSearch({ strict: false }) as DesignSearch;
  useNoIndex();
  const theme = search.theme ?? systemTheme();
  if (search.frame === "canvas") return <Canvas theme={theme} />;
  if (search.frame === "specimen")
    return <SpecimenView id={search.specimen} theme={theme} />;
  return <Chrome width={search.width ?? "fill"} theme={theme} />;
}

const widthOptions = [
  { value: "fill", label: "Fill" },
  ...designWidths.map((width) => ({
    value: String(width),
    label: String(width),
  })),
];
const themeOptions = [
  { value: "light" as const, label: "Light" },
  { value: "dark" as const, label: "Dark" },
];

/** The gallery page: its controls, and the canvas framed at the chosen width,
 * so every media query answers to that width as on a real device. */
function Chrome({
  width,
  theme: initialTheme,
}: {
  width: DesignWidth;
  theme: DesignTheme;
}) {
  const navigate = useNavigate();
  const [theme, setTheme] = useDesignTheme(initialTheme);
  const hash = useRouterState({ select: (state) => state.location.hash });
  // Fixed at first paint: later changes reach the canvas without a reload.
  const [src] = useState(
    () => `/design?frame=canvas&theme=${theme}${hash ? `#${hash}` : ""}`,
  );
  const viewport = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ width: number; height: number } | null>(
    null,
  );
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () =>
      setRoom({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // The section read in the canvas becomes this page's address.
  useEffect(() => {
    const follow = (event: MessageEvent<unknown>) => {
      const data = event.data as { type?: string; id?: string } | null;
      if (event.origin !== location.origin || data?.type !== SECTION) return;
      void navigate({
        to: ".",
        search: (previous: Record<string, unknown>) => previous,
        hash: data.id ?? "",
        replace: true,
        resetScroll: false,
      } as never);
    };
    window.addEventListener("message", follow);
    return () => window.removeEventListener("message", follow);
  }, [navigate]);
  const set = (patch: Partial<DesignSearch>) =>
    void navigate({
      to: ".",
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      }),
      hash: (current: string) => current,
      replace: true,
      resetScroll: false,
    } as never);
  const device = !room || width === "fill" ? (room?.width ?? 0) : width;
  const scale = room && device ? Math.min(1, room.width / device) : 1;
  return (
    <div className={styles.chrome}>
      <div className={styles.toolbar}>
        <h1 className={styles.chromeTitle}>Components</h1>
        <div className={styles.widthControl}>
          <Segmented
            label="Width"
            options={widthOptions}
            value={String(width)}
            onChange={(next) =>
              set({
                width:
                  next === "fill"
                    ? "fill"
                    : (Number(next) as (typeof designWidths)[number]),
              })
            }
            compact
            dense
          />
        </div>
        <div className={styles.themeControl}>
          <Segmented
            label="Theme"
            options={themeOptions}
            value={theme}
            onChange={(next) => {
              setTheme(next);
              set({ theme: next });
            }}
            compact
            dense
          />
        </div>
        <p className={styles.readout} aria-live="polite">
          {room
            ? `${Math.round(device)} px${scale < 1 ? `, shown at ${Math.round(scale * 100)}%` : ""}`
            : " "}
        </p>
      </div>
      <div ref={viewport} className={styles.viewport}>
        {room && (
          <div
            className={styles.device}
            style={
              {
                width: `${device * scale}px`,
                height: `${room.height}px`,
              } as CSSProperties
            }
          >
            <iframe
              className={styles.canvasFrame}
              src={src}
              title="Components at the chosen width"
              style={{
                width: `${device}px`,
                height: `${room.height / scale}px`,
                transform: scale < 1 ? `scale(${scale})` : undefined,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Every section, in one scrolling document at the frame's width. */
function Canvas({ theme: initialTheme }: { theme: DesignTheme }) {
  const [theme] = useDesignTheme(initialTheme);
  setFrameTheme(theme);
  // An address with a section opens on it, once the sections are drawn.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id)
      requestAnimationFrame(() =>
        document.getElementById(id)?.scrollIntoView({ block: "start" }),
      );
    const tell = () => {
      if (window.parent === window) return;
      window.parent.postMessage(
        { type: SECTION, id: decodeURIComponent(location.hash.slice(1)) },
        location.origin,
      );
    };
    window.addEventListener("hashchange", tell);
    return () => window.removeEventListener("hashchange", tell);
  }, []);
  return (
    <main className={styles.canvas}>
      <div className={styles.intro}>
        <h1 className={styles.canvasTitle}>AMP components</h1>
        <p className={styles.lede}>
          Every shared component in its states, drawn from fixtures. Hover and
          focus are live: point at a control, or Tab to it. The inventory and
          grades are in <code>amp/docs/components.md</code>.
        </p>
        <nav className={styles.contents} aria-label="Sections">
          {contents.map(({ group, sections }) => (
            <div key={group} className={styles.group}>
              <h2 className={styles.groupTitle}>{group}</h2>
              <ul className={styles.groupList}>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <GallerySections />
    </main>
  );
}

/** One viewport-owning component alone, as a gallery frame shows it. */
function SpecimenView({
  id,
  theme: initialTheme,
}: {
  id: string | undefined;
  theme: DesignTheme;
}) {
  useDesignTheme(initialTheme);
  const render = id ? specimens[id] : undefined;
  if (!render)
    return (
      <main className={styles.canvas}>
        <EmptyState title="No such specimen">
          This frame names a component the gallery doesn't have.
        </EmptyState>
      </main>
    );
  return <>{render()}</>;
}
