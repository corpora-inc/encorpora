import { useState, type CSSProperties, type ReactNode } from "react";
import type { DesignTheme } from "./search";
import styles from "./Design.module.css";

/** One component's section: its name, where it lives, and its states. */
export function Section({
  id,
  title,
  source,
  note,
  children,
}: {
  id: string;
  title: string;
  /** Files under `amp/src/web/`. */
  source: readonly string[];
  /** What the gallery can't show, or how it renders this one. */
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.sectionHead}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          <a href={`#${id}`}>{title}</a>
        </h2>
        <p className={styles.source}>
          {source.map((path) => (
            <code key={path}>
              {/* A long path breaks after a slash, never inside a name. */}
              {path.split("/").map((part, index, parts) => (
                <span key={index}>
                  {part}
                  {index < parts.length - 1 && (
                    <>
                      /<wbr />
                    </>
                  )}
                </span>
              ))}
            </code>
          ))}
        </p>
        {note && <p className={styles.note}>{note}</p>}
      </div>
      <div className={styles.specimens}>{children}</div>
    </section>
  );
}

/** One state of a component, under its name. `wide` takes the whole row. */
export function Specimen({
  label,
  wide = false,
  plain = false,
  children,
}: {
  label: string;
  wide?: boolean;
  /** No surface of its own: the component draws its own page or panel. */
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <figure
      className={`${styles.specimen} ${wide ? styles.wide : ""} ${plain ? styles.plain : ""}`}
    >
      <figcaption className={styles.label}>{label}</figcaption>
      <div className={styles.stage}>{children}</div>
    </figure>
  );
}

let canvasTheme: DesignTheme | undefined;
/** The theme the canvas opened with, so frames start in it; later changes
 * reach them over the gallery's channel, without reloading. */
export function setFrameTheme(theme: DesignTheme) {
  canvasTheme = theme;
}

/** A component that owns the whole viewport (practice, a sheet, a toast), in
 * a document of its own at the canvas's width, so its media queries, fixed
 * layers and focus behave as on a real screen. */
export function SpecimenFrame({
  specimen,
  label,
  height,
}: {
  specimen: string;
  label: string;
  /** Pixels; by default a phone's or a laptop's screen height. */
  height?: number;
}) {
  const [src] = useState(
    () =>
      `/design?frame=specimen&specimen=${specimen}${canvasTheme ? `&theme=${canvasTheme}` : ""}`,
  );
  const tall =
    height ??
    (typeof window !== "undefined" && window.innerWidth < 600 ? 740 : 800);
  return (
    <figure className={`${styles.specimen} ${styles.wide} ${styles.bleed}`}>
      <figcaption className={styles.label}>
        {label}
        <a className={styles.open} href={src} target="_blank" rel="noopener">
          Open alone
        </a>
      </figcaption>
      <iframe
        className={styles.frame}
        style={{ "--frame-height": `${tall}px` } as CSSProperties}
        src={src}
        title={label}
        loading="lazy"
      />
    </figure>
  );
}
