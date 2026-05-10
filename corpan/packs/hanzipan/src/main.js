import "./styles.css"

;(() => {
  const GAME_ID = "hanzipan";

  const template = `
    <div class="hanzi-app">
      <button class="exit-btn" data-action="exit" aria-label="Exit">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
        </svg>
      </button>
      <div class="hero">
        <div class="card hero-card">
          <div class="hero-left">
            <button class="nav-btn nav-prev" data-nav="prev" data-action="prev" aria-label="Previous">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.5 5.5 9 12l6.5 6.5" />
              </svg>
            </button>
            <div class="char-symbol" data-char></div>
            <div class="char-row">
              <button class="pinyin-btn" data-pinyin data-action="speak" aria-label="Speak">
              </button>
            </div>
            <button class="nav-btn nav-next" data-nav="next" data-action="next" aria-label="Next">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8.5 5.5 15 12l-6.5 6.5" />
              </svg>
            </button>
          </div>
          <div class="hero-right">
            <div class="ety-text" data-etymology></div>
          </div>
        </div>
      </div>
      <div class="workspace">
        <div class="panel draw-panel">
          <div class="panel-toolbar">
            <div class="toolbar-left">
              <button class="icon-chip play-chip" data-action="replay" aria-label="Play">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8 6.5 18 12 8 17.5Z" fill="currentColor" stroke="none" />
                </svg>
              </button>
              <button class="icon-chip" data-action="brush-settings" aria-label="Brush settings">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 2l3 3-3 3M18 5H9a4 4 0 0 0 0 8h1M6 22l-3-3 3-3M6 19h9a4 4 0 0 0 0-8h-1" />
                </svg>
              </button>
            </div>
            <div class="toolbar-right">
              <button class="icon-chip" data-action="toggle-freedraw" data-freedraw-toggle aria-label="Free draw mode">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </button>
              <button class="icon-chip active" data-guided-toggle aria-label="Guided hints">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5zM8 13.5v3.2c0 .8 2.1 1.8 4 1.8s4-1 4-1.8v-3.2"
                  />
                </svg>
              </button>
              <button class="icon-chip" data-action="clear" aria-label="Clear">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
                </svg>
              </button>
            </div>
          </div>
          <div class="canvas-shell" data-canvas-shell>
            <canvas class="canvas-layer" data-ghost></canvas>
            <div class="writer-layer" data-writer></div>
            <canvas class="canvas-layer" data-draw></canvas>
            <canvas class="canvas-layer" data-fx></canvas>
            <div class="canvas-overlay" data-overlay>Loading...</div>
          </div>
          <div class="panel-footer">
            <div class="score-bar" data-score-bar>
              <div class="score-fill" data-score></div>
            </div>
            <div class="meta-row">
              <span class="chip chip-inline" data-strokes></span>
              <div class="meta-right">
                <span class="score-burst" data-score-burst aria-hidden="true"></span>
                <span class="total-score" data-total-score>0</span>
                <span class="meta-divider">•</span>
                <span class="complete-count" aria-label="Completed">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.5 12.5 10 18l9.5-12" />
                  </svg>
                  <span data-complete-count>0</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="panel examples-panel">
          <div class="panel-header">
            <div class="panel-count" data-example-count aria-label="Total phrases">—</div>
          </div>
          <div class="examples-list" data-examples></div>
          <div class="examples-footer" data-examples-footer>Ready</div>
        </div>
      </div>
    </div>
  `;

  const fallbackEntries = [
    {
      char: "一",
      pinyin: "yī",
      stroke_count: 1,
      radical: "一",
      strokes: ["M150 500 L850 500"],
      medians: [[[150, 500], [850, 500]]],
      etymology: "One. A single horizontal line representing unity.",
    },
    {
      char: "二",
      pinyin: "èr",
      stroke_count: 2,
      radical: "二",
      strokes: ["M200 380 L800 380", "M150 650 L850 650"],
      medians: [
        [[200, 380], [800, 380]],
        [[150, 650], [850, 650]],
      ],
      etymology: "Two. Two parallel lines indicating two.",
    },
    {
      char: "三",
      pinyin: "sān",
      stroke_count: 3,
      radical: "一",
      strokes: [
        "M220 300 L780 300",
        "M180 500 L820 500",
        "M160 720 L840 720",
      ],
      medians: [
        [[220, 300], [780, 300]],
        [[180, 500], [820, 500]],
        [[160, 720], [840, 720]],
      ],
      etymology: "Three. Three lines stacked to show three.",
    },
    {
      char: "人",
      pinyin: "rén",
      stroke_count: 2,
      radical: "人",
      strokes: ["M520 200 L300 820", "M520 200 L720 820"],
      medians: [
        [[520, 200], [300, 820]],
        [[520, 200], [720, 820]],
      ],
      etymology: "Person. A standing figure with two legs.",
    },
    {
      char: "口",
      pinyin: "kǒu",
      stroke_count: 4,
      radical: "口",
      strokes: [
        "M300 250 L300 750",
        "M300 250 L700 250",
        "M700 250 L700 750",
        "M300 750 L700 750",
      ],
      medians: [
        [[300, 250], [300, 750]],
        [[300, 250], [700, 250]],
        [[700, 250], [700, 750]],
        [[300, 750], [700, 750]],
      ],
      etymology: "Mouth. A square opening.",
    },
    {
      char: "日",
      pinyin: "rì",
      stroke_count: 5,
      radical: "日",
      strokes: [
        "M300 250 L300 750",
        "M300 250 L700 250",
        "M700 250 L700 750",
        "M300 500 L700 500",
        "M300 750 L700 750",
      ],
      medians: [
        [[300, 250], [300, 750]],
        [[300, 250], [700, 250]],
        [[700, 250], [700, 750]],
        [[300, 500], [700, 500]],
        [[300, 750], [700, 750]],
      ],
      etymology: "Sun. A round or square sun symbol.",
    },
    {
      char: "月",
      pinyin: "yuè",
      stroke_count: 6,
      radical: "月",
      strokes: [
        "M320 250 L320 800",
        "M320 250 L700 250",
        "M700 250 L700 520",
        "M320 520 L680 520",
        "M680 520 L680 800",
        "M320 800 L680 800",
      ],
      medians: [
        [[320, 250], [320, 800]],
        [[320, 250], [700, 250]],
        [[700, 250], [700, 520]],
        [[320, 520], [680, 520]],
        [[680, 520], [680, 800]],
        [[320, 800], [680, 800]],
      ],
      etymology: "Moon. A crescent shape.",
    },
    {
      char: "山",
      pinyin: "shān",
      stroke_count: 4,
      radical: "山",
      strokes: [
        "M300 250 L300 820",
        "M500 200 L500 860",
        "M700 250 L700 820",
        "M300 820 L700 820",
      ],
      medians: [
        [[300, 250], [300, 820]],
        [[500, 200], [500, 860]],
        [[700, 250], [700, 820]],
        [[300, 820], [700, 820]],
      ],
      etymology: "Mountain. Three peaks side by side.",
    },
    {
      char: "水",
      pinyin: "shuǐ",
      stroke_count: 4,
      radical: "水",
      strokes: [
        "M420 320 L380 380",
        "M580 320 L620 380",
        "M500 260 L500 780",
        "M500 520 L320 760",
      ],
      medians: [
        [[420, 320], [380, 380]],
        [[580, 320], [620, 380]],
        [[500, 260], [500, 780]],
        [[500, 520], [320, 760]],
      ],
      etymology: "Water. Flowing lines that suggest a current.",
    },
    {
      char: "木",
      pinyin: "mù",
      stroke_count: 4,
      radical: "木",
      strokes: [
        "M500 220 L500 820",
        "M300 450 L700 450",
        "M500 450 L320 760",
        "M500 450 L700 760",
      ],
      medians: [
        [[500, 220], [500, 820]],
        [[300, 450], [700, 450]],
        [[500, 450], [320, 760]],
        [[500, 450], [700, 760]],
      ],
      etymology: "Tree. A trunk with spreading branches.",
    },
  ];

  const fallbackCharacter = fallbackEntries[3];

  const fallbackStrokes = {
    strokes: fallbackCharacter.strokes,
    medians: fallbackCharacter.medians,
  };

  const fallbackEtymology = fallbackCharacter.etymology;
  const fallbackPinyinMap = fallbackEntries.reduce((acc, entry) => {
    acc[entry.char] = entry.pinyin;
    return acc;
  }, {});

  const unique = (items) => Array.from(new Set(items.filter(Boolean)));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const lerp = (a, b, t) => a + (b - a) * t;

  const lerpPoint = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  const distance = (a, b) => {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  };

  const resample = (points, count = 32) => {
    if (!points || points.length === 0) return [];
    if (points.length === 1) return Array(count).fill(points[0]);
    const dists = [];
    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
      const d = distance(points[i - 1], points[i]);
      dists.push(d);
      total += d;
    }
    const step = total / (count - 1);
    const out = [points[0]];
    let accumulated = 0;
    let target = step;
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const curr = points[i];
      const seg = dists[i - 1];
      if (seg === 0) continue;
      while (accumulated + seg >= target && out.length < count) {
        const t = (target - accumulated) / seg;
        out.push([prev[0] + (curr[0] - prev[0]) * t, prev[1] + (curr[1] - prev[1]) * t]);
        target += step;
      }
      accumulated += seg;
    }
    while (out.length < count) {
      out.push(points[points.length - 1]);
    }
    return out;
  };

  const distanceToSegment = (p, a, b) => {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return distance(p, a);
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const clamped = clamp(t, 0, 1);
    const proj = [ax + dx * clamped, ay + dy * clamped];
    return distance(p, proj);
  };

  const distanceToPolyline = (point, polyline) => {
    if (!polyline || polyline.length < 2) return 9999;
    let min = Infinity;
    for (let i = 1; i < polyline.length; i += 1) {
      const d = distanceToSegment(point, polyline[i - 1], polyline[i]);
      if (d < min) min = d;
    }
    return min;
  };

  const scoreStroke = (userPoints, median) => {
    if (!userPoints.length || !median || median.length < 2) return 0;
    const sampled = resample(userPoints, 32);
    const distances = sampled.map((pt) => distanceToPolyline(pt, median));
    const avg = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const tolerance = 140;
    return Math.round(clamp(1 - avg / tolerance, 0, 1) * 100);
  };

  const drawSmoothStroke = (ctx, points, toCanvas) => {
    if (!points || points.length < 2) return;
    ctx.beginPath();
    let [px, py] = toCanvas(points[0]);
    ctx.moveTo(px, py);
    for (let i = 1; i < points.length; i += 1) {
      const [cx, cy] = toCanvas(points[i]);
      const mx = (px + cx) / 2;
      const my = (py + cy) / 2;
      ctx.quadraticCurveTo(px, py, mx, my);
      px = cx;
      py = cy;
    }
    ctx.lineTo(px, py);
    ctx.stroke();
  };

  // Brush tuning constants - now dynamically synced from BrushStore
  const BRUSH = {
    baseWidthMultiplier: 1.0,
    minWidthFactor: 0.5,
    maxWidthFactor: 1.6,
    pressureInfluence: 0.55,
    pressureExponent: 0.75,
    pressureCurve: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
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
    minDistanceFactor: 0.3,
    dwellDelayMs: 120,
    dwellGrowthRate: 0.7,
    dwellMaxFactor: 2.2,
    dwellStepFactor: 0.02,
  };

  // Built-in brush presets
  const BUILTIN_PRESETS = [
    {
      id: 'default', name: 'Default', isBuiltIn: true,
      baseWidthMultiplier: 1.0, minWidthFactor: 0.5, maxWidthFactor: 1.6,
      pressureInfluence: 0.55, pressureExponent: 0.75,
      pressureCurve: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
      velocityInfluence: 0.5, velocityRange: 2.0, velocityInverted: false,
      positionSmoothing: 0.2, velocitySmoothing: 0.25, widthSmoothing: 0.3,
      startTaperDistance: 1.8, startTaperMin: 0.35, endTaperPoints: 6, endTaperStrength: 0.5,
      dwellDelayMs: 120, dwellGrowthRate: 0.7, dwellMaxFactor: 2.2,
    },
    {
      id: 'calligraphy', name: 'Calligraphy', isBuiltIn: true,
      baseWidthMultiplier: 1.3, minWidthFactor: 0.35, maxWidthFactor: 2.0,
      pressureInfluence: 0.75, pressureExponent: 0.6,
      pressureCurve: [{ x: 0.15, y: 0.35 }, { x: 0.85, y: 0.65 }],
      velocityInfluence: 0.6, velocityRange: 2.5, velocityInverted: false,
      positionSmoothing: 0.15, velocitySmoothing: 0.2, widthSmoothing: 0.25,
      startTaperDistance: 2.2, startTaperMin: 0.25, endTaperPoints: 8, endTaperStrength: 0.65,
      dwellDelayMs: 100, dwellGrowthRate: 0.9, dwellMaxFactor: 2.5,
    },
    {
      id: 'bold', name: 'Bold', isBuiltIn: true,
      baseWidthMultiplier: 1.5, minWidthFactor: 0.6, maxWidthFactor: 1.4,
      pressureInfluence: 0.4, pressureExponent: 0.85,
      pressureCurve: [{ x: 0.3, y: 0.2 }, { x: 0.7, y: 0.8 }],
      velocityInfluence: 0.35, velocityRange: 1.8, velocityInverted: false,
      positionSmoothing: 0.25, velocitySmoothing: 0.3, widthSmoothing: 0.35,
      startTaperDistance: 1.5, startTaperMin: 0.45, endTaperPoints: 4, endTaperStrength: 0.4,
      dwellDelayMs: 150, dwellGrowthRate: 0.5, dwellMaxFactor: 1.8,
    },
    {
      id: 'precise', name: 'Precise', isBuiltIn: true,
      baseWidthMultiplier: 0.8, minWidthFactor: 0.7, maxWidthFactor: 1.3,
      pressureInfluence: 0.3, pressureExponent: 0.9,
      pressureCurve: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
      velocityInfluence: 0.2, velocityRange: 1.5, velocityInverted: false,
      positionSmoothing: 0.4, velocitySmoothing: 0.4, widthSmoothing: 0.45,
      startTaperDistance: 1.2, startTaperMin: 0.5, endTaperPoints: 5, endTaperStrength: 0.35,
      dwellDelayMs: 180, dwellGrowthRate: 0.4, dwellMaxFactor: 1.6,
    },
    {
      id: 'pencil', name: 'Pencil', isBuiltIn: true,
      baseWidthMultiplier: 0.6, minWidthFactor: 0.8, maxWidthFactor: 1.2,
      pressureInfluence: 0.2, pressureExponent: 1.0,
      pressureCurve: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
      velocityInfluence: 0.1, velocityRange: 1.2, velocityInverted: false,
      positionSmoothing: 0.1, velocitySmoothing: 0.1, widthSmoothing: 0.15,
      startTaperDistance: 0.8, startTaperMin: 0.6, endTaperPoints: 3, endTaperStrength: 0.25,
      dwellDelayMs: 200, dwellGrowthRate: 0.3, dwellMaxFactor: 1.4,
    },
  ];

  const CURVE_PRESETS = {
    linear: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }],
    soft: [{ x: 0.15, y: 0.35 }, { x: 0.85, y: 0.65 }],
    firm: [{ x: 0.35, y: 0.15 }, { x: 0.65, y: 0.85 }],
    sCurve: [{ x: 0.4, y: 0.0 }, { x: 0.6, y: 1.0 }],
  };

  // Inline BrushStore for persistence
  // Stores customized values for all 5 presets, auto-saves on change
  class BrushStore {
    constructor(storageKey = 'hanzipan-brush-v1') {
      this.storageKey = storageKey;
      this.listeners = new Set();
      this.activePresetId = 'default';
      // Initialize all presets with built-in defaults
      this.presets = {};
      BUILTIN_PRESETS.forEach(p => {
        this.presets[p.id] = { ...p };
      });
      this._load();
    }
    _load() {
      try {
        const raw = window.localStorage.getItem(this.storageKey);
        if (!raw) return;
        const data = JSON.parse(raw);

        // Check schema version - if mismatch or missing, wipe and use defaults
        if (!data || typeof data !== 'object' || data.schemaVersion !== 2) {
          console.warn('[BrushStore] Schema mismatch, resetting to defaults');
          window.localStorage.removeItem(this.storageKey);
          return;
        }

        if (typeof data.activePresetId === 'string' && this.presets[data.activePresetId]) {
          this.activePresetId = data.activePresetId;
        }
        // Merge saved preset customizations
        if (data.presets && typeof data.presets === 'object') {
          Object.keys(this.presets).forEach(id => {
            if (data.presets[id]) {
              this.presets[id] = { ...this.presets[id], ...data.presets[id] };
            }
          });
        }
      } catch (e) {
        console.warn('[BrushStore] Failed to load, resetting:', e);
        window.localStorage.removeItem(this.storageKey);
      }
    }
    _save() {
      try {
        window.localStorage.setItem(this.storageKey, JSON.stringify({
          schemaVersion: 2,
          activePresetId: this.activePresetId,
          presets: this.presets,
        }));
      } catch { /* ignore */ }
    }
    _notify() {
      const snapshot = this.getConfig();
      this.listeners.forEach(fn => { try { fn(snapshot); } catch { /* ignore */ } });
    }
    getConfig() {
      return { ...this.presets[this.activePresetId] };
    }
    setConfig(partial) {
      this.presets[this.activePresetId] = { ...this.presets[this.activePresetId], ...partial };
      this._save();
      this._notify();
    }
    resetCurrentPreset() {
      // Reset only the current preset to its original built-in values
      const builtIn = BUILTIN_PRESETS.find(p => p.id === this.activePresetId);
      if (builtIn) {
        this.presets[this.activePresetId] = { ...builtIn };
        this._save();
        this._notify();
      }
    }
    getActivePresetId() { return this.activePresetId; }
    selectPreset(id) {
      if (this.presets[id]) {
        this.activePresetId = id;
        this._save();
        this._notify();
      }
    }
    getAllPresets() {
      return Object.values(this.presets);
    }
    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      this.listeners.add(fn);
      return () => { this.listeners.delete(fn); };
    }
  }

  // Sync BRUSH object from store config
  const syncBrushFromConfig = (config) => {
    Object.keys(BRUSH).forEach(key => {
      if (config[key] !== undefined) BRUSH[key] = config[key];
    });
  };

  const getPointerTime = (event) => {
    if (typeof event.timeStamp === "number" && event.timeStamp > 0) {
      return event.timeStamp;
    }
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
      return performance.now();
    }
    return Date.now();
  };

  const normalizePressure = (event) => {
    const raw = typeof event.pressure === "number" ? event.pressure : 0;
    if (raw > 0) {
      return clamp(raw, 0.05, 1);
    }
    if (event.pointerType === "mouse") {
      return 0.6;
    }
    if (event.pointerType === "pen") {
      return 0.55;
    }
    return 0.45;
  };

  const computeBrushWidth = (baseWidth, pressure, velocity) => {
    const pressureValue = Math.pow(clamp(pressure, 0, 1), BRUSH.pressureExponent);
    const pressureFactor = lerp(
      1 - BRUSH.pressureInfluence,
      1 + BRUSH.pressureInfluence,
      pressureValue
    );
    const velocityNorm = clamp(velocity / BRUSH.velocityRange, 0, 1);
    const speedFactor = BRUSH.velocityInverted ? velocityNorm : 1 - velocityNorm;
    const velocityFactor = lerp(1 - BRUSH.velocityInfluence, 1, speedFactor);
    const width = baseWidth * pressureFactor * velocityFactor;
    return clamp(width, baseWidth * BRUSH.minWidthFactor, baseWidth * BRUSH.maxWidthFactor);
  };

  const drawInkDot = (ctx, point, width) => {
    const radius = Math.max(0.4, width * 0.5);
    ctx.beginPath();
    ctx.arc(point[0], point[1], radius, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawInkSegment = (ctx, from, to, fromWidth, toWidth) => {
    const segmentLength = distance(from, to);
    if (segmentLength === 0) {
      drawInkDot(ctx, from, fromWidth);
      return;
    }
    const maxWidth = Math.max(fromWidth, toWidth, 1);
    const steps = Math.max(1, Math.round((segmentLength / maxWidth) * 0.6));
    let [px, py] = from;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const x = lerp(from[0], to[0], t);
      const y = lerp(from[1], to[1], t);
      const w = lerp(fromWidth, toWidth, t);
      ctx.lineWidth = Math.max(0.5, w);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x;
      py = y;
    }
  };

  const drawInkStroke = (ctx, stroke, toCanvas, baseWidth) => {
    if (!stroke || stroke.length === 0) return;
    if (stroke.length === 1) {
      const [x, y] = toCanvas(stroke[0].point);
      const width =
        (typeof stroke[0].width === "number" ? stroke[0].width : 0.6) * baseWidth;
      drawInkDot(ctx, [x, y], width);
      return;
    }
    let prev = stroke[0];
    for (let i = 1; i < stroke.length; i += 1) {
      const next = stroke[i];
      const [px, py] = toCanvas(prev.point);
      const [cx, cy] = toCanvas(next.point);
      const prevWidth =
        (typeof prev.width === "number" ? prev.width : 0.6) * baseWidth;
      const nextWidth =
        (typeof next.width === "number" ? next.width : 0.6) * baseWidth;
      drawInkSegment(ctx, [px, py], [cx, cy], prevWidth, nextWidth);
      prev = next;
    }
  };

  const applyEndTaper = (inkStroke) => {
    if (!inkStroke || inkStroke.length < 2) return;
    const count = Math.min(inkStroke.length, BRUSH.endTaperPoints);
    if (count < 2) return;
    for (let i = 0; i < count; i += 1) {
      const idx = inkStroke.length - count + i;
      const t = i / (count - 1);
      const fade = Math.max(0.05, 1 - t);
      inkStroke[idx].width *= fade;
    }
  };

  const computeCanvasPadding = (width, height) => Math.min(width, height) * 0.08;
  const REPLAY_STEP = 0.16;
  const REPLAY_DELAY_MS = 40;

  let hanziWriterPromise = null;
  const resolvePackBaseUrl = () => {
    const script =
      document.querySelector(`script[data-corp-game-id="${GAME_ID}"]`) ||
      document.currentScript;
    const dataset = script && script.dataset ? script.dataset : null;
    const baseAttr = dataset ? dataset.corpGameBaseUrl : "";
    if (baseAttr) {
      return baseAttr;
    }
    const srcAttr = dataset ? dataset.corpGameSrc : "";
    if (srcAttr) {
      return new URL(".", srcAttr).toString();
    }
    const src = script && script.src ? script.src : "";
    if (src) {
      return new URL(".", src).toString();
    }
    return window.location.href;
  };

  const ensureHanziWriter = () => {
    if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
    if (hanziWriterPromise) return hanziWriterPromise;
    const baseUrl = resolvePackBaseUrl();
    const scriptUrl = new URL("hanziwriter.min.js", baseUrl).toString();
    const getTauriInvoke = () => {
      const tauri = window.__TAURI__;
      if (!tauri) return null;
      return tauri.core && typeof tauri.core.invoke === "function"
        ? tauri.core.invoke.bind(tauri.core)
        : typeof tauri.invoke === "function"
          ? tauri.invoke.bind(tauri)
          : null;
    };
    const toCorpanPackUrl = (url) => {
      try {
        if (url.startsWith("corpan-pack://")) return url;
        const parsed = new URL(url);
        if (parsed.hostname === "corpan-pack.localhost") {
          return `corpan-pack://localhost${parsed.pathname}`;
        }
      } catch {
        // Ignore URL parse errors.
      }
      return url;
    };
    const loadInlineViaTauri = async () => {
      const invoke = getTauriInvoke();
      if (!invoke) return null;
      const packUrl = toCorpanPackUrl(scriptUrl);
      const text = await invoke("content_packs_fetch_text", { url: packUrl });
      if (!text) return null;
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.textContent = String(text);
      document.head.appendChild(script);
      return window.HanziWriter;
    };
    hanziWriterPromise = new Promise((resolve, reject) => {
      const loadViaScript = () => {
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve(window.HanziWriter);
        script.onerror = () => {
          reject(new Error("Failed to load HanziWriter"));
        };
        document.head.appendChild(script);
      };

      const prefersInline =
        baseUrl.startsWith("corpan-pack://") ||
        baseUrl.includes("corpan-pack.localhost");

      if (prefersInline) {
        loadInlineViaTauri()
          .then((inline) => {
            if (inline) {
              resolve(inline);
              return;
            }
            loadViaScript();
          })
          .catch(() => {
            loadViaScript();
          });
        return;
      }

      loadViaScript();
    });
    return hanziWriterPromise;
  };

  class HanziWriterLayer {
    constructor(container, getColors) {
      this.container = container;
      this.getColors = getColors;
      this.writer = null;
      this.charData = new Map();
      this.currentChar = null;
      this.ready = false;
      this.size = { width: 0, height: 0, padding: 0 };
      this.opId = 0;
      this.layout = null;
    }

    measure(layout) {
      const override = layout || this.layout;
      if (override && override.width && override.height) {
        return {
          width: override.width,
          height: override.height,
          padding:
            typeof override.padding === "number"
              ? override.padding
              : computeCanvasPadding(override.width, override.height),
        };
      }
      const rect = this.container.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height);
      const padding = computeCanvasPadding(rect.width, rect.height);
      return { width: rect.width, height: rect.height, padding };
    }

    sizeChanged(next) {
      const changed =
        Math.abs(next.width - this.size.width) > 1 ||
        Math.abs(next.height - this.size.height) > 1 ||
        Math.abs(next.padding - this.size.padding) > 1;
      if (changed) {
        this.size = next;
      }
      return changed;
    }

    async createWriter(character, opId, sizeOverride) {
      const HanziWriter = await ensureHanziWriter();
      if (opId !== this.opId) return;
      if (!HanziWriter) return;
      const nextSize = this.measure(sizeOverride);
      if (!nextSize.width || !nextSize.height) return;
      if (opId !== this.opId) return;
      this.size = nextSize;
      this.layout = nextSize;
      this.container.innerHTML = "";
      const colors = this.getColors();
      this.writer = HanziWriter.create(this.container, character, {
        width: nextSize.width,
        height: nextSize.height,
        padding: nextSize.padding,
        showOutline: false,
        showCharacter: true,
        strokeColor: colors.ghost,
        outlineColor: colors.ghost,
        highlightColor: colors.accent,
        drawingColor: colors.user,
        charDataLoader: (char, onComplete) => {
          const payload =
            this.charData.get(char) || { character: char, strokes: [], medians: [] };
          onComplete(payload);
        },
      });
      if (opId !== this.opId) return;
      this.currentChar = character;
      this.ready = true;
    }

    async setCharacter(data, layout) {
      if (!data || !data.character) return;
      this.charData.set(data.character, data);
      const nextSize = this.measure(layout);
      const opId = ++this.opId;
      this.layout = nextSize;
      if (!this.writer || this.sizeChanged(nextSize)) {
        await this.createWriter(data.character, opId, nextSize);
        return;
      }
      if (this.writer && typeof this.writer.setCharacter === "function") {
        try {
          await this.writer.setCharacter(data.character);
          if (opId !== this.opId) return;
          this.currentChar = data.character;
          return;
        } catch {
          await this.createWriter(data.character, opId, nextSize);
        }
      } else {
        await this.createWriter(data.character, opId, nextSize);
      }
    }

    async resize(layout) {
      if (!this.currentChar) return;
      const nextSize = this.measure(layout);
      if (this.sizeChanged(nextSize)) {
        const opId = ++this.opId;
        this.layout = nextSize;
        await this.createWriter(this.currentChar, opId, nextSize);
      }
    }

    showHint(index) {
      if (!this.writer) return;
      if (typeof this.writer.highlightStroke === "function") {
        this.writer.highlightStroke(index);
        return;
      }
      if (typeof this.writer.animateStroke === "function") {
        this.writer.animateStroke(index, {
          onComplete: () => {
            if (this.writer && typeof this.writer.showCharacter === "function") {
              this.writer.showCharacter({ duration: 0 });
            }
          },
        });
      }
    }

    replay() {
      if (!this.writer || typeof this.writer.animateCharacter !== "function") return;
      this.writer.animateCharacter();
    }

    destroy() {
      if (this.writer && typeof this.writer.cancelAnimation === "function") {
        this.writer.cancelAnimation();
      }
      this.container.innerHTML = "";
      this.writer = null;
      this.ready = false;
      this.currentChar = null;
    }
  }

  class DrawingEngine {
    constructor(container, ghostCanvas, drawCanvas, fxCanvas, onScore) {
      this.container = container;
      this.ghostCanvas = ghostCanvas;
      this.drawCanvas = drawCanvas;
      this.fxCanvas = fxCanvas;
      this.ghostCtx = ghostCanvas.getContext("2d");
      this.drawCtx = drawCanvas.getContext("2d");
      this.fxCtx = fxCanvas.getContext("2d");
      this.medians = [];
      this.strokes = [];
      this.mode = "guided";
      this.currentStrokeIndex = 0;
      this.usedMedians = new Set();
      this.userStrokes = [];
      this.userInkStrokes = [];
      this.currentStroke = [];
      this.currentInkStroke = [];
      this.strokeState = null;
      this.dwellRaf = 0;
      this.onScore = onScore;
      this.bounds = { x: 0, y: 0, size: 0 };
      this.canvasRect = null;
      this.ghostEnabled = true;
      this.freeDrawMode = false;
      this.ghostWidth = 8;
      this.userWidth = 8;
      this.highlightWidth = 10;
      this.layout = { width: 0, height: 0, padding: 0 };
      this.hintTimer = 0;
      this.resize();
      this.attachEvents();
      this.drawGhost();
    }

    setFreeDrawMode(enabled) {
      this.freeDrawMode = enabled;
    }

    setMode(mode) {
      this.mode = mode;
      this.currentStrokeIndex = 0;
      this.usedMedians = new Set();
    }

    setCharacter({ medians = [], strokes = [] }) {
      this.medians = medians;
      this.strokes = strokes;
      this.currentStrokeIndex = 0;
      this.usedMedians = new Set();
      this.clearUser();
      this.drawGhost();
    }

    getModelBounds() {
      return {
        minX: 0,
        maxX: 1024,
        minY: -124,
        maxY: 900,
      };
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      this.canvasRect = rect;
      const dpr = window.devicePixelRatio || 1;
      const style = getComputedStyle(this.drawCanvas);
      const insetX = Number.parseFloat(style.left) || 12;
      const insetY = Number.parseFloat(style.top) || 12;
      const innerWidth = Math.max(0, rect.width - insetX * 2);
      const innerHeight = Math.max(0, rect.height - insetY * 2);
      [this.ghostCanvas, this.drawCanvas, this.fxCanvas].forEach((canvas) => {
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        canvas.style.width = `${innerWidth}px`;
        canvas.style.height = `${innerHeight}px`;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
      const padding = computeCanvasPadding(innerWidth, innerHeight);
      const size = Math.min(innerWidth, innerHeight) - padding * 2;
      this.bounds = {
        x: (innerWidth - size) / 2,
        y: (innerHeight - size) / 2,
        size,
      };
      this.layout = { width: innerWidth, height: innerHeight, padding };
      const baseWidth = Math.max(12, size * 0.075);
      this.ghostWidth = baseWidth;
      // Apply baseWidthMultiplier from brush config to match ghost width by default
      this.userWidth = baseWidth * (BRUSH.baseWidthMultiplier || 1.0);
      this.highlightWidth = baseWidth * 1.05;
      this.drawGhost();
      this.redrawUser();
    }

    getLayout() {
      return this.layout;
    }

    toCanvas(point) {
      const bounds = this.getModelBounds();
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      return [
        this.bounds.x + ((point[0] - bounds.minX) / width) * this.bounds.size,
        this.bounds.y +
          (1 - (point[1] - bounds.minY) / height) * this.bounds.size,
      ];
    }

    toModel(point) {
      const bounds = this.getModelBounds();
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      return [
        bounds.minX + ((point[0] - this.bounds.x) / this.bounds.size) * width,
        bounds.minY +
          (1 - (point[1] - this.bounds.y) / this.bounds.size) * height,
      ];
    }

    setGhostEnabled(enabled) {
      this.ghostEnabled = enabled;
      this.drawGhost();
    }

    drawGhost(highlightIndex = null) {
      const ctx = this.ghostCtx;
      if (!ctx) return;
      ctx.clearRect(0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
      if (!this.ghostEnabled) {
        return;
      }
      const ghostColor = getComputedStyle(this.container).getPropertyValue("--stroke-ghost");
      const accent = getComputedStyle(this.container).getPropertyValue("--accent-strong");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      this.medians.forEach((median, index) => {
        const color = highlightIndex === index ? accent : ghostColor;
        ctx.strokeStyle = color.trim() || "rgba(107,76,42,0.22)";
        ctx.lineWidth = highlightIndex === index ? this.highlightWidth : this.ghostWidth;
        ctx.shadowColor = color.trim() || "rgba(107,76,42,0.22)";
        ctx.shadowBlur = highlightIndex === index ? this.highlightWidth * 0.18 : this.ghostWidth * 0.16;
        drawSmoothStroke(ctx, median, (pt) => this.toCanvas(pt));
      });
      ctx.shadowBlur = 0;
      if (this.medians.length) {
        this.medians.forEach((median, index) => {
          if (index !== 0 && highlightIndex !== index) return;
          const [sx, sy] = this.toCanvas(median[0]);
          const color = highlightIndex === index ? accent : ghostColor;
          ctx.fillStyle = color.trim() || "rgba(107,76,42,0.22)";
          ctx.font = "12px 'Avenir Next', 'Futura', sans-serif";
          ctx.fillText(String(index + 1), sx + 6, sy - 6);
        });
      }
    }

    clearHint() {
      if (this.hintTimer) {
        clearTimeout(this.hintTimer);
        this.hintTimer = 0;
      }
      this.drawGhost();
    }

    redrawUser() {
      const ctx = this.drawCtx;
      ctx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const strokeColor = getComputedStyle(this.container).getPropertyValue("--stroke-user");
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      this.userInkStrokes.forEach((stroke) => {
        drawInkStroke(ctx, stroke, (pt) => this.toCanvas(pt), this.userWidth);
      });
    }

    clearUser() {
      this.userStrokes = [];
      this.userInkStrokes = [];
      this.currentStroke = [];
      this.currentInkStroke = [];
      this.strokeState = null;
      if (this.dwellRaf) {
        cancelAnimationFrame(this.dwellRaf);
        this.dwellRaf = 0;
      }
      this.currentStrokeIndex = 0;
      this.usedMedians = new Set();
      this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
      this.fxCtx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      if (this.onScore) {
        this.onScore({ score: null, overall: null, strokeIndex: null, userStrokeCount: 0 });
      }
    }

    flashStroke(targetIndex, score) {
      const ctx = this.fxCtx;
      ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      const good = score >= 75;
      ctx.strokeStyle = good
        ? getComputedStyle(this.container).getPropertyValue("--stroke-user")
        : getComputedStyle(this.container).getPropertyValue("--stroke-wrong");
      const median = this.medians[targetIndex];
      if (!median || median.length < 2) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = this.highlightWidth;
      drawSmoothStroke(ctx, median, (pt) => this.toCanvas(pt));
      setTimeout(() => {
        ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      }, 260);
    }

    attachEvents() {
      const stopDwell = () => {
        if (this.dwellRaf) {
          cancelAnimationFrame(this.dwellRaf);
          this.dwellRaf = 0;
        }
      };

      const startStroke = (point, pressure, time) => {
        stopDwell();
        this.currentStroke = [];
        this.currentInkStroke = [];
        const strokeColor = getComputedStyle(this.container).getPropertyValue("--stroke-user");
        this.drawCtx.lineCap = "round";
        this.drawCtx.lineJoin = "round";
        this.drawCtx.strokeStyle = strokeColor;
        this.drawCtx.fillStyle = strokeColor;
        const baseWidth = this.userWidth || 1;
        const width = computeBrushWidth(baseWidth, pressure, 0) * BRUSH.startTaperMin;
        this.strokeState = {
          lastPoint: point,
          filteredPoint: point,
          lastVelocity: 0,
          lastWidth: width,
          lastTime: time,
          lastMoveTime: time,
          lastPressure: pressure,
          length: 0,
        };
        drawInkDot(this.drawCtx, point, width);
        const modelPoint = this.toModel(point);
        this.currentStroke.push(modelPoint);
        this.currentInkStroke.push({ point: modelPoint, width: width / baseWidth });
        const dwellLoop = (now) => {
          if (!this.strokeState) {
            this.dwellRaf = 0;
            return;
          }
          const state = this.strokeState;
          const currentTime =
            typeof now === "number"
              ? now
              : typeof performance !== "undefined" && typeof performance.now === "function"
                ? performance.now()
                : Date.now();
          const sinceMove = currentTime - state.lastMoveTime;
          if (sinceMove >= BRUSH.dwellDelayMs) {
            const dwellSeconds = (sinceMove - BRUSH.dwellDelayMs) / 1000;
            const dwellFactor = clamp(
              1 + dwellSeconds * BRUSH.dwellGrowthRate,
              1,
              BRUSH.dwellMaxFactor
            );
            const targetBaseWidth = computeBrushWidth(baseWidth, state.lastPressure, 0);
            const targetWidth = targetBaseWidth * dwellFactor;
            const smoothWidth = lerp(state.lastWidth, targetWidth, BRUSH.widthSmoothing);
            const minStep = Math.max(0.25, baseWidth * BRUSH.dwellStepFactor);
            if (smoothWidth - state.lastWidth >= minStep) {
              drawInkDot(this.drawCtx, state.lastPoint, smoothWidth);
              const dwellModelPoint = this.toModel(state.lastPoint);
              this.currentInkStroke.push({
                point: dwellModelPoint,
                width: smoothWidth / baseWidth,
              });
              state.lastWidth = smoothWidth;
            }
          }
          this.dwellRaf = requestAnimationFrame(dwellLoop);
        };
        this.dwellRaf = requestAnimationFrame(dwellLoop);
      };

      const moveStroke = (point, pressure, time, force = false) => {
        if (!this.strokeState) return;
        const baseWidth = this.userWidth || 1;
        this.strokeState.lastPressure = pressure;
        const filtered = this.strokeState.filteredPoint
          ? lerpPoint(this.strokeState.filteredPoint, point, 1 - BRUSH.positionSmoothing)
          : point;
        this.strokeState.filteredPoint = filtered;
        const lastPoint = this.strokeState.lastPoint || filtered;
        const minDistance = Math.max(0.6, baseWidth * BRUSH.minDistanceFactor);
        const segmentDistance = distance(lastPoint, filtered);
        if (!force && segmentDistance < minDistance) {
          return;
        }
        const dt = Math.max(time - this.strokeState.lastTime, 1);
        const velocity = segmentDistance / dt;
        const smoothVelocity = lerp(this.strokeState.lastVelocity, velocity, BRUSH.velocitySmoothing);
        const targetWidth = computeBrushWidth(baseWidth, pressure, smoothVelocity);
        const startTaper = clamp(
          (this.strokeState.length + segmentDistance) / (baseWidth * BRUSH.startTaperDistance),
          BRUSH.startTaperMin,
          1
        );
        const width = targetWidth * startTaper;
        const smoothWidth = lerp(this.strokeState.lastWidth, width, BRUSH.widthSmoothing);
        drawInkSegment(this.drawCtx, lastPoint, filtered, this.strokeState.lastWidth, smoothWidth);
        this.strokeState.lastPoint = filtered;
        this.strokeState.lastVelocity = smoothVelocity;
        this.strokeState.lastWidth = smoothWidth;
        this.strokeState.lastTime = time;
        this.strokeState.lastMoveTime = time;
        this.strokeState.length += segmentDistance;
        const modelPoint = this.toModel(filtered);
        this.currentStroke.push(modelPoint);
        this.currentInkStroke.push({ point: modelPoint, width: smoothWidth / baseWidth });
      };

      const finishStroke = () => {
        stopDwell();
        if (!this.currentStroke.length) {
          this.strokeState = null;
          return;
        }
        const stroke = [...this.currentStroke];
        const inkStroke = [...this.currentInkStroke];
        applyEndTaper(inkStroke);
        this.userStrokes.push(stroke);
        this.userInkStrokes.push(inkStroke);
        this.currentStroke = [];
        this.currentInkStroke = [];
        this.strokeState = null;

        // In free draw mode, skip all grading/scoring
        if (this.freeDrawMode) {
          this.redrawUser();
          return;
        }

        if (!this.medians.length) {
          if (this.onScore) {
            this.onScore({
              score: null,
              overall: null,
              strokeIndex: null,
              userStrokeCount: this.userStrokes.length,
            });
          }
          this.redrawUser();
          return;
        }
        let targetIndex = null;
        if (this.mode === "guided") {
          targetIndex = this.currentStrokeIndex;
          this.currentStrokeIndex += 1;
        } else {
          let best = { index: null, score: -Infinity, dist: Infinity };
          this.medians.forEach((median, index) => {
            if (this.usedMedians.has(index)) return;
            const sampled = resample(stroke, 32);
            const avg = sampled
              .map((pt) => distanceToPolyline(pt, median))
              .reduce((sum, d) => sum + d, 0) / sampled.length;
            if (avg < best.dist) {
              best = { index, score: scoreStroke(stroke, median), dist: avg };
            }
          });
          targetIndex = best.index;
          if (targetIndex !== null) {
            this.usedMedians.add(targetIndex);
          }
        }
        let score = 0;
        let overall = null;
        if (targetIndex !== null && this.medians[targetIndex]) {
          score = scoreStroke(stroke, this.medians[targetIndex]);
          this.flashStroke(targetIndex, score);
        }
        const scored = Math.min(this.userStrokes.length, this.medians.length || this.userStrokes.length);
        if (scored > 0) {
          const scores = this.userStrokes.slice(0, scored).map((s, i) => {
            if (!this.medians[i]) return 0;
            return scoreStroke(s, this.medians[i]);
          });
          overall = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        }
        if (this.onScore) {
          this.onScore({
            score,
            overall,
            strokeIndex: targetIndex,
            userStrokeCount: this.userStrokes.length,
          });
        }
        this.redrawUser();
      };

      const handlePointer = (event, type) => {
        const rect = this.drawCanvas.getBoundingClientRect();
        const point = [event.clientX - rect.left, event.clientY - rect.top];
        const inside =
          point[0] >= 0 &&
          point[1] >= 0 &&
          point[0] <= rect.width &&
          point[1] <= rect.height;
        if (!inside && type === "start") {
          return;
        }
        const pressure = normalizePressure(event);
        const time = getPointerTime(event);
        if (type === "start") {
          startStroke(point, pressure, time);
          return;
        }
        if (type === "move") {
          moveStroke(point, pressure, time);
          return;
        }
        if (type === "end") {
          if (this.strokeState) {
            moveStroke(point, pressure, time, true);
          }
          finishStroke();
        }
      };

      this.container.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        this.container.setPointerCapture(event.pointerId);
        handlePointer(event, "start");
      });
      this.container.addEventListener("pointermove", (event) => {
        const events =
          typeof event.getCoalescedEvents === "function"
            ? event.getCoalescedEvents()
            : [event];
        events.forEach((item) => handlePointer(item, "move"));
      });
      this.container.addEventListener("pointerup", (event) => handlePointer(event, "end"));
      this.container.addEventListener("pointercancel", (event) => handlePointer(event, "end"));
      this.container.addEventListener("pointerleave", (event) => handlePointer(event, "end"));
    }

    showHint(index) {
      if (index === null || index === undefined) return;
      if (!this.ghostEnabled) return;
      if (this.hintTimer) {
        clearTimeout(this.hintTimer);
        this.hintTimer = 0;
      }
      this.drawGhost(index);
      this.hintTimer = window.setTimeout(() => {
        this.hintTimer = 0;
        this.drawGhost();
      }, 700);
    }

    replay() {
      const ctx = this.fxCtx;
      ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      const accent = getComputedStyle(this.container).getPropertyValue("--accent");
      let strokeIndex = 0;
      const drawNext = () => {
        if (strokeIndex >= this.medians.length) {
          setTimeout(() => {
            ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
          }, 220);
          return;
        }
        const median = this.medians[strokeIndex];
        let t = 0;
        const step = () => {
          ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
          const color = accent.trim() || "#8b6914";
          if (median && median.length >= 2) {
            ctx.strokeStyle = color;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.lineWidth = this.highlightWidth;
            const length = Math.max(2, Math.floor(median.length * t));
            drawSmoothStroke(ctx, median.slice(0, length), (pt) => this.toCanvas(pt));
          }
          t += REPLAY_STEP;
          if (t < 1.1) {
            requestAnimationFrame(step);
          } else {
            strokeIndex += 1;
            setTimeout(drawNext, REPLAY_DELAY_MS);
          }
        };
        step();
      };
      drawNext();
    }
  }

  // Create inline brush configuration widget
  const createBrushWidget = (container, store, getColors) => {
    let visible = false;
    let activeTab = 'size';

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'brush-widget-backdrop';
    backdrop.style.display = 'none';

    // Panel
    const panel = document.createElement('div');
    panel.className = 'brush-widget-panel';
    panel.style.display = 'none';

    // Header
    const header = document.createElement('div');
    header.className = 'brush-widget-header';
    header.innerHTML = `
      <span class="brush-widget-title">Brush Settings</span>
      <button class="brush-widget-close" type="button">
        <svg viewBox="0 0 24 24"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>
      </button>
    `;

    // Preset row
    const presetRow = document.createElement('div');
    presetRow.className = 'brush-widget-preset-row';

    const presetSelect = document.createElement('select');
    presetSelect.className = 'brush-widget-select';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'brush-widget-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';

    presetRow.appendChild(presetSelect);
    presetRow.appendChild(resetBtn);

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'brush-widget-tabs';
    const tabs = [
      { id: 'size', label: 'Size' },
      { id: 'pressure', label: 'Pressure' },
      { id: 'smoothing', label: 'Smooth' },
      { id: 'taper', label: 'Taper' },
    ];
    const tabButtons = {};
    tabs.forEach(({ id, label }) => {
      const btn = document.createElement('button');
      btn.className = 'brush-widget-tab';
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.tab = id;
      tabBar.appendChild(btn);
      tabButtons[id] = btn;
    });

    // Tab content
    const tabContent = document.createElement('div');
    tabContent.className = 'brush-widget-content';

    panel.appendChild(header);
    panel.appendChild(presetRow);
    panel.appendChild(tabBar);
    panel.appendChild(tabContent);

    container.appendChild(backdrop);
    container.appendChild(panel);

    // Stop all pointer events from sliders from propagating to parent handlers
    panel.addEventListener('pointerdown', (e) => {
      if (e.target.closest('input[type="range"]')) {
        e.stopPropagation();
      }
    }, true);
    panel.addEventListener('pointermove', (e) => {
      if (e.target.closest('input[type="range"]')) {
        e.stopPropagation();
      }
    }, true);
    panel.addEventListener('pointerup', (e) => {
      if (e.target.closest('input[type="range"]')) {
        e.stopPropagation();
      }
    }, true);

    const populatePresets = () => {
      presetSelect.innerHTML = '';
      const allPresets = store.getAllPresets();
      const activeId = store.getActivePresetId();
      allPresets.forEach((preset) => {
        const opt = document.createElement('option');
        opt.value = preset.id;
        opt.textContent = preset.isBuiltIn ? preset.name : `${preset.name} (Custom)`;
        if (preset.id === activeId) opt.selected = true;
        presetSelect.appendChild(opt);
      });
    };

    const createSlider = (label, key, min, max, step, unit = '') => {
      const config = store.getConfig();
      const value = config[key] !== undefined ? config[key] : 0;
      const row = document.createElement('div');
      row.className = 'brush-widget-slider-row';
      row.innerHTML = `
        <div class="brush-widget-label-row">
          <label class="brush-widget-label">${label}</label>
          <span class="brush-widget-value">${value.toFixed(step < 1 ? 2 : 0)}${unit}</span>
        </div>
        <input type="range" class="brush-widget-slider" min="${min}" max="${max}" step="${step}" value="${value}">
      `;
      const slider = row.querySelector('input');
      const valueEl = row.querySelector('.brush-widget-value');
      slider.addEventListener('input', () => {
        const val = parseFloat(slider.value);
        valueEl.textContent = `${val.toFixed(step < 1 ? 2 : 0)}${unit}`;
        store.setConfig({ [key]: val });
      });
      return row;
    };

    const createCheckbox = (label, key) => {
      const config = store.getConfig();
      const checked = config[key] || false;
      const row = document.createElement('div');
      row.className = 'brush-widget-checkbox-row';
      row.innerHTML = `
        <input type="checkbox" class="brush-widget-checkbox" id="brush-${key}" ${checked ? 'checked' : ''}>
        <label class="brush-widget-checkbox-label" for="brush-${key}">${label}</label>
      `;
      const checkbox = row.querySelector('input');
      checkbox.addEventListener('change', () => {
        store.setConfig({ [key]: checkbox.checked });
      });
      return row;
    };

    const setActiveTab = (tabId) => {
      activeTab = tabId;
      Object.entries(tabButtons).forEach(([id, btn]) => {
        btn.classList.toggle('active', id === tabId);
      });
      renderTabContent();
    };

    const renderTabContent = () => {
      tabContent.innerHTML = '';
      if (activeTab === 'size') {
        tabContent.appendChild(createSlider('Base Size', 'baseWidthMultiplier', 0.5, 2.0, 0.05, 'x'));
        tabContent.appendChild(createSlider('Min Width', 'minWidthFactor', 0.1, 1.0, 0.05, 'x'));
        tabContent.appendChild(createSlider('Max Width', 'maxWidthFactor', 1.0, 3.0, 0.1, 'x'));
        const divider = document.createElement('div');
        divider.className = 'brush-widget-divider';
        tabContent.appendChild(divider);
        tabContent.appendChild(createSlider('Velocity Influence', 'velocityInfluence', 0, 1, 0.05));
        tabContent.appendChild(createSlider('Velocity Range', 'velocityRange', 0.5, 5.0, 0.1));
        tabContent.appendChild(createCheckbox('Invert Velocity', 'velocityInverted'));
      } else if (activeTab === 'pressure') {
        tabContent.appendChild(createSlider('Pressure Influence', 'pressureInfluence', 0, 1, 0.05));
        tabContent.appendChild(createSlider('Pressure Exponent', 'pressureExponent', 0.2, 3.0, 0.05));
      } else if (activeTab === 'smoothing') {
        tabContent.appendChild(createSlider('Position Smoothing', 'positionSmoothing', 0, 0.9, 0.05));
        tabContent.appendChild(createSlider('Velocity Smoothing', 'velocitySmoothing', 0, 0.9, 0.05));
        tabContent.appendChild(createSlider('Width Smoothing', 'widthSmoothing', 0, 0.9, 0.05));
      } else if (activeTab === 'taper') {
        const startLabel = document.createElement('div');
        startLabel.className = 'brush-widget-section-label';
        startLabel.textContent = 'Start Taper';
        tabContent.appendChild(startLabel);
        tabContent.appendChild(createSlider('Distance', 'startTaperDistance', 0, 5, 0.1));
        tabContent.appendChild(createSlider('Min Size', 'startTaperMin', 0.1, 1.0, 0.05, 'x'));
        const endLabel = document.createElement('div');
        endLabel.className = 'brush-widget-section-label';
        endLabel.textContent = 'End Taper';
        tabContent.appendChild(endLabel);
        tabContent.appendChild(createSlider('Points', 'endTaperPoints', 0, 20, 1));
        tabContent.appendChild(createSlider('Strength', 'endTaperStrength', 0, 1, 0.05));
        const dwellLabel = document.createElement('div');
        dwellLabel.className = 'brush-widget-section-label';
        dwellLabel.textContent = 'Dwell';
        tabContent.appendChild(dwellLabel);
        tabContent.appendChild(createSlider('Delay', 'dwellDelayMs', 0, 500, 10, 'ms'));
        tabContent.appendChild(createSlider('Growth Rate', 'dwellGrowthRate', 0, 2, 0.1));
        tabContent.appendChild(createSlider('Max Factor', 'dwellMaxFactor', 1, 4, 0.1, 'x'));
      }
    };

    const show = () => {
      visible = true;
      backdrop.style.display = 'block';
      panel.style.display = 'flex';
      populatePresets();
      setActiveTab(activeTab);
    };

    const hide = () => {
      visible = false;
      backdrop.style.display = 'none';
      panel.style.display = 'none';
    };

    const toggle = () => {
      if (visible) hide();
      else show();
    };

    // Event listeners
    backdrop.addEventListener('click', hide);
    header.querySelector('.brush-widget-close').addEventListener('click', hide);

    tabBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (btn) setActiveTab(btn.dataset.tab);
    });

    presetSelect.addEventListener('change', () => {
      store.selectPreset(presetSelect.value);
      renderTabContent();
    });

    resetBtn.addEventListener('click', () => {
      store.resetCurrentPreset();
      renderTabContent();
    });

    // Keyboard escape
    const keyHandler = (e) => {
      if (e.key === 'Escape' && visible) hide();
    };
    document.addEventListener('keydown', keyHandler);

    // Subscribe to store changes
    store.subscribe(() => {
      if (visible) renderTabContent();
    });

    // Draggable header
    let dragState = null;
    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.brush-widget-close')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      dragState = { startX: e.clientX, startY: e.clientY, panelX: rect.left, panelY: rect.top };
      header.setPointerCapture(e.pointerId);
    });
    header.addEventListener('pointermove', (e) => {
      if (!dragState) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      panel.style.left = `${dragState.panelX + dx}px`;
      panel.style.top = `${dragState.panelY + dy}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.transform = 'none';
    });
    header.addEventListener('pointerup', (e) => {
      if (dragState) {
        header.releasePointerCapture(e.pointerId);
        dragState = null;
      }
    });

    return { show, hide, toggle, isVisible: () => visible };
  };

  const mount = (container, hostApi, initialState = {}) => {
    const root = document.createElement("div");
    root.className = "hanzi-root";
    root.innerHTML = template;
    container.appendChild(root);

    const isMobile = typeof navigator !== "undefined";
    const ua = isMobile ? navigator.userAgent || "" : "";
    const platform = isMobile ? navigator.platform || "" : "";
    const maxTouchPoints = isMobile ? navigator.maxTouchPoints || 0 : 0;

    // Detect iPhone/iPod only (not iPad)
    const isIPhone = /iPhone|iPod/i.test(ua);

    // Detect Android
    const isAndroid = /Android/i.test(ua);

    if (isIPhone) {
      root.style.setProperty("--safe-top", "30px");
    } else if (isAndroid) {
      root.style.setProperty("--safe-top", "25px");
    } else {
      root.style.setProperty("--safe-top", "0px");
    }

    const elChar = root.querySelector("[data-char]");
    const elPinyin = root.querySelector("[data-pinyin]");
    const elStrokes = root.querySelector("[data-strokes]");
    const elEtymology = root.querySelector("[data-etymology]");
    const elScore = root.querySelector("[data-score]");
    const elScoreBar = root.querySelector("[data-score-bar]");
    const elScoreBurst = root.querySelector("[data-score-burst]");
    const elTotalScore = root.querySelector("[data-total-score]");
    const elCompleteCount = root.querySelector("[data-complete-count]");
    const elOverlay = root.querySelector("[data-overlay]");
    const elExamples = root.querySelector("[data-examples]");
    const elExampleCount = root.querySelector("[data-example-count]");
    const elExamplesFooter = root.querySelector("[data-examples-footer]");
    const canvasShell = root.querySelector("[data-canvas-shell]");
    const writerLayerEl = root.querySelector("[data-writer]");
    const ghostCanvas = root.querySelector("[data-ghost]");
    const drawCanvas = root.querySelector("[data-draw]");
    const fxCanvas = root.querySelector("[data-fx]");
    const guidedToggle = root.querySelector("[data-guided-toggle]");
    const freeDrawToggle = root.querySelector("[data-freedraw-toggle]");
    const navPrev = root.querySelector("[data-nav='prev']");
    const navNext = root.querySelector("[data-nav='next']");
    const actionButtons = root.querySelectorAll("[data-action]");

    const state = {
      stackConfig: initialState.stackConfig || hostApi.getStackConfig(),
      character: "",
      pinyin: "",
      radical: "",
      strokeCount: null,
      strokes: [],
      medians: [],
      etymology: "",
      etyLang: "",
      mode: "guided",
      guidedHints: true,
      onlyWithStrokes: true,
      freeDrawMode: false,
      history: [],
      historyIndex: -1,
      examples: [],
      examplesOffset: 0,
      examplesTotal: null,
      loadingExamples: false,
      noMoreExamples: false,
      packDbAvailable: true,
      fallbackIndex: 0,
      totalScore: 0,
      completedCount: 0,
    };
    const pinyinCache = new Map();
    let hintTimer = 0;
    let writerLayer = null;
    let hasInitialGuidedHint = false;
    let completedThisChar = false;
    let scoreBurstTimer = 0;
    let scoreAnimFrame = 0;
    const STORAGE_KEY = "hanzipan_state_v1";

    // Initialize brush store and sync config
    const brushStore = new BrushStore('hanzipan-brush-v1');
    syncBrushFromConfig(brushStore.getConfig());
    brushStore.subscribe((config) => {
      syncBrushFromConfig(config);
      // Trigger resize to update userWidth
      if (engine) engine.resize();
    });
    let brushWidget = null;

    const readStoredState = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
      } catch {
        return null;
      }
    };

    const persistState = () => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            guidedHints: state.guidedHints,
            onlyWithStrokes: state.onlyWithStrokes,
            history: state.history,
            historyIndex: state.historyIndex,
            totalScore: state.totalScore,
            completedCount: state.completedCount,
          })
        );
      } catch {
        // Ignore storage failures (private mode).
      }
    };

    const applyStoredState = () => {
      const saved = readStoredState();
      if (!saved) return;
      if (typeof saved.guidedHints === "boolean") {
        state.guidedHints = saved.guidedHints;
      }
      if (typeof saved.onlyWithStrokes === "boolean") {
        state.onlyWithStrokes = saved.onlyWithStrokes;
      }
      if (Array.isArray(saved.history)) {
        state.history = saved.history.filter((item) => typeof item === "string");
      }
      if (Number.isInteger(saved.historyIndex)) {
        state.historyIndex = Math.max(-1, Math.min(saved.historyIndex, state.history.length - 1));
      }
      if (Number.isFinite(saved.totalScore)) {
        state.totalScore = Math.max(0, Math.round(saved.totalScore));
      }
      if (Number.isFinite(saved.completedCount)) {
        state.completedCount = Math.max(0, Math.round(saved.completedCount));
      }
    };

    const updateNavButtons = () => {
      const canPrev = state.historyIndex > 0;
      const canNext = true;
      if (navPrev) {
        navPrev.disabled = !canPrev;
        navPrev.classList.toggle("disabled", !canPrev);
      }
      if (navNext) {
        navNext.disabled = !canNext;
        navNext.classList.toggle("disabled", !canNext);
      }
    };

    const pushHistory = (char) => {
      if (!char) return;
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }
      state.history.push(char);
      state.historyIndex = state.history.length - 1;
      persistState();
      updateNavButtons();
    };

    const setHistoryIndex = (index) => {
      state.historyIndex = Math.max(-1, Math.min(index, state.history.length - 1));
      persistState();
      updateNavButtons();
    };

    const renderTotals = () => {
      if (elTotalScore) {
        elTotalScore.textContent = String(state.totalScore || 0);
      }
      if (elCompleteCount) {
        elCompleteCount.textContent = String(state.completedCount || 0);
      }
    };

    const clearScoreBurst = () => {
      if (!elScoreBurst) return;
      if (scoreBurstTimer) {
        clearTimeout(scoreBurstTimer);
        scoreBurstTimer = 0;
      }
      elScoreBurst.textContent = "";
      elScoreBurst.classList.remove("is-active");
    };

    const AUTO_HINT_INTERVAL = 10000; // 10 seconds

    const scheduleGuidedHint = (delayMs, options = {}) => {
      if (hintTimer) {
        clearTimeout(hintTimer);
      }
      hintTimer = window.setTimeout(() => {
        showGuidedHint(engine.currentStrokeIndex, options);
      }, delayMs);
    };

    const showGuidedHint = (index, options = {}) => {
      const { force = false } = options;
      if (!state.guidedHints && !force) return;
      if (state.freeDrawMode) return;
      if (index === null || index === undefined) return;
      if (!state.medians.length || index < 0 || index >= state.medians.length) {
        return;
      }
      if (writerLayer && writerLayer.ready) {
        writerLayer.showHint(index);
      } else {
        engine.showHint(index);
      }
      // Schedule next auto-hint if guided mode is on
      if (state.guidedHints && !state.freeDrawMode) {
        scheduleGuidedHint(AUTO_HINT_INTERVAL);
      }
    };

    const syncGuidedToggle = () => {
      if (!guidedToggle) return;
      guidedToggle.classList.toggle("active", state.guidedHints);
      guidedToggle.setAttribute("aria-pressed", state.guidedHints ? "true" : "false");
      guidedToggle.title = state.guidedHints ? "Guided on" : "Guided off";
    };

    applyStoredState();
    syncGuidedToggle();
    updateNavButtons();
    renderTotals();

    const updateScoreBar = (value) => {
      if (!elScoreBar || !elScore) return;
      if (value === null || value === undefined) {
        elScoreBar.classList.remove("is-active");
        elScore.style.width = "0%";
        return;
      }
      const clamped = Math.max(0, Math.min(Math.round(value), 100));
      elScoreBar.classList.add("is-active");
      elScore.style.width = `${clamped}%`;
    };

    const showScoreBurst = (points) => {
      if (!elScoreBurst) return;
      elScoreBurst.textContent = `+${points}`;
      elScoreBurst.classList.remove("is-active");
      void elScoreBurst.offsetWidth;
      elScoreBurst.classList.add("is-active");
      if (scoreBurstTimer) {
        clearTimeout(scoreBurstTimer);
      }
      scoreBurstTimer = window.setTimeout(() => {
        clearScoreBurst();
      }, 900);
    };

    const animateTotalScore = (from, to) => {
      if (!elTotalScore) return;
      if (scoreAnimFrame) {
        cancelAnimationFrame(scoreAnimFrame);
        scoreAnimFrame = 0;
      }
      const startTime = performance.now();
      const duration = 450;
      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const value = Math.round(from + (to - from) * eased);
        elTotalScore.textContent = String(value);
        if (t < 1) {
          scoreAnimFrame = requestAnimationFrame(step);
        } else {
          scoreAnimFrame = 0;
          elTotalScore.textContent = String(to);
        }
      };
      elTotalScore.classList.add("is-pulse");
      requestAnimationFrame(step);
      window.setTimeout(() => {
        elTotalScore.classList.remove("is-pulse");
      }, 520);
    };

    const addTotalScore = (points) => {
      const start = state.totalScore || 0;
      const end = start + points;
      state.totalScore = end;
      animateTotalScore(start, end);
    };

    const engine = new DrawingEngine(
      canvasShell,
      ghostCanvas,
      drawCanvas,
      fxCanvas,
      ({ score, overall, strokeIndex, userStrokeCount }) => {
      const displayScore = overall !== null && overall !== undefined ? overall : score;
      updateScoreBar(displayScore);
      if (overall !== null) {
        elOverlay.textContent = overall >= 85 ? "Crisp" : overall >= 70 ? "Nice" : "Try again";
      }
      const strokeTotal = userStrokeCount || 0;
      if (overall !== null && overall !== undefined && state.medians.length && !completedThisChar) {
        if (strokeIndex === state.medians.length - 1 || strokeTotal >= state.medians.length) {
          completedThisChar = true;
          const points = state.strokeCount || state.medians.length;
          if (points) {
            addTotalScore(points);
            showScoreBurst(points);
          }
          state.completedCount += 1;
          renderTotals();
          persistState();
        }
      }
      if (state.mode === "guided") {
        scheduleGuidedHint(140);
      }
    }
    );

    writerLayer = writerLayerEl
      ? new HanziWriterLayer(writerLayerEl, () => {
        const styles = getComputedStyle(root);
        return {
          ghost: styles.getPropertyValue("--stroke-ghost").trim() || "rgba(107,76,42,0.22)",
          accent: styles.getPropertyValue("--accent").trim() || "#8b6914",
          user: styles.getPropertyValue("--stroke-user").trim() || "#1a1410",
        };
      })
      : null;

    const updateWriterLayer = async () => {
      if (!writerLayer) return;
      const data = {
        character: state.character,
        strokes: state.strokes,
        medians: state.medians,
      };
      try {
        await writerLayer.setCharacter(data, engine.getLayout());
        if (writerLayer.ready && data.medians.length) {
          engine.setGhostEnabled(false);
        } else {
          engine.setGhostEnabled(true);
        }
      } catch (err) {
        console.warn("[hanzi] HanziWriter load failed", err);
        engine.setGhostEnabled(true);
      }
    };

    const renderCharacter = () => {
      elChar.textContent = state.character;
      const cached = pinyinCache.get(state.character);
      const pinyin = cached || state.pinyin || fallbackPinyinMap[state.character] || "";
      if (pinyin) {
        pinyinCache.set(state.character, pinyin);
      }
      elStrokes.textContent = state.strokeCount ? String(state.strokeCount) : "--";
      elEtymology.textContent = state.etymology || "";
      if (elPinyin) {
        const hasPinyin = state.stackConfig.showRomanization && pinyin;
        elPinyin.textContent = hasPinyin ? pinyin : "";
        elPinyin.disabled = !hasPinyin;
        elPinyin.classList.toggle("is-empty", !hasPinyin);
      }
    };

    const renderExamples = () => {
      elExamples.innerHTML = "";
      const fragment = document.createDocumentFragment();
      state.examples.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "example-card";
        const header = document.createElement("div");
        header.className = "example-header";
        const text = document.createElement("div");
        text.className = "example-text";
        const romanization = document.createElement("div");
        romanization.className = "example-romanization";
        const speak = document.createElement("button");
        speak.className = "speak-btn";
        speak.setAttribute("aria-label", "Speak");
        speak.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 10v4h4l5 4V6L8 10H4zM16.5 8.5a4.5 4.5 0 0 1 0 7M19 6a8 8 0 0 1 0 12"
            />
          </svg>
        `;

        const zh = entry.translations.find((t) => t.language_code.startsWith("zh-"));
        const primary = zh || entry.translations[0];
        text.textContent = primary ? primary.text : "";
        romanization.textContent =
          state.stackConfig.showRomanization && primary && primary.romanization
            ? primary.romanization
            : "";
        speak.disabled = !primary;
        speak.addEventListener("click", () => {
          if (!primary) return;
          hostApi.speak(primary.language_code, primary.text);
        });

        header.appendChild(text);
        header.appendChild(speak);

        const translations = document.createElement("div");
        translations.className = "example-translations";
        const stackLangs = state.stackConfig.languages || [];
        const lines = entry.translations
          .filter((t) => stackLangs.includes(t.language_code) && !t.language_code.startsWith("zh-"))
          .map((t) => `${t.language_code.toUpperCase()}: ${t.text}`);
        translations.textContent = lines.join(" | ");

        card.appendChild(header);
        if (romanization.textContent) {
          card.appendChild(romanization);
        }
        if (translations.textContent) {
          card.appendChild(translations);
        }
        fragment.appendChild(card);
      });
      elExamples.appendChild(fragment);
      updateExampleCount();
    };

    const queryPackDb = async (sql, params = [], options = {}) => {
      if (!hostApi.queryPackDb || !state.packDbAvailable) {
        return { rows: [] };
      }
      try {
        const result = await hostApi.queryPackDb({ sql, params, ...options });
        state.packDbAvailable = true;
        return result;
      } catch (err) {
        state.packDbAvailable = false;
        console.warn("[hanzi] pack DB query failed", err);
        return { rows: [] };
      }
    };

    const pickFallbackEntry = () => {
      const entry = fallbackEntries[state.fallbackIndex % fallbackEntries.length];
      state.fallbackIndex += 1;
      return entry;
    };

    const scheduleInitialHint = () => {
      const delay = hasInitialGuidedHint ? 220 : 900;
      hasInitialGuidedHint = true;
      scheduleGuidedHint(delay);
    };

    const loadCharacter = async (options = {}) => {
      const { targetChar = null, push = true } = options;
      elOverlay.textContent = "Loading";
      const filter = state.onlyWithStrokes ? "WHERE stroke_count IS NOT NULL AND stroke_count > 0" : "";
      let row = null;
      if (targetChar) {
        const lookup = await queryPackDb(
          "SELECT char, pinyin, stroke_count, radical FROM hanzi_character WHERE char = ? LIMIT 1",
          [targetChar]
        );
        row = lookup.rows[0];
      } else {
        const result = await queryPackDb(
          `SELECT char, pinyin, stroke_count, radical FROM hanzi_character ${filter} ORDER BY RANDOM() LIMIT 1`
        );
        row = result.rows[0];
      }
      if (!row) {
        const fallback = pickFallbackEntry();
        state.character = fallback.char;
        state.pinyin = fallback.pinyin;
        state.strokeCount = fallback.stroke_count;
        state.radical = fallback.radical;
        state.strokes = fallback.strokes;
        state.medians = fallback.medians;
        state.etymology = fallback.etymology;
        state.etyLang = "en";
        await updateWriterLayer();
        scheduleInitialHint();
      } else {
        state.character = row.char || fallbackCharacter.char;
        state.pinyin = row.pinyin || "";
        state.strokeCount =
          row.stroke_count !== undefined && row.stroke_count !== null
            ? row.stroke_count
            : null;
        state.radical = row.radical || "";

        const strokeRes = await queryPackDb(
          "SELECT data_json FROM hanzi_writer WHERE char = ? LIMIT 1",
          [state.character]
        );
        const strokeRow = strokeRes.rows[0];
        if (strokeRow && strokeRow.data_json) {
          try {
            const parsed = JSON.parse(strokeRow.data_json || "{}");
            state.strokes = Array.isArray(parsed.strokes) ? parsed.strokes : [];
            state.medians = Array.isArray(parsed.medians) ? parsed.medians : [];
          } catch {
            state.strokes = [];
            state.medians = [];
          }
        } else {
          state.strokes = [];
          state.medians = [];
        }
        if (!state.strokes.length || !state.medians.length) {
          state.strokeCount = null;
        }
        await updateWriterLayer();
        scheduleInitialHint();

        const etyRes = await queryPackDb(
          "SELECT language_code, summary FROM hanzi_etymology WHERE char = ?",
          [state.character]
        );
        const etyRows = etyRes.rows || [];
        const preferred = unique([...(state.stackConfig.languages || []), "en"]);
        const match = preferred
          .map((lang) => etyRows.find((row) => row.language_code === lang))
          .find(Boolean);
        if (match) {
          state.etymology = match.summary;
          state.etyLang = match.language_code;
        } else if (etyRows[0]) {
          state.etymology = etyRows[0].summary;
          state.etyLang = etyRows[0].language_code;
        } else {
          state.etymology = fallbackEtymology;
          state.etyLang = "en";
        }
      }

      renderCharacter();
      completedThisChar = false;
      engine.setCharacter({ medians: state.medians, strokes: state.strokes });
      state.examples = [];
      state.examplesOffset = 0;
      state.examplesTotal = null;
      state.noMoreExamples = false;
      updateExampleCount();
      await loadExamplesTotal();
      await loadExamples(true);
      // Reset scroll position for new character
      if (elExamples) {
        elExamples.scrollTop = 0;
      }
      if (push) {
        pushHistory(state.character);
      }
      if (!state.packDbAvailable) {
        elOverlay.textContent = "Demo mode (install pack zip for full corpus)";
      } else {
        elOverlay.textContent = state.medians.length ? "Ready" : "Stroke data coming soon";
      }
    };

    const loadExamples = async (reset = false) => {
      if (!hostApi.searchEntriesByText) return;
      if (state.loadingExamples) return;
      if (state.noMoreExamples && !reset) return;
      state.loadingExamples = true;
      elExamplesFooter.textContent = "Loading examples...";
      const langCodes = unique([...(state.stackConfig.languages || []), "zh-Hans", "zh-Hant"]);
      let batch = [];
      try {
        batch = await hostApi.searchEntriesByText({
          text: state.character,
          languageCodes: langCodes,
          limit: 16,
          offset: state.examplesOffset,
        });
      } catch (err) {
        console.warn("[hanzi] example search failed", err);
      }
      if (reset) {
        state.examples = [];
      }
      state.examples.push(...(batch || []));
      state.examplesOffset += (batch || []).length;
      if (!batch || batch.length === 0) {
        state.noMoreExamples = true;
      }
      renderExamples();
      elExamplesFooter.textContent = batch && batch.length ? "Scroll for more" : "No more examples";
      state.loadingExamples = false;
    };

    function updateExampleCount() {
      if (!elExampleCount) return;
      if (typeof state.examplesTotal === "number") {
        const loaded = state.examples.length.toLocaleString();
        const total = state.examplesTotal.toLocaleString();
        elExampleCount.textContent = `${loaded} / ${total}`;
      } else if (state.examples.length) {
        elExampleCount.textContent = state.examples.length.toLocaleString();
      } else {
        elExampleCount.textContent = "0";
      }
    }

    async function loadExamplesTotal() {
      if (!hostApi.searchEntriesByTextCount) {
        state.examplesTotal = null;
        updateExampleCount();
        return;
      }
      const langCodes = unique([...(state.stackConfig.languages || []), "zh-Hans", "zh-Hant"]);
      try {
        const total = await hostApi.searchEntriesByTextCount({
          text: state.character,
          languageCodes: langCodes,
        });
        state.examplesTotal = Number.isFinite(total) ? total : null;
      } catch (err) {
        console.warn("[hanzi] example count failed", err);
        state.examplesTotal = null;
      }
      updateExampleCount();
    }

    const goToHistoryIndex = async (index) => {
      if (index < 0 || index >= state.history.length) return;
      const char = state.history[index];
      if (!char) return;
      setHistoryIndex(index);
      await loadCharacter({ targetChar: char, push: false });
    };

    const swipeState = { active: false, startX: 0, startY: 0, startTime: 0, hasNavigated: false };
    const touchState = {
      active: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      hasMultiTouch: false,
      startedOnInteractive: false,
      selectionActive: false,
    };
    const wheelState = {
      accumulator: 0,
      hasNavigated: false,
    };

    // Global navigation lock to prevent multiple navigation systems firing
    let navigationLocked = false;
    let navigationLockTimer = 0;
    const NAVIGATION_COOLDOWN = 500;

    const canNavigate = () => {
      return !navigationLocked;
    };

    const markNavigated = () => {
      navigationLocked = true;
      swipeState.hasNavigated = true;
      swipeState.active = false;
      wheelState.hasNavigated = true;
      wheelState.accumulator = 0;
      // Clear any existing timer
      if (navigationLockTimer) {
        clearTimeout(navigationLockTimer);
      }
      // Release lock after cooldown
      navigationLockTimer = setTimeout(() => {
        navigationLocked = false;
        navigationLockTimer = 0;
      }, NAVIGATION_COOLDOWN);
    };

    const SCROLL_THRESHOLD = 80;
    const WHEEL_END_DELAY = 360;
    let wheelEndTimer = 0;
    const NAV_DEBUG =
      typeof window !== "undefined" &&
      window.localStorage.getItem("hanzi_nav_debug") === "1";
    const logNav = (...args) => {
      if (!NAV_DEBUG) return;
      // eslint-disable-next-line no-console
      console.log("[hanzi][nav]", ...args);
    };
    const SWIPE_DISTANCE = 55;
    const SWIPE_HORIZONTAL_RATIO = 1.3;
    const MAX_SWIPE_DURATION = 500;
    const TOUCH_THRESHOLD = 50;
    const TOUCH_HORIZONTAL_RATIO = 1.3;
    const TOUCH_MAX_DURATION = 520;
    const TOUCH_MIN_VELOCITY = 0.25;
    const isSwipeTarget = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return false;
      if (target.closest("button, a, input, textarea, select")) return false;
      if (target.closest(".canvas-shell")) return false;
      if (target.closest(".examples-panel")) return false;
      if (target.closest(".examples-list")) return false;
      if (target.closest(".brush-widget-panel")) return false;
      if (target.closest(".brush-widget-backdrop")) return false;
      return true;
    };
    const hasActiveSelection = () => {
      if (typeof window === "undefined") return false;
      const selection = window.getSelection();
      return !!selection && !selection.isCollapsed;
    };
    const onSwipeStart = (event) => {
      if (event.pointerType === "touch") return;
      if (navigationLocked) return;
      if (hasActiveSelection()) return;
      if (!isSwipeTarget(event)) return;
      swipeState.active = true;
      swipeState.startX = event.clientX;
      swipeState.startY = event.clientY;
      swipeState.startTime = Date.now();
      swipeState.hasNavigated = false;
    };
    const onSwipeMove = (event) => {
      if (event.pointerType === "touch") return;
      if (!canNavigate()) return;
      if (!swipeState.active || swipeState.hasNavigated) return;
      // Bail if pointer is now over an interactive element (e.g., slider being dragged)
      if (!isSwipeTarget(event)) {
        swipeState.active = false;
        return;
      }
      if (Date.now() - swipeState.startTime > MAX_SWIPE_DURATION) {
        swipeState.active = false;
        return;
      }
      const dx = event.clientX - swipeState.startX;
      const dy = event.clientY - swipeState.startY;
      if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * SWIPE_HORIZONTAL_RATIO) {
        return;
      }
      swipeState.active = false;
      swipeState.hasNavigated = true;
      if (dx > 0) {
        goPrev();
      } else {
        goNext();
      }
    };
    const onSwipeEnd = () => {
      swipeState.active = false;
      swipeState.hasNavigated = false;
    };
    const resetTouchSwipe = () => {
      touchState.active = false;
      touchState.startX = 0;
      touchState.startY = 0;
      touchState.startTime = 0;
      touchState.hasMultiTouch = false;
      touchState.startedOnInteractive = false;
      touchState.selectionActive = false;
    };
    const onTouchStart = (event) => {
      resetTouchSwipe();
      if (navigationLocked) return;
      if (event.touches.length !== 1) {
        touchState.hasMultiTouch = true;
        return;
      }
      touchState.startedOnInteractive = !isSwipeTarget(event);
      touchState.selectionActive = hasActiveSelection();
      const touch = event.touches[0];
      touchState.active = true;
      touchState.startX = touch.clientX;
      touchState.startY = touch.clientY;
      touchState.startTime = Date.now();
    };
    const onTouchMove = (event) => {
      if (!touchState.active) return;
      if (event.touches.length > 1) {
        touchState.hasMultiTouch = true;
      }
      if (hasActiveSelection()) {
        touchState.selectionActive = true;
      }
    };
    const onTouchEnd = (event) => {
      if (!touchState.active) {
        resetTouchSwipe();
        return;
      }
      if (!canNavigate()) {
        resetTouchSwipe();
        return;
      }
      if (touchState.hasMultiTouch || touchState.startedOnInteractive || touchState.selectionActive) {
        resetTouchSwipe();
        return;
      }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchState.startX;
      const dy = touch.clientY - touchState.startY;
      const duration = Date.now() - touchState.startTime;
      if (duration > TOUCH_MAX_DURATION) {
        resetTouchSwipe();
        return;
      }
      const isHorizontal = Math.abs(dx) > Math.abs(dy) * TOUCH_HORIZONTAL_RATIO;
      if (!isHorizontal) {
        resetTouchSwipe();
        return;
      }
      const distance = Math.abs(dx);
      const velocity = distance / Math.max(duration, 1);
      if (distance >= TOUCH_THRESHOLD && velocity >= TOUCH_MIN_VELOCITY) {
        if (dx < 0) {
          goNext();
        } else {
          goPrev();
        }
      }
      resetTouchSwipe();
    };
    const onTouchCancel = () => {
      resetTouchSwipe();
    };
    const resetWheelGesture = () => {
      wheelState.hasNavigated = false;
      wheelState.accumulator = 0;
    };
    const scheduleWheelEnd = () => {
      if (wheelEndTimer) {
        window.clearTimeout(wheelEndTimer);
      }
      wheelEndTimer = window.setTimeout(() => {
        resetWheelGesture();
        logNav("wheel-end");
      }, WHEEL_END_DELAY);
    };
    const onWheelSwipe = (event) => {
      if (event.ctrlKey) return;
      if (hasActiveSelection()) return;
      if (!canNavigate()) return;
      scheduleWheelEnd();
      if (wheelState.hasNavigated) {
        logNav("wheel-ignored:consumed", { deltaX: event.deltaX });
        return;
      }
      if (!isSwipeTarget(event)) return;
      const absX = Math.abs(event.deltaX);
      const absY = Math.abs(event.deltaY);
      if (absX < 1 || absX < absY * SWIPE_HORIZONTAL_RATIO) return;
      if (Math.abs(event.deltaX) < 1) {
        return;
      }
      wheelState.accumulator += event.deltaX;
      if (Math.abs(wheelState.accumulator) >= SCROLL_THRESHOLD) {
        wheelState.hasNavigated = true;
        if (wheelState.accumulator > 0) {
          logNav("wheel-next", { acc: wheelState.accumulator });
          goNext();
        } else {
          logNav("wheel-prev", { acc: wheelState.accumulator });
          goPrev();
        }
        wheelState.accumulator = 0;
      }
    };

    const goPrev = async () => {
      if (!canNavigate()) return;
      if (state.historyIndex <= 0) return;
      markNavigated();
      clearScoreBurst();
      wheelState.accumulator = 0;
      logNav("prev");
      await goToHistoryIndex(state.historyIndex - 1);
    };

    const goNext = async () => {
      if (!canNavigate()) return;
      markNavigated();
      clearScoreBurst();
      wheelState.accumulator = 0;
      logNav("next");
      if (state.historyIndex >= 0 && state.historyIndex < state.history.length - 1) {
        await goToHistoryIndex(state.historyIndex + 1);
        return;
      }
      await loadCharacter();
    };

    if (guidedToggle) {
      guidedToggle.addEventListener("click", () => {
        state.guidedHints = !state.guidedHints;
        syncGuidedToggle();
        persistState();
        if (state.guidedHints) {
          scheduleGuidedHint(160, { force: true });
        }
      });
    }

    actionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "next") goNext();
        if (action === "prev") goPrev();
        if (action === "clear") engine.clearUser();
        if (action === "replay") {
          if (writerLayer && writerLayer.ready) {
            writerLayer.replay();
          } else {
            engine.replay();
          }
        }
        if (action === "speak") {
          const zh = (state.stackConfig.languages || []).find((lang) => lang.startsWith("zh"));
          const lang = zh || "zh-Hans";
          hostApi.speak(lang, state.character);
        }
        if (action === "brush-settings") {
          if (!brushWidget) {
            brushWidget = createBrushWidget(root, brushStore, () => {
              const styles = getComputedStyle(root);
              return { stroke: styles.getPropertyValue("--stroke-user").trim() || "#1a1410" };
            });
          }
          brushWidget.toggle();
        }
        if (action === "toggle-freedraw") {
          state.freeDrawMode = !state.freeDrawMode;
          if (freeDrawToggle) {
            freeDrawToggle.classList.toggle("active", state.freeDrawMode);
          }
          if (state.freeDrawMode) {
            // Hide ALL guides: ghost canvas, HanziWriter layer, scoring UI
            engine.setGhostEnabled(false);
            engine.setFreeDrawMode(true);
            engine.clearUser(); // Start with clean canvas
            // Hide HanziWriter layer completely
            if (writerLayerEl) writerLayerEl.style.display = "none";
            // Hide scoring UI
            if (elScoreBar) elScoreBar.style.display = "none";
            if (elTotalScore) elTotalScore.style.display = "none";
            if (elCompleteCount && elCompleteCount.parentElement) {
              elCompleteCount.parentElement.style.display = "none";
            }
            if (elStrokes) elStrokes.style.display = "none";
          } else {
            // Restore everything
            engine.setFreeDrawMode(false);
            engine.clearUser();
            // Show HanziWriter layer
            if (writerLayerEl) writerLayerEl.style.display = "";
            // Ghost and HanziWriter are mutually exclusive - only enable ghost if HanziWriter isn't ready
            if (writerLayer && writerLayer.ready && state.medians.length) {
              engine.setGhostEnabled(false);
            } else {
              engine.setGhostEnabled(true);
              engine.drawGhost();
            }
            // Show scoring UI
            if (elScoreBar) elScoreBar.style.display = "";
            if (elTotalScore) elTotalScore.style.display = "";
            if (elCompleteCount && elCompleteCount.parentElement) {
              elCompleteCount.parentElement.style.display = "";
            }
            if (elStrokes) elStrokes.style.display = "";
          }
        }
        if (action === "exit") {
          try {
            window.dispatchEvent(new CustomEvent("corpan:exit"));
          } catch {
            // Ignore exit dispatch failures.
          }
          try {
            window.close();
          } catch {
            // Ignore window close failures.
          }
        }
      });
    });

    const onScroll = () => {
      if (state.loadingExamples) return;
      const threshold = 200;
      if (elExamples.scrollTop + elExamples.clientHeight >= elExamples.scrollHeight - threshold) {
        loadExamples(false);
      }
    };
    elExamples.addEventListener("scroll", onScroll);

    root.addEventListener("pointerdown", onSwipeStart);
    root.addEventListener("pointermove", onSwipeMove);
    root.addEventListener("pointerup", onSwipeEnd);
    root.addEventListener("pointercancel", onSwipeEnd);
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchCancel, { passive: true });
    root.addEventListener("wheel", onWheelSwipe, { passive: true });

    let resizeRaf = 0;
    const handleResize = () => {
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
      }
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        engine.resize();
        if (writerLayer) {
          writerLayer.resize(engine.getLayout());
        }
      });
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvasShell);
    window.addEventListener("resize", handleResize);

    if (hostApi.onStackConfigChange) {
      hostApi.onStackConfigChange((next) => {
        state.stackConfig = next;
        renderCharacter();
        renderExamples();
      });
    }

    const initialChar = state.historyIndex >= 0 ? state.history[state.historyIndex] : null;
    if (initialChar) {
      loadCharacter({ targetChar: initialChar, push: false });
    } else {
      loadCharacter();
    }

    return {
      unmount: () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", handleResize);
        if (resizeRaf) {
          cancelAnimationFrame(resizeRaf);
          resizeRaf = 0;
        }
        if (hintTimer) {
          clearTimeout(hintTimer);
          hintTimer = 0;
        }
        resetWheelGesture();
        if (wheelEndTimer) {
          clearTimeout(wheelEndTimer);
          wheelEndTimer = 0;
        }
        elExamples.removeEventListener("scroll", onScroll);
        root.removeEventListener("pointerdown", onSwipeStart);
        root.removeEventListener("pointermove", onSwipeMove);
        root.removeEventListener("pointerup", onSwipeEnd);
        root.removeEventListener("pointercancel", onSwipeEnd);
        root.removeEventListener("touchstart", onTouchStart);
        root.removeEventListener("touchmove", onTouchMove);
        root.removeEventListener("touchend", onTouchEnd);
        root.removeEventListener("touchcancel", onTouchCancel);
        root.removeEventListener("wheel", onWheelSwipe);
        if (writerLayer) {
          writerLayer.destroy();
        }
        root.remove();
      },
    };
  };

  const registerGame = (game) => {
    if (typeof window === "undefined") return;
    const registry = window.CorpanGames || (window.CorpanGames = {});
    registry[game.id] = game;
  };

  registerGame({ id: GAME_ID, mount });
})();
