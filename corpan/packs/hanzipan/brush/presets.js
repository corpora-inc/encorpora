/**
 * Built-in brush presets for Hanzipan
 * Each preset is optimized for different writing styles.
 */

export const BUILTIN_PRESETS = [
  {
    id: 'default',
    name: 'Default',
    isBuiltIn: true,
    baseWidthMultiplier: 1.0,
    minWidthFactor: 0.5,
    maxWidthFactor: 1.6,
    pressureInfluence: 0.55,
    pressureExponent: 0.75,
    pressureCurve: [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 }
    ],
    velocityInfluence: 0.5,
    velocityRange: 2.0,
    velocityInverted: false,
    positionSmoothing: 0.2,
    velocitySmoothing: 0.25,
    widthSmoothing: 0.3,
    startTaperDistance: 1.8,
    startTaperMin: 0.35,
    endTaperPoints: 6,
    endTaperStrength: 0.5,
    dwellDelayMs: 120,
    dwellGrowthRate: 0.7,
    dwellMaxFactor: 2.2,
  },
  {
    id: 'calligraphy',
    name: 'Calligraphy',
    isBuiltIn: true,
    baseWidthMultiplier: 1.3,
    minWidthFactor: 0.35,
    maxWidthFactor: 2.0,
    pressureInfluence: 0.75,
    pressureExponent: 0.6,
    pressureCurve: [
      { x: 0.15, y: 0.35 },
      { x: 0.85, y: 0.65 }
    ],
    velocityInfluence: 0.6,
    velocityRange: 2.5,
    velocityInverted: false,
    positionSmoothing: 0.15,
    velocitySmoothing: 0.2,
    widthSmoothing: 0.25,
    startTaperDistance: 2.2,
    startTaperMin: 0.25,
    endTaperPoints: 8,
    endTaperStrength: 0.65,
    dwellDelayMs: 100,
    dwellGrowthRate: 0.9,
    dwellMaxFactor: 2.5,
  },
  {
    id: 'bold',
    name: 'Bold',
    isBuiltIn: true,
    baseWidthMultiplier: 1.5,
    minWidthFactor: 0.6,
    maxWidthFactor: 1.4,
    pressureInfluence: 0.4,
    pressureExponent: 0.85,
    pressureCurve: [
      { x: 0.3, y: 0.2 },
      { x: 0.7, y: 0.8 }
    ],
    velocityInfluence: 0.35,
    velocityRange: 1.8,
    velocityInverted: false,
    positionSmoothing: 0.25,
    velocitySmoothing: 0.3,
    widthSmoothing: 0.35,
    startTaperDistance: 1.5,
    startTaperMin: 0.45,
    endTaperPoints: 4,
    endTaperStrength: 0.4,
    dwellDelayMs: 150,
    dwellGrowthRate: 0.5,
    dwellMaxFactor: 1.8,
  },
  {
    id: 'precise',
    name: 'Precise',
    isBuiltIn: true,
    baseWidthMultiplier: 0.8,
    minWidthFactor: 0.7,
    maxWidthFactor: 1.3,
    pressureInfluence: 0.3,
    pressureExponent: 0.9,
    pressureCurve: [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 }
    ],
    velocityInfluence: 0.2,
    velocityRange: 1.5,
    velocityInverted: false,
    positionSmoothing: 0.4,
    velocitySmoothing: 0.4,
    widthSmoothing: 0.45,
    startTaperDistance: 1.2,
    startTaperMin: 0.5,
    endTaperPoints: 5,
    endTaperStrength: 0.35,
    dwellDelayMs: 180,
    dwellGrowthRate: 0.4,
    dwellMaxFactor: 1.6,
  },
  {
    id: 'pencil',
    name: 'Pencil',
    isBuiltIn: true,
    baseWidthMultiplier: 0.6,
    minWidthFactor: 0.8,
    maxWidthFactor: 1.2,
    pressureInfluence: 0.2,
    pressureExponent: 1.0,
    pressureCurve: [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 }
    ],
    velocityInfluence: 0.1,
    velocityRange: 1.2,
    velocityInverted: false,
    positionSmoothing: 0.1,
    velocitySmoothing: 0.1,
    widthSmoothing: 0.15,
    startTaperDistance: 0.8,
    startTaperMin: 0.6,
    endTaperPoints: 3,
    endTaperStrength: 0.25,
    dwellDelayMs: 200,
    dwellGrowthRate: 0.3,
    dwellMaxFactor: 1.4,
  },
];

// Pressure curve presets for the bezier editor
export const CURVE_PRESETS = {
  linear: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 }
  ],
  soft: [
    { x: 0.15, y: 0.35 },
    { x: 0.85, y: 0.65 }
  ],
  firm: [
    { x: 0.35, y: 0.15 },
    { x: 0.65, y: 0.85 }
  ],
  sCurve: [
    { x: 0.4, y: 0.0 },
    { x: 0.6, y: 1.0 }
  ],
};

export function getPresetById(id) {
  return BUILTIN_PRESETS.find(p => p.id === id) || null;
}

export function getAllPresets(userPresets = []) {
  return [...BUILTIN_PRESETS, ...userPresets];
}

export default BUILTIN_PRESETS;
