import type { CSSProperties } from "react";
import { useMapView } from "./map-view";
import { areas, type AreaId } from "./model";
import styles from "./AreaKey.module.css";

/**
 * The five areas of math as the map's key, each a choice that shows only
 * that area, and All. The map's view holds the choice (map-view.ts), so
 * Back, a refresh and a return from practice keep it. Every chip keeps its
 * size selected or not, so choosing one moves nothing.
 */
export function AreaKey({
  area,
  className,
}: {
  area: AreaId | null;
  className?: string;
}) {
  const view = useMapView();
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
        <button
          type="button"
          key={option.id ?? "all"}
          onClick={() => view.set({ area: option.id })}
          aria-pressed={option.id === area}
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
        </button>
      ))}
    </nav>
  );
}
