/** Analytics-visible auth and purchase screens are deliberately not indexable. */
export const publicDocumentPaths = [
  "/",
  "/schools",
  "/schools/trust",
  "/schools/scope-and-sequence",
] as const;
export const indexableDocumentPath = (path: string) => {
  const clean = path.replace(/\/$/, "") || "/";
  return (
    (publicDocumentPaths as readonly string[]).includes(clean) ||
    /^\/pathways(?:\/[^/]+)?$/.test(clean)
  );
};
