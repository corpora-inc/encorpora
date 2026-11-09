import type {
  StackSet,
  StackView,
} from "../../../../schools/classroom-contracts";

/** A stored workbook is identified by date, number and length, independently
 * of its original focus. New issuance uses the separate workbook allowance. */
export function printableStudents(
  students: StackView["students"],
  sets: StackSet[],
  date: string,
  number: number,
  minutes: number,
) {
  const issued = new Set(
    sets
      .filter(
        (set) =>
          set.date === date && set.number === number && set.minutes === minutes,
      )
      .flatMap((set) => set.studentIds ?? []),
  );
  return students.filter(
    (student) =>
      (student.canMakeWorkbook ?? student.seated) ||
      (issued.has(student.id) && (student.canReadWorkbooks ?? student.seated)),
  );
}

/** Out of new workbooks: no seat or grant, and the five free ones are used.
 * Issued ones stay printable and markable. */
export const freeWorkbooksUsed = (student: StackView["students"][number]) =>
  !student.seated &&
  student.canReadWorkbooks !== false &&
  student.canMakeWorkbook === false &&
  student.freeAllowance?.workbooks.available === 0;
