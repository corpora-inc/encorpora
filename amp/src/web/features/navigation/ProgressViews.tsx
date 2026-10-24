import { Link } from "@tanstack/react-router";
import styles from "./ProgressViews.module.css";
export function ProgressViews({
  active,
  trial = false,
}: {
  active: "level" | "pathways" | "inventory";
  trial?: boolean;
}) {
  const views = [
    { id: "level", label: "Level", path: trial ? "/try/map" : "/" },
    { id: "pathways", label: "Pathways", path: "/pathways" },
    { id: "inventory", label: "Inventory", path: "/inventory" },
  ];
  return (
    <nav
      data-progress-views
      aria-label="Progress views"
      className={styles.views}
    >
      {views.map((view) => (
        <Link
          key={view.id}
          to="/$"
          params={{ _splat: view.path.slice(1) }}
          search={trial ? { context: "trial" } : {}}
          aria-current={active === view.id ? "page" : undefined}
        >
          {view.label}
        </Link>
      ))}
    </nav>
  );
}
