/** Browser-safe selection from public summaries; never imports authored books or answers. */
export function preferredBookForProblem<
  T extends { templates: readonly string[]; skills: readonly string[] },
>(
  books: readonly T[],
  problem: { templateId: string; skillId: string },
): T | undefined {
  return (
    books.find((book) => book.templates.includes(problem.templateId)) ??
    books.find((book) => book.skills.includes(problem.skillId))
  );
}
