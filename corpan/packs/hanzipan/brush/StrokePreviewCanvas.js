/**
 * StrokePreviewCanvas - Interactive test canvas for brush preview
 * Shows live strokes with current brush settings and auto-demo animation.
 */

export class StrokePreviewCanvas {
  constructor(options = {}) {
    const {
      container,
      width = 280,
      height = 140,
      getConfig,
      getColors,
    } = options;

    this.container = container;
    this.width = width;
    this.height = height;
    this.getConfig = getConfig || (() => ({}));
    this.getColors = getColors || (() => ({ stroke: '#0f8b8d' }));

    this.strokes = [];
    this.currentStroke = [];
    this.currentInkStroke = [];
    this.strokeState = null;
    this.demoTimer = null;
    this.demoRaf = null;
    this.idleTimeout = null;

    this._createDOM();
    this._attachEvents();
    this._scheduleDemoAfterIdle();
  }

  _createDOM() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'stroke-preview-wrapper';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stroke-preview-canvas';
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.clearBtn = document.createElement('button');
    this.clearBtn.className = 'stroke-preview-clear';
    this.clearBtn.type = 'button';
    this.clearBtn.textContent = 'Clear';
    this.clearBtn.addEventListener('click', () => this.clear());

    this.wrapper.appendChild(this.canvas);
    this.wrapper.appendChild(this.clearBtn);

    if (this.container) {
      this.container.appendChild(this.wrapper);
    }
  }

  _attachEvents() {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const distance = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

    const normalizePressure = (e) => {
      const raw = typeof e.pressure === 'number' ? e.pressure : 0;
      if (raw > 0) return clamp(raw, 0.05, 1);
      if (e.pointerType === 'mouse') return 0.6;
      if (e.pointerType === 'pen') return 0.55;
      return 0.45;
    };

    const getTime = (e) => {
      if (typeof e.timeStamp === 'number' && e.timeStamp > 0) return e.timeStamp;
      return performance.now();
    };

    const computeWidth = (baseWidth, pressure, velocity) => {
      const config = this.getConfig();
      const pressureExp = config.pressureExponent || 0.75;
      const pressureInf = config.pressureInfluence || 0.55;
      const velInf = config.velocityInfluence || 0.5;
      const velRange = config.velocityRange || 2.0;
      const minFactor = config.minWidthFactor || 0.5;
      const maxFactor = config.maxWidthFactor || 1.6;

      const pressureValue = Math.pow(clamp(pressure, 0, 1), pressureExp);
      const pressureFactor = lerp(1 - pressureInf, 1 + pressureInf, pressureValue);
      const velocityNorm = clamp(velocity / velRange, 0, 1);
      const speedFactor = config.velocityInverted ? velocityNorm : 1 - velocityNorm;
      const velocityFactor = lerp(1 - velInf, 1, speedFactor);
      const width = baseWidth * pressureFactor * velocityFactor;
      return clamp(width, baseWidth * minFactor, baseWidth * maxFactor);
    };

    const drawSegment = (ctx, from, to, fromWidth, toWidth) => {
      const segLen = distance(from, to);
      if (segLen === 0) {
        ctx.beginPath();
        ctx.arc(from[0], from[1], fromWidth * 0.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const steps = Math.max(1, Math.round((segLen / Math.max(fromWidth, toWidth, 1)) * 0.6));
      let [px, py] = from;
      for (let i = 1; i <= steps; i++) {
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

    const startStroke = (point, pressure, time) => {
      this._cancelDemo();
      this.currentStroke = [];
      this.currentInkStroke = [];
      const config = this.getConfig();
      const baseWidth = 8 * (config.baseWidthMultiplier || 1.0);
      const startTaperMin = config.startTaperMin || 0.35;
      const width = computeWidth(baseWidth, pressure, 0) * startTaperMin;

      this.strokeState = {
        lastPoint: point,
        filteredPoint: point,
        lastVelocity: 0,
        lastWidth: width,
        lastTime: time,
        lastPressure: pressure,
        length: 0,
        baseWidth,
      };

      const colors = this.getColors();
      this.ctx.strokeStyle = colors.stroke || '#0f8b8d';
      this.ctx.fillStyle = colors.stroke || '#0f8b8d';
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.arc(point[0], point[1], width * 0.5, 0, Math.PI * 2);
      this.ctx.fill();

      this.currentStroke.push(point);
      this.currentInkStroke.push({ point, width });
    };

    const moveStroke = (point, pressure, time) => {
      if (!this.strokeState) return;
      const config = this.getConfig();
      const posSmooth = config.positionSmoothing || 0.2;
      const velSmooth = config.velocitySmoothing || 0.25;
      const widthSmooth = config.widthSmoothing || 0.3;
      const startTaperDist = config.startTaperDistance || 1.8;
      const startTaperMin = config.startTaperMin || 0.35;
      const minDistFactor = 0.3;

      const state = this.strokeState;
      const baseWidth = state.baseWidth;

      const filtered = [
        lerp(state.filteredPoint[0], point[0], 1 - posSmooth),
        lerp(state.filteredPoint[1], point[1], 1 - posSmooth),
      ];
      state.filteredPoint = filtered;

      const minDist = Math.max(0.6, baseWidth * minDistFactor);
      const segDist = distance(state.lastPoint, filtered);
      if (segDist < minDist) return;

      const dt = Math.max(time - state.lastTime, 1);
      const velocity = segDist / dt;
      const smoothVel = lerp(state.lastVelocity, velocity, velSmooth);

      let targetWidth = computeWidth(baseWidth, pressure, smoothVel);
      const taper = clamp(
        (state.length + segDist) / (baseWidth * startTaperDist),
        startTaperMin,
        1
      );
      targetWidth *= taper;
      const smoothWidth = lerp(state.lastWidth, targetWidth, widthSmooth);

      drawSegment(this.ctx, state.lastPoint, filtered, state.lastWidth, smoothWidth);

      state.lastPoint = filtered;
      state.lastVelocity = smoothVel;
      state.lastWidth = smoothWidth;
      state.lastTime = time;
      state.length += segDist;

      this.currentStroke.push(filtered);
      this.currentInkStroke.push({ point: filtered, width: smoothWidth });
    };

    const finishStroke = () => {
      if (!this.currentInkStroke.length) {
        this.strokeState = null;
        return;
      }
      // Apply end taper
      const config = this.getConfig();
      const taperPoints = config.endTaperPoints || 6;
      const taperStrength = config.endTaperStrength || 0.5;
      const count = Math.min(this.currentInkStroke.length, taperPoints);
      if (count >= 2) {
        for (let i = 0; i < count; i++) {
          const idx = this.currentInkStroke.length - count + i;
          const t = i / (count - 1);
          const fade = lerp(1, 1 - taperStrength, t);
          this.currentInkStroke[idx].width *= Math.max(0.05, fade);
        }
      }

      this.strokes.push([...this.currentInkStroke]);
      this.currentStroke = [];
      this.currentInkStroke = [];
      this.strokeState = null;
      this._redraw();
      this._scheduleDemoAfterIdle();
    };

    const handlePointer = (e, type) => {
      const rect = this.canvas.getBoundingClientRect();
      const point = [e.clientX - rect.left, e.clientY - rect.top];
      const pressure = normalizePressure(e);
      const time = getTime(e);

      if (type === 'start') {
        startStroke(point, pressure, time);
      } else if (type === 'move') {
        moveStroke(point, pressure, time);
      } else if (type === 'end') {
        if (this.strokeState) {
          moveStroke(point, pressure, time);
        }
        finishStroke();
      }
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.canvas.setPointerCapture(e.pointerId);
      handlePointer(e, 'start');
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
      events.forEach((ev) => handlePointer(ev, 'move'));
    });

    this.canvas.addEventListener('pointerup', (e) => handlePointer(e, 'end'));
    this.canvas.addEventListener('pointercancel', (e) => handlePointer(e, 'end'));
    this.canvas.addEventListener('pointerleave', (e) => handlePointer(e, 'end'));
  }

  _redraw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const colors = this.getColors();
    ctx.strokeStyle = colors.stroke || '#0f8b8d';
    ctx.fillStyle = colors.stroke || '#0f8b8d';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lerp = (a, b, t) => a + (b - a) * t;
    const distance = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

    const drawSegment = (from, to, fromWidth, toWidth) => {
      const segLen = distance(from, to);
      if (segLen === 0) {
        ctx.beginPath();
        ctx.arc(from[0], from[1], fromWidth * 0.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const steps = Math.max(1, Math.round((segLen / Math.max(fromWidth, toWidth, 1)) * 0.6));
      let [px, py] = from;
      for (let i = 1; i <= steps; i++) {
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

    this.strokes.forEach((stroke) => {
      if (stroke.length === 0) return;
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].point[0], stroke[0].point[1], stroke[0].width * 0.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      let prev = stroke[0];
      for (let i = 1; i < stroke.length; i++) {
        const next = stroke[i];
        drawSegment(prev.point, next.point, prev.width, next.width);
        prev = next;
      }
    });
  }

  _scheduleDemoAfterIdle() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      if (this.strokes.length === 0) {
        this._runDemo();
      }
    }, 3000);
  }

  _cancelDemo() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
    if (this.demoTimer) {
      clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
    if (this.demoRaf) {
      cancelAnimationFrame(this.demoRaf);
      this.demoRaf = null;
    }
  }

  _runDemo() {
    this._cancelDemo();
    this.clear();

    // Demo path: a nice curved stroke
    const w = this.width;
    const h = this.height;
    const demoPath = [
      { x: w * 0.15, y: h * 0.5, p: 0.3 },
      { x: w * 0.25, y: h * 0.35, p: 0.5 },
      { x: w * 0.4, y: h * 0.3, p: 0.7 },
      { x: w * 0.55, y: h * 0.4, p: 0.85 },
      { x: w * 0.65, y: h * 0.6, p: 0.75 },
      { x: w * 0.75, y: h * 0.65, p: 0.6 },
      { x: w * 0.85, y: h * 0.5, p: 0.4 },
    ];

    let step = 0;
    const totalSteps = demoPath.length * 8;
    let time = performance.now();

    const animate = () => {
      const progress = step / totalSteps;
      const pathIndex = Math.floor(progress * (demoPath.length - 1));
      const localT = (progress * (demoPath.length - 1)) % 1;

      const from = demoPath[Math.min(pathIndex, demoPath.length - 1)];
      const to = demoPath[Math.min(pathIndex + 1, demoPath.length - 1)];

      const lerp = (a, b, t) => a + (b - a) * t;
      const point = [
        lerp(from.x, to.x, localT),
        lerp(from.y, to.y, localT),
      ];
      const pressure = lerp(from.p, to.p, localT);
      const now = performance.now();

      if (step === 0) {
        const config = this.getConfig();
        const baseWidth = 8 * (config.baseWidthMultiplier || 1.0);
        const startTaperMin = config.startTaperMin || 0.35;
        const width = baseWidth * 0.6 * startTaperMin;

        this.strokeState = {
          lastPoint: point,
          filteredPoint: point,
          lastVelocity: 0,
          lastWidth: width,
          lastTime: now,
          lastPressure: pressure,
          length: 0,
          baseWidth,
        };

        const colors = this.getColors();
        this.ctx.strokeStyle = colors.stroke || '#0f8b8d';
        this.ctx.fillStyle = colors.stroke || '#0f8b8d';
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.arc(point[0], point[1], width * 0.5, 0, Math.PI * 2);
        this.ctx.fill();

        this.currentInkStroke.push({ point, width });
      } else {
        // Simulate move
        const e = { pressure, timeStamp: now };
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const config = this.getConfig();
        const posSmooth = config.positionSmoothing || 0.2;
        const velSmooth = config.velocitySmoothing || 0.25;
        const widthSmooth = config.widthSmoothing || 0.3;
        const startTaperDist = config.startTaperDistance || 1.8;
        const startTaperMin = config.startTaperMin || 0.35;

        const state = this.strokeState;
        if (state) {
          const baseWidth = state.baseWidth;
          const filtered = [
            lerp(state.filteredPoint[0], point[0], 1 - posSmooth),
            lerp(state.filteredPoint[1], point[1], 1 - posSmooth),
          ];
          state.filteredPoint = filtered;

          const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
          const segDist = dist(state.lastPoint, filtered);
          const dt = Math.max(now - state.lastTime, 1);
          const velocity = segDist / dt;
          const smoothVel = lerp(state.lastVelocity, velocity, velSmooth);

          const pressureExp = config.pressureExponent || 0.75;
          const pressureInf = config.pressureInfluence || 0.55;
          const velInf = config.velocityInfluence || 0.5;
          const velRange = config.velocityRange || 2.0;
          const minFactor = config.minWidthFactor || 0.5;
          const maxFactor = config.maxWidthFactor || 1.6;

          const pressureValue = Math.pow(clamp(pressure, 0, 1), pressureExp);
          const pressureFactor = lerp(1 - pressureInf, 1 + pressureInf, pressureValue);
          const velocityNorm = clamp(velocity / velRange, 0, 1);
          const speedFactor = config.velocityInverted ? velocityNorm : 1 - velocityNorm;
          const velocityFactor = lerp(1 - velInf, 1, speedFactor);
          let targetWidth = baseWidth * pressureFactor * velocityFactor;
          targetWidth = clamp(targetWidth, baseWidth * minFactor, baseWidth * maxFactor);

          const taper = clamp((state.length + segDist) / (baseWidth * startTaperDist), startTaperMin, 1);
          targetWidth *= taper;
          const smoothWidth = lerp(state.lastWidth, targetWidth, widthSmooth);

          // Draw segment
          const drawSeg = (from, to, fromW, toW) => {
            const segLen = dist(from, to);
            if (segLen === 0) return;
            const steps = Math.max(1, Math.round((segLen / Math.max(fromW, toW, 1)) * 0.6));
            let [px, py] = from;
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const x = lerp(from[0], to[0], t);
              const y = lerp(from[1], to[1], t);
              const w = lerp(fromW, toW, t);
              this.ctx.lineWidth = Math.max(0.5, w);
              this.ctx.beginPath();
              this.ctx.moveTo(px, py);
              this.ctx.lineTo(x, y);
              this.ctx.stroke();
              px = x;
              py = y;
            }
          };

          drawSeg(state.lastPoint, filtered, state.lastWidth, smoothWidth);

          state.lastPoint = filtered;
          state.lastVelocity = smoothVel;
          state.lastWidth = smoothWidth;
          state.lastTime = now;
          state.length += segDist;

          this.currentInkStroke.push({ point: filtered, width: smoothWidth });
        }
      }

      step++;
      time = now;

      if (step < totalSteps) {
        this.demoRaf = requestAnimationFrame(animate);
      } else {
        // Finish demo stroke
        const config = this.getConfig();
        const taperPoints = config.endTaperPoints || 6;
        const taperStrength = config.endTaperStrength || 0.5;
        const count = Math.min(this.currentInkStroke.length, taperPoints);
        if (count >= 2) {
          for (let i = 0; i < count; i++) {
            const idx = this.currentInkStroke.length - count + i;
            const t = i / (count - 1);
            const fade = lerp(1, 1 - taperStrength, t);
            this.currentInkStroke[idx].width *= Math.max(0.05, fade);
          }
        }
        this.strokes.push([...this.currentInkStroke]);
        this.currentInkStroke = [];
        this.strokeState = null;
        this._redraw();

        // Schedule next demo loop
        this.demoTimer = setTimeout(() => {
          this.clear();
          this._runDemo();
        }, 2000);
      }
    };

    this.demoRaf = requestAnimationFrame(animate);
  }

  clear() {
    this._cancelDemo();
    this.strokes = [];
    this.currentStroke = [];
    this.currentInkStroke = [];
    this.strokeState = null;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this._scheduleDemoAfterIdle();
  }

  refresh() {
    this._redraw();
  }

  getElement() {
    return this.wrapper;
  }

  destroy() {
    this._cancelDemo();
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

export default StrokePreviewCanvas;
