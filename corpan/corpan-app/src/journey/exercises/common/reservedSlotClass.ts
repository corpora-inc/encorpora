// src/journey/exercises/common/reservedSlotClass.ts — the pure class-name half
// of the no-reflow ReservedSlot (see ReservedSlot.tsx for the full invariant
// doc). Split out of the .tsx so the "space is always reserved" guarantee is
// unit-testable under the strip-types runner (which can't import JSX).

/**
 * The className for a reserved slot. It ALWAYS carries a `min-h-*` utility, so
 * the slot occupies space regardless of whether it currently has children —
 * that fixed floor is the whole point of the invariant.
 */
export function reservedSlotClass(minH = "min-h-8", className = ""): string {
  return ["flex w-full flex-col items-center justify-center", minH, className]
    .filter(Boolean)
    .join(" ")
}
