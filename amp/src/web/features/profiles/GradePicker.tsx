import {
  gradeShort,
  gradeTitle,
  profileGrades,
} from "../../../learning/practice-profiles";
import { TileChoice } from "../../ui/TileChoice";

/** Grades K to 12, one tap each, as the shared tile grid (ui/TileChoice):
 * seven to a row (five under 360 px, for 44 px targets), the arrow keys moving along the grade axis. */
export function GradePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (grade: number) => void;
  disabled?: boolean;
}) {
  return (
    <TileChoice
      label="Grade"
      tiles={profileGrades.map((grade) => ({
        value: grade,
        label: gradeShort(grade),
        name: gradeTitle(grade),
      }))}
      value={value}
      onChange={(grade) => grade !== null && onChange(grade)}
      columns={{ narrow: 7, wide: 7, tiny: 5 }}
      disabled={disabled}
    />
  );
}
