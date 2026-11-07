import type { CSSProperties } from "react";
import { screenFile, type ProductScreen } from "./screens";
import styles from "./Schools.module.css";

const NARROW = "(max-width: 719.98px)";
const DARK = "(prefers-color-scheme: dark)";

/** A real screen at its own proportions. Its box is reserved before the file
 * arrives, whichever of the four images the browser picks. */
export function ProductShot({
  screen,
  eager = false,
  className = "",
}: {
  screen: ProductScreen;
  eager?: boolean;
  className?: string;
}) {
  const file = (shape: "wide" | "narrow", theme: "light" | "dark") =>
    screenFile(screen.id, shape, theme);
  const narrowDark = file("narrow", "dark");
  const wideDark = file("wide", "dark");
  return (
    <picture
      className={`${styles.shot} ${className}`}
      style={
        {
          "--shot-wide": `${screen.wide.width} / ${screen.wide.height}`,
          "--shot-narrow": `${screen.narrow.width} / ${screen.narrow.height}`,
        } as CSSProperties
      }
    >
      {narrowDark && (
        <source
          media={`${NARROW} and ${DARK}`}
          srcSet={narrowDark}
          {...screen.narrow}
        />
      )}
      <source
        media={NARROW}
        srcSet={file("narrow", "light")}
        {...screen.narrow}
      />
      {wideDark && <source media={DARK} srcSet={wideDark} {...screen.wide} />}
      <img
        src={file("wide", "light")}
        alt={screen.alt}
        {...screen.wide}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}
