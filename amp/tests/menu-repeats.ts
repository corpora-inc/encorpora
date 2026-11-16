import type { SpaceDescriptor } from "../src/web/features/spaces/resolve.js";

/*
 * One feature, one entry (Q-3): a menu never offers the same feature twice,
 * under two names or two addresses. Some features answer at several
 * addresses; those route families are one feature here.
 */
const FAMILIES: readonly (readonly [RegExp, string])[] = [
  // Practice at a level: its hub (saved profiles), the level step, a new
  // profile and a profile's levels.
  [/^me\/(level|profiles)(\/|$)/, "practice at a level"],
];

/** The feature an address opens. */
export function featureOf(path: string) {
  const bare = path
    .replace(/[?#].*$/, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
  return FAMILIES.find(([family]) => family.test(bare))?.[1] ?? bare;
}

/** What a space's drawer and its tab row repeat: a feature, a name, or (in
 * the drawer) an icon. A family's children share their icon: each is its
 * own child. */
export function repeatsIn(space: SpaceDescriptor): string[] {
  const found: string[] = [];
  const lists = [
    ["drawer", space.destinations],
    ["tabs", space.tabs],
  ] as const;
  for (const [menu, items] of lists) {
    const seen = new Map<string, string>();
    const note = (key: string, label: string) => {
      const before = seen.get(key);
      if (before) found.push(`${menu}: "${before}" and "${label}" (${key})`);
      else seen.set(key, label);
    };
    for (const item of items as readonly {
      label: string;
      path: string;
      icon?: string;
    }[]) {
      note(`feature ${featureOf(item.path)}`, item.label);
      note(`name ${item.label.trim().toLowerCase()}`, item.label);
      if (item.icon && item.icon !== "child")
        note(`icon ${item.icon}`, item.label);
    }
  }
  return found;
}
