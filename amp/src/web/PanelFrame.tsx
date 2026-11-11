/** The outline of one lettered panel in a figure drawn by its own view box:
 * invisible, it tells a screen where the panel lies, so a choice that names
 * the panel can be made by tapping it (FigurePanelChoice). Scene figures
 * mark their cells the same way (`data-panel-frame`). */
export function PanelFrame({
  label,
  x,
  y,
  width,
  height,
}: {
  label: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  if (!label) return null;
  return (
    <rect
      data-panel-frame={label}
      x={x}
      y={y}
      width={width}
      height={height}
      fill="none"
      stroke="none"
      pointerEvents="none"
    />
  );
}
