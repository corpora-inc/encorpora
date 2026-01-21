/**
 * BrushStore - Zustand-like store with localStorage persistence
 * Manages brush configuration with auto-save and subscription support.
 */

const DEFAULT_CONFIG = {
  id: 'default',
  name: 'Default',
  isBuiltIn: true,

  // Size
  baseWidthMultiplier: 1.0,
  minWidthFactor: 0.5,
  maxWidthFactor: 1.6,

  // Pressure
  pressureInfluence: 0.55,
  pressureExponent: 0.75,
  pressureCurve: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 }
  ],

  // Velocity
  velocityInfluence: 0.5,
  velocityRange: 2.0,
  velocityInverted: false,

  // Smoothing
  positionSmoothing: 0.2,
  velocitySmoothing: 0.25,
  widthSmoothing: 0.3,

  // Taper
  startTaperDistance: 1.8,
  startTaperMin: 0.35,
  endTaperPoints: 6,
  endTaperStrength: 0.5,

  // Dwell
  dwellDelayMs: 120,
  dwellGrowthRate: 0.7,
  dwellMaxFactor: 2.2,
};

export class BrushStore {
  constructor(storageKey = 'hanzipan-brush-v1') {
    this.storageKey = storageKey;
    this.listeners = new Set();
    this.config = { ...DEFAULT_CONFIG };
    this.userPresets = [];
    this.activePresetId = 'default';
    this._load();
  }

  _load() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.config && typeof data.config === 'object') {
          this.config = { ...DEFAULT_CONFIG, ...data.config };
        }
        if (Array.isArray(data.userPresets)) {
          this.userPresets = data.userPresets.filter(
            p => p && typeof p === 'object' && p.id && p.name
          );
        }
        if (typeof data.activePresetId === 'string') {
          this.activePresetId = data.activePresetId;
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  _save() {
    try {
      const data = {
        config: this.config,
        userPresets: this.userPresets,
        activePresetId: this.activePresetId,
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Ignore storage errors (private mode, quota exceeded)
    }
  }

  _notify() {
    const snapshot = this.getConfig();
    this.listeners.forEach(fn => {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn('[BrushStore] listener error', err);
      }
    });
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(partial) {
    this.config = { ...this.config, ...partial };
    this._save();
    this._notify();
  }

  resetToDefault() {
    this.config = { ...DEFAULT_CONFIG };
    this.activePresetId = 'default';
    this._save();
    this._notify();
  }

  getActivePresetId() {
    return this.activePresetId;
  }

  setActivePresetId(id) {
    this.activePresetId = id;
    this._save();
  }

  getUserPresets() {
    return [...this.userPresets];
  }

  savePreset(name) {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const preset = {
      ...this.config,
      id,
      name,
      isBuiltIn: false,
    };
    this.userPresets.push(preset);
    this.activePresetId = id;
    this._save();
    return preset;
  }

  loadPreset(presetConfig) {
    if (!presetConfig || typeof presetConfig !== 'object') return;
    this.config = { ...DEFAULT_CONFIG, ...presetConfig };
    this.activePresetId = presetConfig.id || 'custom';
    this._save();
    this._notify();
  }

  deletePreset(id) {
    const index = this.userPresets.findIndex(p => p.id === id);
    if (index === -1) return false;
    this.userPresets.splice(index, 1);
    if (this.activePresetId === id) {
      this.activePresetId = 'default';
      this.config = { ...DEFAULT_CONFIG };
    }
    this._save();
    this._notify();
    return true;
  }

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  static getDefaultConfig() {
    return { ...DEFAULT_CONFIG };
  }
}

export default BrushStore;
