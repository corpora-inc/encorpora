import { WaveMark } from "../../ui/NavigationSheet";
import styles from "./SchoolFrame.module.css";

export type SchoolCrumb = { label: string; path?: string };

/** The wordmark. `for` names the product line beside it; an adult's own
 * practice is plain AMP. */
export function Brand({ for: line = "for Schools" }: { for?: string | null }) {
  return (
    <span className={styles.brand}>
      <WaveMark />
      <span className={styles.brandName}>AMP</span>
      {line && <span className={styles.brandFor}>{line}</span>}
    </span>
  );
}
