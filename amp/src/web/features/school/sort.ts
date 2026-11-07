const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});

/** Class names as a school reads them: Kindergarten before Grade 1, Grade 2
 * before Grade 10, Period 2 before Period 10. */
export function compareClassNames(a: string, b: string) {
  const rank = (name: string) =>
    /^(pre-?k|pre-?kindergarten)\b/i.test(name)
      ? 0
      : /^(k|kindergarten)\b/i.test(name)
        ? 1
        : 2;
  return rank(a) - rank(b) || collator.compare(a, b);
}
