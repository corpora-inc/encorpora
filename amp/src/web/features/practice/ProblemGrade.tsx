import type { GradeBand } from "../../../curriculum/types";
import { gradeNumber } from "../../../learning/frontier";
import { shortGrade } from "../../ui/level-range/scale";
import { useCurriculumDetails } from "../curriculum/CurriculumDetails";
import { bandLabel } from "../pathways/model";
import { useGradeStep } from "./problem-grade";

/**
 * The problem's curriculum grade before its skill title ("Gr 6"), with the
 * way practice moved in its area since the last problem there: a step up
 * or a step back, from the grades of the problems the engine chose. Hidden
 * wherever grades are (a child's session with grade levels off).
 */
export function ProblemGrade({
  learnerId,
  strand,
  problemId,
  band,
}: {
  learnerId: string;
  strand: string;
  problemId: string;
  band: string | undefined;
}) {
  const { shown } = useCurriculumDetails();
  const grade =
    band && band in gradeNumber ? gradeNumber[band as GradeBand] : null;
  const step = useGradeStep(learnerId, strand, problemId, grade);
  if (!shown || grade === null) return null;
  return (
    <span
      className="problem-grade"
      data-problem-grade={grade}
      data-step={step ?? undefined}
    >
      <span aria-hidden="true">
        {shortGrade(grade)}
        {step && (
          <span className="problem-grade-step">
            {step === "up" ? "↑" : "↓"}
          </span>
        )}
      </span>
      <span className="sr-only">
        {bandLabel(band!)}
        {step === "up" ? ", a step up" : step === "down" ? ", a step back" : ""}
        {": "}
      </span>
    </span>
  );
}
