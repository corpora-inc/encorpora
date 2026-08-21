/**
 * The one error a generator family throws when a validated parameter set turns out
 * to admit no item.
 *
 * `gen.arith.column-op` declares its own `InfeasibleParamsError` for the same
 * purpose. It is not re-used here on purpose: that class is exported from the
 * column-op family module and is part of that family's published surface, and a
 * second family importing it would make every later family depend on the first one
 * that happened to need an error class. This is the shared one; column-op keeps its
 * own name for compatibility with the app code that already catches it.
 */

/** A validated parameter set that no draw can satisfy. Always a bug, never input. */
export class InfeasibleLevelError extends Error {}
