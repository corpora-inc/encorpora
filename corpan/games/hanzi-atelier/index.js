(() => {
  const GAME_ID = "hanzi_atelier";

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
            </div>
            <div class="toolbar-right">
              <button class="icon-chip active" data-guided-toggle aria-label="Guided hints">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5zM8 13.5v3.2c0 .8 2.1 1.8 4 1.8s4-1 4-1.8v-3.2"
                  />
                </svg>
              </button>
              <button class="icon-chip" data-action="hint" aria-label="Hint">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" />
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
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      script.onload = () => resolve(window.HanziWriter);
      script.onerror = async () => {
        try {
          const inline = await loadInlineViaTauri();
          if (inline) {
            resolve(inline);
            return;
          }
        } catch {
          // fall through to reject
        }
        reject(new Error("Failed to load HanziWriter"));
      };
      document.head.appendChild(script);
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
      this.currentStroke = [];
      this.onScore = onScore;
      this.bounds = { x: 0, y: 0, size: 0 };
      this.canvasRect = null;
      this.ghostEnabled = true;
      this.ghostWidth = 8;
      this.userWidth = 8;
      this.highlightWidth = 10;
      this.layout = { width: 0, height: 0, padding: 0 };
      this.hintTimer = 0;
      this.resize();
      this.attachEvents();
      this.drawGhost();
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
      this.userWidth = Math.max(8, size * 0.045);
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
        ctx.strokeStyle = color.trim() || "rgba(11,107,111,0.22)";
        ctx.lineWidth = highlightIndex === index ? this.highlightWidth : this.ghostWidth;
        ctx.shadowColor = color.trim() || "rgba(11,107,111,0.22)";
        ctx.shadowBlur = highlightIndex === index ? this.highlightWidth * 0.18 : this.ghostWidth * 0.16;
        drawSmoothStroke(ctx, median, (pt) => this.toCanvas(pt));
      });
      ctx.shadowBlur = 0;
      if (this.medians.length) {
        this.medians.forEach((median, index) => {
          if (index !== 0 && highlightIndex !== index) return;
          const [sx, sy] = this.toCanvas(median[0]);
          const color = highlightIndex === index ? accent : ghostColor;
          ctx.fillStyle = color.trim() || "rgba(11,107,111,0.22)";
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
      ctx.strokeStyle = getComputedStyle(this.container).getPropertyValue("--stroke-user");
      ctx.lineWidth = this.userWidth;
      this.userStrokes.forEach((stroke) => {
        if (stroke.length < 2) return;
        drawSmoothStroke(ctx, stroke, (pt) => this.toCanvas(pt));
      });
    }

    clearUser() {
      this.userStrokes = [];
      this.currentStroke = [];
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
        if (type === "start") {
          this.currentStroke = [this.toModel(point)];
          this.drawCtx.lineCap = "round";
          this.drawCtx.lineJoin = "round";
          this.drawCtx.strokeStyle = getComputedStyle(this.container).getPropertyValue("--stroke-user");
          this.drawCtx.lineWidth = this.userWidth;
          this.drawCtx.beginPath();
          const [cx, cy] = point;
          this.drawCtx.moveTo(cx, cy);
        }
        if (type === "move" && this.currentStroke.length) {
          const prev = this.currentStroke[this.currentStroke.length - 1];
          const modelPoint = this.toModel(point);
          if (distance(prev, modelPoint) < 4) return;
          this.currentStroke.push(modelPoint);
          this.drawCtx.lineTo(point[0], point[1]);
          this.drawCtx.stroke();
        }
        if (type === "end" && this.currentStroke.length) {
          const stroke = [...this.currentStroke];
          this.userStrokes.push(stroke);
          this.currentStroke = [];
          if (!this.medians.length) {
            if (this.onScore) {
              this.onScore({
                score: null,
                overall: null,
                strokeIndex: null,
                userStrokeCount: this.userStrokes.length,
              });
            }
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
        }
      };

      this.container.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        this.container.setPointerCapture(event.pointerId);
        handlePointer(event, "start");
      });
      this.container.addEventListener("pointermove", (event) => handlePointer(event, "move"));
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
          const color = accent.trim() || "#0b6b6f";
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

  const mount = (container, hostApi, initialState = {}) => {
    const root = document.createElement("div");
    root.className = "hanzi-root";
    root.innerHTML = template;
    container.appendChild(root);
    if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "")) {
      root.style.paddingTop = "25px";
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
    const STORAGE_KEY = "hanzi_atelier_state_v1";

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
      if (index === null || index === undefined) return;
      if (!state.medians.length || index < 0 || index >= state.medians.length) {
        return;
      }
      if (writerLayer && writerLayer.ready) {
        writerLayer.showHint(index);
      } else {
        engine.showHint(index);
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
          ghost: styles.getPropertyValue("--stroke-ghost").trim() || "rgba(11,107,111,0.22)",
          accent: styles.getPropertyValue("--accent").trim() || "#0b6b6f",
          user: styles.getPropertyValue("--stroke-user").trim() || "rgba(15,139,141,0.9)",
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
      if (target.closest("button, a, input, textarea")) return false;
      if (target.closest(".canvas-shell")) return false;
      if (target.closest(".examples-panel")) return false;
      if (target.closest(".examples-list")) return false;
      return true;
    };
    const hasActiveSelection = () => {
      if (typeof window === "undefined") return false;
      const selection = window.getSelection();
      return !!selection && !selection.isCollapsed;
    };
    const onSwipeStart = (event) => {
      if (event.pointerType === "touch") return;
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
      if (!swipeState.active || swipeState.hasNavigated) return;
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
      if (state.historyIndex <= 0) return;
      clearScoreBurst();
      wheelState.accumulator = 0;
      wheelState.hasNavigated = true;
      logNav("prev");
      await goToHistoryIndex(state.historyIndex - 1);
    };

    const goNext = async () => {
      clearScoreBurst();
      wheelState.accumulator = 0;
      wheelState.hasNavigated = true;
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
        if (action === "hint") {
          showGuidedHint(engine.currentStrokeIndex, { force: true });
        }
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
