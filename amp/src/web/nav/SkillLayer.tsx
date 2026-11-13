import { useQuery } from "@tanstack/react-query";
import { skillCatalogOptions } from "../lib/learning-view";
import { bandLabel } from "../features/pathways/model";
import { Loading } from "../ui/Loading";
import { Sheet } from "../ui/Sheet";
import { EntityLink } from "./links";
import styles from "./layers.module.css";

/** A skill of the curriculum, as a layer over any page: what it is, where
 * it sits, and its problem types, each opening its lesson over it. */
export function SkillLayer({
  skill,
  open,
  onClose,
}: {
  skill: string;
  open: boolean;
  onClose: () => void;
}) {
  const catalog = useQuery(skillCatalogOptions);
  const found = catalog.data?.skills.find((entry) => entry.id === skill);
  const types =
    catalog.data?.templates.filter((template) => template.skillId === skill) ??
    [];
  return (
    <Sheet
      open={open}
      tall
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={found?.title ?? "Skill"}
      description={found ? bandLabel(found.gradeBand) : undefined}
    >
      {!catalog.data ? (
        catalog.isError ? (
          <p role="alert">
            The skill didn’t load. Check your connection, then try again.
          </p>
        ) : (
          <Loading />
        )
      ) : !found ? (
        <p>This skill isn’t in the curriculum any more.</p>
      ) : (
        <div className={styles.layer} data-skill-layer={skill}>
          <p className={styles.lede}>{found.description}</p>
          {types.length > 0 && (
            <section>
              <h3 className={styles.heading}>
                {types.length === 1 ? "Problem type" : "Problem types"}
              </h3>
              <ul className={styles.rows}>
                {types.map((type) => (
                  <li key={type.id}>
                    <EntityLink
                      entity={{ kind: "lesson", id: type.id }}
                      className={styles.row}
                    >
                      <span>{type.title ?? "Its lesson"}</span>
                      <span className={styles.rowAction}>Lesson</span>
                    </EntityLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
