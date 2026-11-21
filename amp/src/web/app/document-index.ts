/** Analytics-visible auth and purchase screens are deliberately not indexable. */
export const publicDocumentPaths = [
  "/",
  "/schools",
  "/schools/trust",
  "/schools/scope-and-sequence",
  "/research",
  "/research/pilot",
] as const;
export const indexableDocumentPath = (path: string) => {
  const clean = path.replace(/\/$/, "") || "/";
  return (
    (publicDocumentPaths as readonly string[]).includes(clean) ||
    // The skill map and the comparisons, each with its pages. A comparison's
    // document exists only for a real one: the server answers any other slug
    // with the 404 page (docker/nginx.conf).
    /^\/(?:pathways|versus)(?:\/[^/]+)?$/.test(clean)
  );
};
