import React, { useMemo } from 'react';
import type { FigureOf } from '../../spec';
import { evaluate, parseExpr } from '../../expr';
import { snapToGrid } from '../../spec';
import { A11ySvg, clamp, fmt, regionProps, series, useMeasuredWidth, type PlotInteraction, type TapInteraction } from './common';

let clipSeq = 0;
export function CoordinatePlaneFigure({ figure: f, tap, plot }: { figure: FigureOf<'coordinate_plane'>; tap?: TapInteraction; plot?: PlotInteraction }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 620);
  const xs = f.x.step ?? 1, ys = f.y.step ?? 1;
  const xSpan = f.x.max - f.x.min, ySpan = f.y.max - f.y.min;
  const pad = { l: 34, r: 22, t: 20, b: 30 };
  const maxPlotH = clamp(W * 1.0, 240, 520);
  // Equal unit lengths keep slopes and shapes honest whenever the aspect allows it.
  const availW = W - pad.l - pad.r;
  let ux: number, uy: number;
  if (xs === ys) { ux = uy = Math.min(availW / xSpan, maxPlotH / ySpan); }
  else { ux = availW / xSpan; uy = clamp(availW * 0.75, 200, maxPlotH) / ySpan; }
  const pw = xSpan * ux, ph = ySpan * uy;
  const ox = pad.l + ((W - pad.l - pad.r) - pw) / 2;
  const H = Math.round(ph + pad.t + pad.b);
  const X = (v: number) => ox + (v - f.x.min) * ux;
  const Y = (v: number) => pad.t + (f.y.max - v) * uy;
  const [clipId] = React.useState(() => `ax-clip${++clipSeq}`);
  const grid = (min: number, max: number, step: number) => { const out: number[] = []; for (let v = Math.ceil(min / step - 1e-9) * step, i = 0; v <= max + 1e-9 && i < 81; v += step, i++) out.push(+v.toPrecision(12)); return out; };
  const gx = grid(f.x.min, f.x.max, xs), gy = grid(f.y.min, f.y.max, ys);
  const labelEveryX = Math.max(1, Math.ceil(26 / (xs * ux))), labelEveryY = Math.max(1, Math.ceil(20 / (ys * uy)));
  const ax0 = f.y.min <= 0 && f.y.max >= 0 ? Y(0) : Y(f.y.min);
  const ay0 = f.x.min <= 0 && f.x.max >= 0 ? X(0) : X(f.x.min);
  const curves = useMemo(() => (f.functions ?? []).map(fn => {
    try {
      const tree = parseExpr(fn.expr, ['x']);
      const from = fn.from ?? f.x.min, to = fn.to ?? f.x.max, n = 240;
      const segs: string[] = []; let cur = '';
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = from + ((to - from) * i) / n, y = evaluate(tree, { x });
        const ok = Number.isFinite(y) && Math.abs(y - (f.y.min + f.y.max) / 2) < ySpan * 4;
        if (ok) { cur += `${cur ? 'L' : 'M'}${X(x).toFixed(2)} ${Y(y).toFixed(2)}`; pts.push([X(x), Y(y)]); }
        else if (cur) { segs.push(cur); cur = ''; }
      }
      if (cur) segs.push(cur);
      let shade = '';
      if (fn.shade && pts.length > 1) {
        const edge = fn.shade === 'above' ? pad.t - 2 : pad.t + ph + 2;
        shade = `M${pts[0]![0]} ${edge}` + pts.map(([px, py]) => `L${px} ${py}`).join('') + `L${pts.at(-1)![0]} ${edge}Z`;
      }
      return { d: segs.join(''), shade, end: pts.at(-1) };
    } catch { return { d: '', shade: '', end: undefined }; }
  }), [f, ux, uy]); // eslint-disable-line react-hooks/exhaustive-deps

  const toData = (clientX: number, clientY: number, rect: DOMRect) => {
    const sx = (clientX - rect.left) * (W / rect.width), sy = (clientY - rect.top) * (H / rect.height);
    const { snap } = plot!;
    const x = snapToGrid(f.x.min + (sx - ox) / ux, snap.x, f.x.min, f.x.max) ?? f.x.min;
    const y = snapToGrid(f.y.max - (sy - pad.t) / uy, snap.y, f.y.min, f.y.max) ?? f.y.min;
    return { x, y };
  };
  const onPointer = plot ? (e: React.PointerEvent<SVGSVGElement>) => plot.onPlot(toData(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())) : undefined;
  const onKey = plot ? (e: React.KeyboardEvent<SVGSVGElement>) => {
    const { snap } = plot;
    const p = plot.point ?? { x: snapToGrid(0, snap.x, f.x.min, f.x.max) ?? f.x.min, y: snapToGrid(0, snap.y, f.y.min, f.y.max) ?? f.y.min };
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    plot.onPlot({ x: snapToGrid(p.x + step[0] * snap.x, snap.x, f.x.min, f.x.max) ?? p.x, y: snapToGrid(p.y + step[1] * snap.y, snap.y, f.y.min, f.y.max) ?? p.y });
  } : undefined;

  return (
    <div ref={ref} className={`ax-chart ax-plane${plot ? ' is-plottable' : ''}`}>
      {(f.functions ?? []).some(fn => fn.label) && (
        <ul className="ax-legend" aria-hidden="true">
          {(f.functions ?? []).map((fn, i) => fn.label && <li key={i}><span className="ax-swatch is-line" style={{ background: series(undefined, i) }} />{fn.label}</li>)}
        </ul>
      )}
      <A11ySvg title="Coordinate plane" desc={f.alt + (plot ? ' Tap the plane, or focus it and use the arrow keys, to place your point.' : '')}
        interactive={!!(tap || plot)} width={W} height={H} onPointerDown={onPointer} onKeyDown={onKey} tabIndex={plot ? 0 : undefined}>
        <defs><clipPath id={clipId}><rect x={ox} y={pad.t} width={pw} height={ph} /></clipPath></defs>
        <rect x={ox} y={pad.t} width={pw} height={ph} className="ax-plane-bg" />
        {gx.map(v => <line key={`gx${v}`} x1={X(v)} x2={X(v)} y1={pad.t} y2={pad.t + ph} className="ax-grid" />)}
        {gy.map(v => <line key={`gy${v}`} y1={Y(v)} y2={Y(v)} x1={ox} x2={ox + pw} className="ax-grid" />)}
        <g clipPath={`url(#${clipId})`}>
          {(f.polygons ?? []).map((p, i) => <polygon key={i} points={p.points.map(q => `${X(q.x)},${Y(q.y)}`).join(' ')} fill={series(p.color, i)} fillOpacity={0.16} stroke={series(p.color, i)} strokeWidth={2} strokeLinejoin="round" />)}
          {curves.map((c, i) => c.shade && <path key={`s${i}`} d={c.shade} fill={series(undefined, i)} fillOpacity={0.12} />)}
        </g>
        <line x1={ox} x2={ox + pw} y1={ax0} y2={ax0} className="ax-axis-strong" />
        <line x1={ay0} x2={ay0} y1={pad.t} y2={pad.t + ph} className="ax-axis-strong" />
        <text x={ox + pw + 4} y={ax0 - 6} textAnchor="end" className="ax-axis-name">{f.xLabel ?? 'x'}</text>
        <text x={ay0 + 6} y={pad.t + 12} className="ax-axis-name">{f.yLabel ?? 'y'}</text>
        <g clipPath={`url(#${clipId})`}>
          {curves.map((c, i) => <path key={`c${i}`} d={c.d} fill="none" stroke={series(undefined, i)} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={f.functions![i]!.dashed ? '8 6' : undefined} />)}
          {(f.segments ?? []).map((s, i) => <line key={i} x1={X(s.from.x)} y1={Y(s.from.y)} x2={X(s.to.x)} y2={Y(s.to.y)} stroke="var(--ax-ink)" strokeWidth={2} strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined} />)}
        </g>
        {gx.map((v, i) => (i % labelEveryX || v === 0 && f.x.min < 0) ? null : <text key={`lx${v}`} x={X(v)} y={Math.min(ax0 + 16, pad.t + ph + 18)} textAnchor="middle" className="ax-tick">{fmt(v)}</text>)}
        {gy.map((v, i) => (i % labelEveryY || v === 0 && f.y.min < 0) ? null : <text key={`ly${v}`} x={Math.max(ay0 - 6, ox - 6)} y={Y(v) + 4} textAnchor="end" className="ax-tick">{fmt(v)}</text>)}
        {f.x.min < 0 && f.y.min < 0 && uy * labelEveryY >= 28 && <text x={X(0) - 5} y={Y(0) + 15} textAnchor="end" className="ax-tick">0</text>}
        {(f.polygons ?? []).map((p, i) => p.label && <text key={`pl${i}`} x={p.points.reduce((s, q) => s + X(q.x), 0) / p.points.length} y={p.points.reduce((s, q) => s + Y(q.y), 0) / p.points.length + 4} textAnchor="middle" className="ax-shape-label">{p.label}</text>)}
        {(f.points ?? []).map((p, i) => {
          const selected = !!p.id && tap?.selected === p.id;
          const region = p.id && tap ? regionProps(p.label ?? `point ${p.id}`, selected, () => tap.onSelect(p.id!)) : {};
          const right = X(p.x) < ox + pw - 40;
          return (
            <g key={i} {...region}>
              {p.id && tap && <circle cx={X(p.x)} cy={Y(p.y)} r={20} className="ax-hit" />}
              <circle cx={X(p.x)} cy={Y(p.y)} r={selected ? 8 : 6} fill={p.open ? 'var(--ax-card)' : selected ? 'var(--ax-teal)' : 'var(--ax-coral)'} stroke={p.open ? 'var(--ax-coral)' : 'var(--ax-card)'} strokeWidth={p.open ? 2.5 : 2} />
              {p.label && <text x={X(p.x) + (right ? 10 : -10)} y={Y(p.y) - 9} textAnchor={right ? 'start' : 'end'} className="ax-point-label">{p.label}</text>}
            </g>
          );
        })}
        {plot?.point && (
          <g className="ax-plotted" aria-hidden="true">
            <line x1={X(plot.point.x)} x2={X(plot.point.x)} y1={ax0} y2={Y(plot.point.y)} className="ax-guide" />
            <line y1={Y(plot.point.y)} y2={Y(plot.point.y)} x1={ay0} x2={X(plot.point.x)} className="ax-guide" />
            <circle cx={X(plot.point.x)} cy={Y(plot.point.y)} r={14} fill="var(--ax-teal)" fillOpacity={0.18} />
            <circle cx={X(plot.point.x)} cy={Y(plot.point.y)} r={7} fill="var(--ax-teal)" stroke="var(--ax-card)" strokeWidth={2} />
          </g>
        )}
      </A11ySvg>
    </div>
  );
}
