import { Loading } from "../../ui/Loading";
import styles from "./LessonWait.module.css";

/** A lesson's wait, as a layer: the wave centred in the space the lesson
 * will fill (the whole sheet on a phone), so it lands without a jump. */
export function LessonWait() {
  return (
    <div className={styles.wait} data-layer-wait="">
      <Loading>Loading lesson…</Loading>
    </div>
  );
}
