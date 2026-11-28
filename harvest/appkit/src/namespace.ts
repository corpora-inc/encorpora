/**
 * Every key an app keeps on the device starts with its namespace ("crane.",
 * "maint."), so two apps served from one origin never read each other's data.
 * Each app sets it once, first thing in main.tsx.
 */
let ns = "app.";

export function setNamespace(prefix: string): void {
  ns = prefix.endsWith(".") ? prefix : `${prefix}.`;
}

export function namespace(): string {
  return ns;
}
