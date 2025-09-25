// src/components/StacksManager.utils.ts
export function nextCopyName(base: string, existing: string[]): string {
  // If "Romance" exists → "Romance 2", then "Romance 3", etc.
  const regex = new RegExp(`^${escapeRegExp(base)}(?:\\s(\\d+))?$`);
  const nums = existing
    .map((n) => {
      const m = n.match(regex);
      return m ? Number(m[1] || 1) : null;
    })
    .filter((x): x is number => x !== null);
  const max = nums.length ? Math.max(...nums) : 1;
  return `${base} ${max + 1}`;
}

function escapeRegExp(s: string) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
