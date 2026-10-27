import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { bandLabel, type MapSkill } from "./model";
import { neighborLabel, type Neighbor } from "./neighbors";

export const defaultVisibleConnections = 5;

/**
 * Strict prerequisites lead each list. Editorial connections follow in a
 * quieter style and are labelled so they never read as requirements.
 */
export function ConnectionList({
  group,
  items,
  linkSearch,
  onNavigate,
  visible = defaultVisibleConnections,
}: {
  group: "builds-on" | "leads-to" | "related";
  items: Neighbor<MapSkill>[];
  linkSearch: Record<string, unknown>;
  onNavigate: () => void;
  visible?: number;
}) {
  const [all, setAll] = useState(false);
  const listId = useId();
  if (!items.length) return <p className="pathways-muted">None listed.</p>;
  const shown = all ? items : items.slice(0, visible);
  const more = items.length - shown.length;
  return (
    <div className="pathways-connection-group" data-group={group}>
      <ul className="pathways-connections" id={listId}>
        {shown.map((item) => {
          const label = neighborLabel(item);
          return (
            <li
              key={item.skill.id}
              data-source={item.source}
              className={
                item.source === "prerequisite" ? undefined : "is-connection"
              }
            >
              <Link
                to="/pathways/$skillId"
                params={{ skillId: item.skill.id }}
                search={linkSearch}
                onClick={onNavigate}
              >
                {item.skill.title}
                <small>
                  {bandLabel(item.skill.gradeBand)}
                  {label &&
                    ` · ${label}${group === "builds-on" && item.connection ? " · Not required" : ""}`}
                </small>
                {item.connection && (
                  <small className="pathways-connection-why">
                    {item.connection.explanation}
                  </small>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > visible && (
        <button
          type="button"
          className="pathways-show-all"
          aria-expanded={all}
          aria-controls={listId}
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${items.length}`}
          {!all && more > 0 && <small> (+{more})</small>}
        </button>
      )}
    </div>
  );
}
