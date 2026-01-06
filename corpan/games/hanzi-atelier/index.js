(() => {
  const GAME_ID = "hanzi_atelier";

  const template = `
    <div class="hanzi-app">
      <div class="hero">
        <div class="card char-card">
          <button class="exit-btn" data-action="exit">Exit</button>
          <div class="char-symbol" data-char></div>
          <div class="char-pinyin" data-pinyin></div>
          <button class="speak-main" data-action="speak">Speak</button>
          <div class="char-details">
            <span class="chip" data-radical></span>
            <span class="chip" data-strokes></span>
          </div>
          <div class="char-actions">
            <button class="primary-btn" data-action="next">Next</button>
            <button class="ghost-btn" data-action="replay">Replay</button>
          </div>
        </div>
        <div class="card ety-card">
          <div class="eyebrow">Etymology</div>
          <div class="ety-text" data-etymology></div>
          <div class="ety-lang" data-ety-lang></div>
        </div>
      </div>
      <div class="workspace">
        <div class="panel draw-panel">
          <div class="panel-header">
            <div class="panel-title">Write It</div>
            <div class="panel-controls">
              <button class="toggle-btn active" data-mode="guided">Guided</button>
              <button class="toggle-btn" data-mode="free">Free</button>
              <button class="toggle-btn" data-toggle="focus">Only with strokes</button>
            </div>
          </div>
          <div class="canvas-shell" data-canvas-shell>
            <canvas class="canvas-layer" data-ghost></canvas>
            <canvas class="canvas-layer" data-draw></canvas>
            <canvas class="canvas-layer" data-fx></canvas>
            <div class="canvas-overlay" data-overlay>Ready</div>
          </div>
          <div class="panel-actions">
            <div class="score" data-score>Score: --</div>
            <div class="action-buttons">
              <button class="action-btn" data-action="hint">Hint</button>
              <button class="action-btn" data-action="clear">Clear</button>
              <button class="action-btn secondary" data-action="next">Next</button>
            </div>
          </div>
        </div>
        <div class="panel examples-panel">
          <div class="panel-header">
            <div class="panel-title">Examples</div>
            <div class="panel-subtitle" data-example-count>0 loaded</div>
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

    resize() {
      const rect = this.drawCanvas.getBoundingClientRect();
      this.canvasRect = rect;
      const dpr = window.devicePixelRatio || 1;
      [this.ghostCanvas, this.drawCanvas, this.fxCanvas].forEach((canvas) => {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
      const padding = Math.min(rect.width, rect.height) * 0.08;
      const size = Math.min(rect.width, rect.height) - padding * 2;
      this.bounds = {
        x: (rect.width - size) / 2,
        y: (rect.height - size) / 2,
        size,
      };
      this.drawGhost();
      this.redrawUser();
    }

    toCanvas(point) {
      return [
        this.bounds.x + (point[0] / 1000) * this.bounds.size,
        this.bounds.y + ((1000 - point[1]) / 1000) * this.bounds.size,
      ];
    }

    toModel(point) {
      return [
        ((point[0] - this.bounds.x) / this.bounds.size) * 1000,
        1000 - ((point[1] - this.bounds.y) / this.bounds.size) * 1000,
      ];
    }

    drawGhost(highlightIndex = null) {
      const ctx = this.ghostCtx;
      ctx.clearRect(0, 0, this.ghostCanvas.width, this.ghostCanvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const ghostColor = getComputedStyle(this.container).getPropertyValue("--stroke-ghost");
      const accent = getComputedStyle(this.container).getPropertyValue("--accent-strong");
      this.medians.forEach((median, index) => {
        const color = highlightIndex === index ? accent : ghostColor;
        ctx.strokeStyle = color.trim() || "rgba(11,107,111,0.22)";
        ctx.lineWidth = highlightIndex === index ? 6 : 4;
        ctx.beginPath();
        median.forEach((pt, i) => {
          const [cx, cy] = this.toCanvas(pt);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.stroke();
        if (index === 0 || highlightIndex === index) {
          const [sx, sy] = this.toCanvas(median[0]);
          ctx.fillStyle = color.trim() || "rgba(11,107,111,0.22)";
          ctx.font = "12px 'Avenir Next', 'Futura', sans-serif";
          ctx.fillText(String(index + 1), sx + 6, sy - 6);
        }
      });
    }

    redrawUser() {
      const ctx = this.drawCtx;
      ctx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = getComputedStyle(this.container).getPropertyValue("--stroke-user");
      ctx.lineWidth = 8;
      this.userStrokes.forEach((stroke) => {
        if (stroke.length < 2) return;
        ctx.beginPath();
        stroke.forEach((pt, i) => {
          const [cx, cy] = this.toCanvas(pt);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.stroke();
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
        this.onScore({ score: null, overall: null, strokeIndex: null });
      }
    }

    flashStroke(median, score) {
      if (!median || median.length < 2) return;
      const ctx = this.fxCtx;
      ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const good = score >= 75;
      ctx.strokeStyle = good
        ? getComputedStyle(this.container).getPropertyValue("--stroke-user")
        : getComputedStyle(this.container).getPropertyValue("--stroke-wrong");
      ctx.lineWidth = 10;
      ctx.beginPath();
      median.forEach((pt, i) => {
        const [cx, cy] = this.toCanvas(pt);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
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
          this.drawCtx.lineWidth = 8;
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
              this.onScore({ score: null, overall: null, strokeIndex: null });
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
            this.flashStroke(this.medians[targetIndex], score);
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
            this.onScore({ score, overall, strokeIndex: targetIndex });
          }
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
      this.drawGhost(index);
    }

    replay() {
      const ctx = this.fxCtx;
      ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
      const accent = getComputedStyle(this.container).getPropertyValue("--accent");
      let strokeIndex = 0;
      const drawNext = () => {
        if (strokeIndex >= this.medians.length) return;
        const median = this.medians[strokeIndex];
        let t = 0;
        const step = () => {
          ctx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
          ctx.strokeStyle = accent.trim() || "#0b6b6f";
          ctx.lineWidth = 8;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          const length = Math.max(2, Math.floor(median.length * t));
          median.slice(0, length).forEach((pt, i) => {
            const [cx, cy] = this.toCanvas(pt);
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
          });
          ctx.stroke();
          t += 0.08;
          if (t < 1.1) {
            requestAnimationFrame(step);
          } else {
            strokeIndex += 1;
            setTimeout(drawNext, 120);
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

    const elChar = root.querySelector("[data-char]");
    const elPinyin = root.querySelector("[data-pinyin]");
    const elRadical = root.querySelector("[data-radical]");
    const elStrokes = root.querySelector("[data-strokes]");
    const elEtymology = root.querySelector("[data-etymology]");
    const elEtyLang = root.querySelector("[data-ety-lang]");
    const elScore = root.querySelector("[data-score]");
    const elOverlay = root.querySelector("[data-overlay]");
    const elExamples = root.querySelector("[data-examples]");
    const elExampleCount = root.querySelector("[data-example-count]");
    const elExamplesFooter = root.querySelector("[data-examples-footer]");
    const canvasShell = root.querySelector("[data-canvas-shell]");
    const ghostCanvas = root.querySelector("[data-ghost]");
    const drawCanvas = root.querySelector("[data-draw]");
    const fxCanvas = root.querySelector("[data-fx]");
    const modeButtons = root.querySelectorAll("[data-mode]");
    const focusButton = root.querySelector("[data-toggle='focus']");
    const actionButtons = root.querySelectorAll("[data-action]");

    const state = {
      stackConfig: initialState.stackConfig || hostApi.getStackConfig(),
      character: fallbackCharacter.char,
      pinyin: fallbackCharacter.pinyin,
      radical: fallbackCharacter.radical,
      strokeCount: fallbackCharacter.stroke_count,
      strokes: fallbackStrokes.strokes,
      medians: fallbackStrokes.medians,
      etymology: fallbackEtymology,
      etyLang: "en",
      mode: "guided",
      onlyWithStrokes: true,
      examples: [],
      examplesOffset: 0,
      loadingExamples: false,
      noMoreExamples: false,
      packDbAvailable: true,
      fallbackIndex: 0,
    };
    const pinyinCache = new Map();

    const engine = new DrawingEngine(canvasShell, ghostCanvas, drawCanvas, fxCanvas, ({ score, overall }) => {
      if (overall !== null) {
        elScore.textContent = `Score: ${overall}`;
        elOverlay.textContent = overall >= 85 ? "Crisp" : overall >= 70 ? "Nice" : "Try again";
      } else if (score !== null) {
        elScore.textContent = `Score: ${score}`;
      } else {
        elScore.textContent = "Score: --";
      }
    });

    const setMode = (mode) => {
      state.mode = mode;
      engine.setMode(mode);
      modeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.mode === mode));
    };

    const setFocus = (value) => {
      state.onlyWithStrokes = value;
      focusButton.classList.toggle("active", value);
    };

    const renderCharacter = () => {
      elChar.textContent = state.character;
      const cached = pinyinCache.get(state.character);
      const pinyin = cached || state.pinyin || fallbackPinyinMap[state.character] || "";
      if (pinyin) {
        pinyinCache.set(state.character, pinyin);
      }
      elPinyin.textContent = state.stackConfig.showRomanization ? pinyin : "";
      elRadical.textContent = state.radical ? `Radical ${state.radical}` : "Radical --";
      elStrokes.textContent = state.strokeCount ? `${state.strokeCount} strokes` : "Strokes --";
      elEtymology.textContent = state.etymology || "Etymology in progress.";
      elEtyLang.textContent = state.etyLang ? state.etyLang.toUpperCase() : "--";
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
        speak.textContent = "Speak";

        const zh = entry.translations.find((t) => t.language_code.startsWith("zh-"));
        const primary = zh || entry.translations[0];
        text.textContent = primary ? primary.text : "";
        romanization.textContent =
          state.stackConfig.showRomanization && primary && primary.romanization
            ? primary.romanization
            : "";
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
      elExampleCount.textContent = `${state.examples.length} loaded`;
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

    const loadCharacter = async () => {
      elOverlay.textContent = "Loading";
      const filter = state.onlyWithStrokes ? "WHERE stroke_count IS NOT NULL AND stroke_count > 0" : "";
      const result = await queryPackDb(
        `SELECT char, pinyin, stroke_count, radical FROM hanzi_character ${filter} ORDER BY RANDOM() LIMIT 1`
      );
      const row = result.rows[0];
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
      } else {
        state.character = row.char || fallbackCharacter.char;
        state.pinyin = row.pinyin || "";
        state.strokeCount =
          row.stroke_count !== undefined && row.stroke_count !== null
            ? row.stroke_count
            : null;
        state.radical = row.radical || "";

        const strokeRes = await queryPackDb(
          "SELECT strokes_json, medians_json FROM hanzi_strokes WHERE char = ? LIMIT 1",
          [state.character]
        );
        const strokeRow = strokeRes.rows[0];
        if (strokeRow) {
          try {
            state.strokes = JSON.parse(strokeRow.strokes_json || "[]");
            state.medians = JSON.parse(strokeRow.medians_json || "[]");
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
      engine.setCharacter({ medians: state.medians, strokes: state.strokes });
      state.examples = [];
      state.examplesOffset = 0;
      state.noMoreExamples = false;
      await loadExamples(true);
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

    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });

    focusButton.addEventListener("click", () => setFocus(!state.onlyWithStrokes));

    actionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "next") loadCharacter();
        if (action === "clear") engine.clearUser();
        if (action === "hint") engine.showHint(state.mode === "guided" ? engine.currentStrokeIndex : 0);
        if (action === "replay") engine.replay();
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

    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvasShell);

    if (hostApi.onStackConfigChange) {
      hostApi.onStackConfigChange((next) => {
        state.stackConfig = next;
        renderCharacter();
        renderExamples();
      });
    }

    renderCharacter();
    setFocus(state.onlyWithStrokes);
    loadCharacter();

    return {
      unmount: () => {
        resizeObserver.disconnect();
        elExamples.removeEventListener("scroll", onScroll);
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
