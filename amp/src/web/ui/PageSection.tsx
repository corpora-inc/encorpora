import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import styles from "./PageSection.module.css";

/**
 * One section of a page, in Billing's rhythm: an optional heading (the
 * page's one section heading style) with an optional action at its right,
 * then the section's content 16 px under it. Sections sit apart by the
 * Page's section gap. A titled section is labelled by its heading; an
 * untitled one passes its own `aria-label`. `className` styles the
 * section's content stack, never its width.
 */
export function PageSection({
  title,
  actions,
  className,
  children,
  ...section
}: Omit<ComponentPropsWithoutRef<"section">, "style" | "title"> & {
  title?: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={title ? id : undefined}
      {...section}
      className={className ? `${styles.section} ${className}` : styles.section}
    >
      {title && (
        <div className={styles.head}>
          <h2 id={id} className={styles.title}>
            {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
