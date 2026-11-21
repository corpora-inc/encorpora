import { notFound } from "@tanstack/react-router";
import { loadVersusPage } from "../../../versus/pages";

/** The route's loader for `/versus/<slug>`: the comparison's words, or the
 * router's not-found for a slug with none. It lives with the screens, so
 * the app's entry carries one line for it (scripts/check-bundle-budget.ts). */
export async function loadComparison(slug: string) {
  const page = await loadVersusPage(slug);
  if (!page) throw notFound();
  return page;
}
