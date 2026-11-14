/** "Pip", "Pip and Wren", "Pip, Wren and Theo". */
export const nameList = (names: readonly string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/**
 * Whom the family's practice defaults govern: the children in the family's
 * own class, and each child added to it. A child of the family's who
 * practises in another family's group has that group's settings, and the
 * line says so by name; a save here never changes theirs.
 */
export function practiceScopeLine(
  inClass: readonly string[],
  elsewhere: readonly string[],
): string {
  if (!elsewhere.length)
    return "For every child in the family, and each child you add. The math is the same either way.";
  const theirs =
    elsewhere.length === 1
      ? `${elsewhere[0]} practices in another group, which sets theirs.`
      : `${nameList(elsewhere)} practice in other groups, which set theirs.`;
  const here = inClass.length
    ? `For ${nameList(inClass)}, and each child you add.`
    : "For each child you add to your family’s class.";
  return `${here} ${theirs}`;
}
