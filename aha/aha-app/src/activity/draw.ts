/**
 * The drawing IR: what the figure renderers draw. It is the v1 `Figure` union (spec.ts) plus fields
 * only the app writes, never the v1 wire schema (Activity Spec v2 README §5.1):
 *
 * - `geometry.grid: {unit}` draws graph paper, and a polygon's `unitSquares` tiles it with unit
 *   squares so its area can be counted.
 * - A `picture` group names any object (`icon`, resolved by render/icons.tsx with a neutral counter
 *   as the fallback), may stand for `repeat` identical groups (equal groups stated once), and may
 *   highlight its first `shaded` icons (a set fraction).
 * - `array_grid` names any object as its icon.
 *
 * Every v1 figure is a drawing as it is, so v1 activities render unchanged. v2 lowers its structures
 * to drawings and never reaches the v1 wire schema.
 */
import type { Figure, FigureOf, GeometryShapeSpec } from './spec';
import { FigureSchema, ICON_NAMES, figureProblems } from './spec';

type PolygonShape = Extract<GeometryShapeSpec, { kind: 'polygon' }>;
export type DrawShape = Exclude<GeometryShapeSpec, { kind: 'polygon' }> | (PolygonShape & { unitSquares?: boolean });
export type DrawGeometry = Omit<FigureOf<'geometry'>, 'shapes'> & { shapes: DrawShape[]; grid?: { unit: number } };
type PictureGroup = FigureOf<'picture'>['groups'][number];
export type DrawPictureGroup = Omit<PictureGroup, 'icon'> & { icon: string; repeat?: number; shaded?: number };
export type DrawPicture = Omit<FigureOf<'picture'>, 'groups'> & { groups: DrawPictureGroup[] };
export type DrawArrayGrid = Omit<FigureOf<'array_grid'>, 'icon'> & { icon?: string };
export type DrawFigure = Exclude<Figure, { type: 'geometry' | 'picture' | 'array_grid' }> | DrawGeometry | DrawPicture | DrawArrayGrid;
export type DrawFigureType = DrawFigure['type'];
export type DrawFigureOf<T extends DrawFigureType> = Extract<DrawFigure, { type: T }>;

/** The groups a picture draws, in order: a group with `repeat: n` is n identical groups. */
export function pictureGroups(figure: DrawPicture): DrawPictureGroup[] {
  return figure.groups.flatMap(g => Array.from({ length: g.repeat ?? 1 }, () => g));
}

/** Graph paper may have at most this many lines across, and unit squares tile at most this many units. */
export const MAX_GRID_LINES = 50;
export const MAX_PICTURE_GROUPS = 12;

/**
 * Problems with a drawing: v1's figure schema and invariants on the drawing with its IR-only fields
 * removed, plus the IR-only fields' own rules. Lowering is app code, so a problem here is an app bug or a
 * model whose magnitudes do not fit a drawing (an L2 rejection), never something to repair.
 */
export function drawingProblems(f: DrawFigure): string[] {
  const problems: string[] = [];
  // `plain` is the drawing as a v1 figure for v1's semantic invariants; `shape` is what v1's zod schema
  // sees (a repeated group counted once), for v1's structural limits: part, tick, label and list caps.
  let plain: Figure;
  let shape: unknown;
  switch (f.type) {
    case 'geometry': {
      const u = f.grid?.unit ?? 1;
      if (f.grid && (!(u > 0) || f.width / u > MAX_GRID_LINES || f.height / u > MAX_GRID_LINES)) problems.push(`grid has more than ${MAX_GRID_LINES} lines across.`);
      const onLattice = (v: number) => Math.abs(v / u - Math.round(v / u)) < 1e-9;
      f.shapes.forEach((s, i) => {
        if (s.kind !== 'polygon' || !s.unitSquares) return;
        if (f.width / u > MAX_GRID_LINES || f.height / u > MAX_GRID_LINES) problems.push(`shapes[${i}]: too many unit squares.`);
        else if (s.points.some(p => !onLattice(p.x) || !onLattice(p.y))) problems.push(`shapes[${i}]: unit squares need every vertex on a whole number of grid units.`);
      });
      const { grid: _grid, ...rest } = f;
      plain = { ...rest, shapes: f.shapes.map(s => { if (s.kind !== 'polygon') return s; const { unitSquares: _u, ...p } = s; return p; }) };
      shape = plain;
      break;
    }
    case 'picture': {
      const groups = pictureGroups(f);
      if (groups.length > MAX_PICTURE_GROUPS) problems.push(`at most ${MAX_PICTURE_GROUPS} groups drawn in total.`);
      if (f.groups.some(g => (g.repeat ?? 1) > 1 && (g.crossedOut || g.id || g.shaded))) problems.push('a repeated group cannot carry crossedOut, shaded or an id.');
      if (f.groups.some(g => (g.shaded ?? 0) > g.count || (g.shaded ?? 0) < 0)) problems.push('shaded exceeds count.');
      // v1's invariants on the expanded groups; any icon name stands in for the model-named object.
      plain = { ...f, groups: groups.map(({ repeat: _r, shaded: _s, ...g }) => ({ ...g, icon: ICON_NAMES[0] })) };
      shape = { ...f, groups: f.groups.map(({ repeat: _r, shaded: _s, ...g }) => ({ ...g, icon: ICON_NAMES[0] })) };
      break;
    }
    case 'array_grid': {
      const { icon, ...rest } = f;
      plain = { ...rest, ...(icon ? { icon: ICON_NAMES[0] } : {}) };
      shape = plain;
      break;
    }
    default:
      plain = f;
      shape = f;
  }
  const parsed = FigureSchema.safeParse(shape);
  if (!parsed.success) problems.push(...parsed.error.issues.slice(0, 5).map(i => `${i.path.join('.') || f.type}: ${i.message}`));
  return [...problems, ...figureProblems(plain)];
}
