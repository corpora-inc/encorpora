import { brand } from "../../brand";
import { WaveMark } from "./WaveMark";
import styles from "./BrandMark.module.css";

/** The public pages' brand: the wave, "AMP", and its full name where the
 * header has room. The caller's link carries the place and the label.
 * `beside` is the header's other control: a longer one ("Schools") needs the
 * name to give way on a slightly wider phone than "Sign in" does. */
export function BrandMark({ beside = "short" }: { beside?: "short" | "long" }) {
  return (
    <>
      <WaveMark className={styles.wave} />
      <span className={styles.wordmark}>{brand.name}</span>{" "}
      <span
        className={`${styles.expansion} ${beside === "long" ? styles.besideLong : ""}`}
      >
        {brand.expansion}
      </span>
    </>
  );
}
