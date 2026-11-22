import { notFound } from "@tanstack/react-router";
import { loadVersusPage } from "../../../versus/pages";

/** The route's loader (`/versus/{-$slug}`): nothing for the hub, the
 * comparison's words for a slug, and the router's not-found for a slug with
 * no comparison. It lives with the screens, so the app's entry carries one
 * line for it (scripts/check-bundle-budget.ts). */
export async function loadComparison(slug: string | undefined) {
  if (!slug) return null;
  const page = await loadVersusPage(slug);
  if (!page) throw notFound();
  return page;
}
