/** jsdom has no CSS.registerProperty; Colorful's support check needs it. */
const css = (globalThis as { CSS?: object }).CSS ?? {};
(globalThis as { CSS?: object }).CSS = {
  ...css,
  registerProperty: () => {},
  supports: () => true,
};
