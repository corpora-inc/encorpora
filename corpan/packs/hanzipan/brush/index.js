/**
 * Brush Configuration Module for Hanzipan
 * Professional brush settings widget with persistence and presets.
 *
 * Usage in other packs:
 *
 * import { BrushConfigWidget, BrushStore, BUILTIN_PRESETS } from '../hanzipan/brush';
 *
 * const store = new BrushStore('my-pack-brush-v1');
 * const widget = new BrushConfigWidget({
 *   container: document.body,
 *   store,
 *   onConfigChange: (config) => { ... }
 * });
 */

export { BrushStore } from './BrushStore.js';
export { BrushConfigWidget } from './BrushConfigWidget.js';
export { PressureCurveCanvas } from './PressureCurveCanvas.js';
export { StrokePreviewCanvas } from './StrokePreviewCanvas.js';
export {
  BUILTIN_PRESETS,
  CURVE_PRESETS,
  getPresetById,
  getAllPresets,
} from './presets.js';
