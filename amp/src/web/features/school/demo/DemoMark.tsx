import styles from "./Demo.module.css";

/** The quiet "Demo" label beside a demo place's name: made-up students,
 * there to explore. A label, never a banner. */
export function DemoMark() {
  return (
    <span className={styles.mark} data-demo-mark>
      Demo
    </span>
  );
}
