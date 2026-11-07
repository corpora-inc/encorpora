import { JOIN_CODE_LENGTH } from "../../../../schools/contracts";
import styles from "./CodeTiles.module.css";

/** A class code as six tiles. The board and a student's screen draw the same
 * object, so a child matches shapes rather than reading a string. Size comes
 * from `--tile`. */
export function CodeTiles({
  code,
  active,
  solid = false,
}: {
  code: string;
  /** The tile the next letter lands on. */
  active?: number;
  /** Letters out of the page's strongest color: the board. */
  solid?: boolean;
}) {
  return (
    <span className={styles.tiles} data-solid={solid || undefined}>
      {Array.from({ length: JOIN_CODE_LENGTH }, (_, index) => (
        <span
          key={index}
          className={styles.tile}
          data-active={index === active || undefined}
          data-filled={!!code[index] || undefined}
          data-group={index === JOIN_CODE_LENGTH / 2 || undefined}
        >
          {code[index] ?? ""}
        </span>
      ))}
    </span>
  );
}
