/**
 * The 3D map paints its canvas textures with the atlas role tokens
 * (ui/tokens.css). A role reads from the map's own element first, then from
 * the document root where the tokens live, so a detached or unstyled element
 * never yields an empty color.
 */
export function paintRoles(
  element: Element,
  root: Element = document.documentElement,
) {
  const own = getComputedStyle(element);
  const shared = getComputedStyle(root);
  return (role: string) =>
    own.getPropertyValue(role).trim() || shared.getPropertyValue(role).trim();
}

/** A canvas throws a SyntaxError for a color it can't parse, and the 3D map's
 * effect would take the whole Pathways screen down with it (production,
 * 2026-11-12: 14 crashes). A stop that can't be read costs the glow that
 * stop, never the screen; it is logged so it still gets fixed. */
export function addColorStops(
  gradient: Pick<CanvasGradient, "addColorStop">,
  stops: readonly (readonly [offset: number, role: string])[],
  paint: (role: string) => string,
) {
  for (const [offset, role] of stops) {
    const color = paint(role);
    try {
      gradient.addColorStop(offset, color);
    } catch (error) {
      console.warn(
        `Pathways map: ${role} is not a canvas color (${JSON.stringify(color)}); its glow stop is left out.`,
        error,
      );
    }
  }
}
