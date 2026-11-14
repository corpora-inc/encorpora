import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { areas, type AreaId } from "./model";
import styles from "./AreaKey.module.css";

/**
 * The five areas of math as the map's key, each a link that shows only that
 * area (`?area=geometry`), and All. The address holds the choice, so Back,
 * a refresh and a shared link keep it. Every chip keeps its size selected or
 * not, so choosing one moves nothing.
 */
export function AreaKey({
  area,
  className,
}: {
  area: AreaId | null;
  className?: string;
}) {
  const options: { id: AreaId | null; title: string; slot: number }[] = [
    { id: null, title: "All", slot: -1 },
    ...areas.map((a, slot) => ({ id: a.id, title: a.title, slot })),
  ];
  return (
    <nav
      className={`${styles.key} ${className ?? ""}`}
      aria-label="Math areas"
      data-area-key=""
    >
      {options.map((option) => (
        <Link
          key={option.id ?? "all"}
          to="."
          search={
            ((current: Record<string, unknown>) => ({
              ...current,
              area: option.id ?? undefined,
            })) as never
          }
          resetScroll={false}
          className={styles.chip}
          data-area-choice={option.id ?? "all"}
          data-selected={option.id === area ? "" : undefined}
          style={
            option.slot >= 0
              ? ({
                  "--area": `var(--atlas-area-${option.slot})`,
                } as CSSProperties)
              : undefined
          }
        >
          {option.slot >= 0 && (
            <span className={styles.dot} aria-hidden="true" />
          )}
          {option.title}
        </Link>
      ))}
    </nav>
  );
}
