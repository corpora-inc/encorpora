import { NameEditor } from "./NameEditor";
import styles from "./YourName.module.css";

/**
 * The adult's own name, in Account (R9, R12): its section, and the shared
 * editor (NameEditor) that a family's People composes too.
 */
export function YourName() {
  return (
    <section className={styles.section} aria-labelledby="account-your-name">
      <h2 id="account-your-name" className={styles.title}>
        Your name
      </h2>
      <NameEditor />
    </section>
  );
}
