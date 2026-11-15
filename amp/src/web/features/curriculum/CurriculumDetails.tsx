import { createContext, useContext, type ReactNode } from "react";
import { isStudentDevice } from "../../lib/student-device";
import { useCurriculumScope } from "./useCurriculumScope";

const Details = createContext({
  shown: true,
  ready: false,
  scope: "guest",
});
/**
 * Whether grade names and numbers show. Grown-ups' views always show them.
 * A child's own session (practice, their levels, their Pathways) follows
 * what `/me` says for them (`me.school.levels`): hidden when a grown-up
 * switched "Show grade level" off on their settings, or their school hides
 * levels (schools/student-me.ts `studentLevels`). Display only: never a
 * learning setting. Until a student device's `/me` answers, hidden.
 */
export function CurriculumDetailsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    scope,
    ready,
    levels = isStudentDevice() ? "hidden" : "shown",
  } = useCurriculumScope();
  return (
    <Details.Provider value={{ shown: levels !== "hidden", ready, scope }}>
      {children}
    </Details.Provider>
  );
}
export const useCurriculumDetails = () => useContext(Details);
/** Grade numbers shown or hidden by the caller: the component gallery
 * (`features/design`) shows both. */
export function CurriculumDetailsFixture({
  shown,
  children,
}: {
  shown: boolean;
  children: ReactNode;
}) {
  return (
    <Details.Provider value={{ shown, ready: true, scope: "design" }}>
      {children}
    </Details.Provider>
  );
}
