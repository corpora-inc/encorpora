/**
 * PressureCurveCanvas - Interactive bezier curve editor for pressure response
 * 200x200 canvas with two draggable control points.
 */

import { CURVE_PRESETS } from './presets.js';

export class PressureCurveCanvas {
  constructor(options = {}) {
    const {
      container,
      size = 200,
      onChange,
      initialCurve,
    } = options;

    this.container = container;
    this.size = size;
    this.onChange = onChange;
    this.controlPoints = initialCurve ? [...initialCurve] : [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 }
    ];
    this.dragging = null;
    this.hovered = null;

    this._createDOM();
    this._attachEvents();
    this._render();
  }

  _createDOM() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'pressure-curve-wrapper';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pressure-curve-canvas';
    this.canvas.width = this.size * 2; // Retina
    this.canvas.height = this.size * 2;
    this.canvas.style.width = `${this.size}px`;
    this.canvas.style.height = `${this.size}px`;
    this.ctx = this.canvas.getContext('2d');

    // Curve preset buttons
    this.presetsRow = document.createElement('div');
    this.presetsRow.className = 'pressure-curve-presets';

    const presetButtons = [
      { key: 'linear', label: 'Linear' },
      { key: 'soft', label: 'Soft' },
      { key: 'firm', label: 'Firm' },
      { key: 'sCurve', label: 'S-Curve' },
    ];

    presetButtons.forEach(({ key, label }) => {
      const btn = document.createElement('button');
      btn.className = 'curve-preset-btn';
      btn.textContent = label;
      btn.type = 'button';
      btn.addEventListener('click', () => this._applyPreset(key));
      this.presetsRow.appendChild(btn);
    });

    this.wrapper.appendChild(this.canvas);
    this.wrapper.appendChild(this.presetsRow);

    if (this.container) {
      this.container.appendChild(this.wrapper);
    }
  }

  _attachEvents() {
    const getPoint = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: 1 - (e.clientY - rect.top) / rect.height,
      };
    };

    const hitTest = (pos) => {
      const threshold = 0.08;
      for (let i = 0; i < this.controlPoints.length; i++) {
        const cp = this.controlPoints[i];
        const dx = pos.x - cp.x;
        const dy = pos.y - cp.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          return i;
        }
      }
      return null;
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const pos = getPoint(e);
      const hit = hitTest(pos);
      if (hit !== null) {
        this.dragging = hit;
        this.canvas.setPointerCapture(e.pointerId);
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const pos = getPoint(e);
      if (this.dragging !== null) {
        const clamp = (v) => Math.max(0, Math.min(1, v));
        this.controlPoints[this.dragging] = {
          x: clamp(pos.x),
          y: clamp(pos.y),
        };
        this._render();
        this._emitChange();
      } else {
        const hit = hitTest(pos);
        if (hit !== this.hovered) {
          this.hovered = hit;
          this.canvas.style.cursor = hit !== null ? 'grab' : 'default';
          this._render();
        }
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.dragging !== null) {
        this.canvas.releasePointerCapture(e.pointerId);
        this.dragging = null;
        this.canvas.style.cursor = 'default';
      }
    });

    this.canvas.addEventListener('pointerleave', () => {
      if (this.dragging === null) {
        this.hovered = null;
        this._render();
      }
    });
  }

  _render() {
    const ctx = this.ctx;
    const size = this.size * 2;
    const pad = 20;
    const inner = size - pad * 2;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = 'rgba(251, 247, 240, 0.95)';
    ctx.fillRect(0, 0, size, size);

    // Grid lines at 25% intervals
    ctx.strokeStyle = 'rgba(11, 107, 111, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const p = pad + (inner * i) / 4;
      ctx.beginPath();
      ctx.moveTo(p, pad);
      ctx.lineTo(p, size - pad);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad, p);
      ctx.lineTo(size - pad, p);
      ctx.stroke();
    }

    // Diagonal reference line
    ctx.strokeStyle = 'rgba(11, 107, 111, 0.2)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, size - pad);
    ctx.lineTo(size - pad, pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bezier curve
    const toCanvas = (pt) => ({
      x: pad + pt.x * inner,
      y: size - pad - pt.y * inner,
    });

    const p0 = toCanvas({ x: 0, y: 0 });
    const p1 = toCanvas(this.controlPoints[0]);
    const p2 = toCanvas(this.controlPoints[1]);
    const p3 = toCanvas({ x: 1, y: 1 });

    ctx.strokeStyle = 'rgba(11, 107, 111, 0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    ctx.stroke();

    // Control point handles (lines to endpoints)
    ctx.strokeStyle = 'rgba(227, 108, 47, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Control points
    [p1, p2].forEach((pt, i) => {
      const isActive = this.dragging === i || this.hovered === i;
      const radius = isActive ? 14 : 10;

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? 'rgba(227, 108, 47, 1)' : 'rgba(227, 108, 47, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Axis labels
    ctx.fillStyle = 'rgba(95, 91, 87, 0.7)';
    ctx.font = '20px "Avenir Next", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Input', size / 2, size - 2);
    ctx.save();
    ctx.translate(12, size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Output', 0, 0);
    ctx.restore();
  }

  _applyPreset(key) {
    const preset = CURVE_PRESETS[key];
    if (!preset) return;
    this.controlPoints = preset.map(p => ({ ...p }));
    this._render();
    this._emitChange();
  }

  _emitChange() {
    if (typeof this.onChange === 'function') {
      this.onChange([...this.controlPoints]);
    }
  }

  setCurve(points) {
    if (!Array.isArray(points) || points.length !== 2) return;
    this.controlPoints = points.map(p => ({
      x: typeof p.x === 'number' ? p.x : 0.5,
      y: typeof p.y === 'number' ? p.y : 0.5,
    }));
    this._render();
  }

  getCurve() {
    return [...this.controlPoints];
  }

  getElement() {
    return this.wrapper;
  }

  destroy() {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

export default PressureCurveCanvas;
