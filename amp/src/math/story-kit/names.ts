// Shared learner-facing first names for word problems. Copy this file
// verbatim into src/math/story-kit/names.ts; do not edit it per branch.
// Short, easy to read aloud, from many cultures, no repeats, no
// real-person or brand references. RNG-agnostic: pass an index picker.

export const storyNames = [
  "Ava", "Ben", "Chloe", "Dev", "Elena", "Femi", "Gia", "Hiro", "Isla", "Jamal",
  "Kai", "Lena", "Mateo", "Nia", "Omar", "Priya", "Quinn", "Rosa", "Sam", "Tariq",
  "Uma", "Vik", "Wren", "Xavi", "Yara", "Zane", "Amara", "Bo", "Carmen", "Diego",
  "Eli", "Fatima", "Grace", "Hassan", "Ines", "Jonah", "Kemi", "Liam", "Maya", "Noah",
  "Olu", "Pablo", "Rina", "Sofia", "Theo", "Ari", "Leila", "Malik", "Nora", "Ravi",
] as const;

/** `pickIndex(n)` must return an integer in [0, n). */
export function storyName(pickIndex: (n: number) => number): string {
  return storyNames[pickIndex(storyNames.length)]!;
}

/** `count` different names, in draw order. */
export function storyNameSet(
  pickIndex: (n: number) => number,
  count: number,
): string[] {
  const pool = [...storyNames];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++)
    out.push(pool.splice(pickIndex(pool.length), 1)[0]!);
  return out;
}
