import React from 'react';
import type { FigureOf } from '../../spec';
import { A11ySvg, clamp, regionProps, series, tint, useMeasuredWidth, type TapInteraction } from './common';

type P = { x: number; y: number };
const sub = (a: P, b: P) => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: P) => Math.hypot(v.x, v.y) || 1;
const unit = (v: P) => { const l = len(v); return { x: v.x / l, y: v.y / l }; };

let markerSeq = 0;
export function GeometryFigure({ figure: f, tap }: { figure: FigureOf<'geometry'>; tap?: TapInteraction }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 620);
  const pad = 34;
  const scale = Math.min((W - pad * 2) / f.width, clamp(W * 0.8, 220, 440) / f.height);
  const w = f.width * scale + pad * 2, H = f.height * scale + pad * 2;
  const ox = (W - w) / 2 + pad;
  const S = (p: P): P => ({ x: ox + p.x * scale, y: pad + (f.height - p.y) * scale });
  const [mid] = React.useState(() => `ax-arrow${++markerSeq}`);
  const clipBase = mid.replace('arrow', 'clip');
  // Graph paper: light lines every grid.unit, a slightly stronger line every 5 units when there are many.
  const unitLen = f.grid?.unit ?? 1;
  const lattice = (extent: number) => Array.from({ length: Math.floor(extent / unitLen + 1e-6) + 1 }, (_, k) => k);
  const majorEvery = f.grid && Math.max(f.width, f.height) / unitLen > 10 ? 5 : 0;
  const paper = f.grid && (() => {
    const o = S({ x: 0, y: 0 }), e = S({ x: f.width, y: f.height });
    const line = (k: number, vertical: boolean) => {
      const major = majorEvery > 0 && k % majorEvery === 0;
      const v = k * unitLen;
      const a = vertical ? S({ x: v, y: 0 }) : S({ x: 0, y: v }), b = vertical ? S({ x: v, y: f.height }) : S({ x: f.width, y: v });
      return <line key={`${vertical ? 'v' : 'h'}${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={major ? 'ax-graph-major' : 'ax-graph-minor'} />;
    };
    return (
      <g className="ax-graph-paper" aria-hidden="true">
        <rect x={o.x} y={e.y} width={e.x - o.x} height={o.y - e.y} className="ax-graph-sheet" />
        {lattice(f.width).map(k => line(k, true))}
        {lattice(f.height).map(k => line(k, false))}
      </g>
    );
  })();
  const polys = f.shapes.filter(s => s.kind === 'polygon');
  const centroid = polys.length ? (() => { const all = polys.flatMap(p => p.points); return S({ x: all.reduce((s, p) => s + p.x, 0) / all.length, y: all.reduce((s, p) => s + p.y, 0) / all.length }); })() : S({ x: f.width / 2, y: f.height / 2 });

  const shapes = f.shapes.map((s, i) => {
    switch (s.kind) {
      case 'polygon': {
        const pts = s.points.map(S);
        const selected = !!s.id && tap?.selected === s.id;
        const region = s.id && tap ? regionProps(s.label ?? `shape ${s.id}`, selected, () => tap.onSelect(s.id!)) : {};
        const c = { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length };
        const d = pts.map(p => `${p.x},${p.y}`).join(' ');
        const clip = `${clipBase}-${i}`;
        // Unit squares: grid lines in the shape's own colour, clipped to its outline, so its area can be counted.
        const squares = s.unitSquares && (() => {
          const xs = s.points.map(p => p.x), ys = s.points.map(p => p.y);
          const steps = (lo: number, hi: number) => Array.from({ length: Math.max(0, Math.round((hi - lo) / unitLen) - 1) }, (_, k) => lo + (k + 1) * unitLen);
          const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
          return (
            <g clipPath={`url(#${clip})`} className="ax-unit-squares" stroke={selected ? 'var(--ax-coral)' : series(s.color, 0)} aria-hidden="true">
              {steps(x0, x1).map(x => { const a = S({ x, y: y0 }), b = S({ x, y: y1 }); return <line key={`x${x}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}
              {steps(y0, y1).map(y => { const a = S({ x: x0, y }), b = S({ x: x1, y }); return <line key={`y${y}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}
            </g>
          );
        })();
        const fill = selected ? 'var(--ax-coral-tint)' : s.color === 'plain' ? 'none' : tint(s.color, 0);
        const stroke = { stroke: selected ? 'var(--ax-coral)' : series(s.color, 0), strokeWidth: selected ? 3 : 2.25, strokeLinejoin: 'round' as const, strokeDasharray: s.dashed ? '7 5' : undefined };
        // On graph paper the fill is translucent so the paper's lines show through.
        const fillOpacity = f.grid && !selected ? 0.5 : undefined;
        return (
          <g key={i} {...region}>
            {squares ? <>
              <clipPath id={clip}><polygon points={d} /></clipPath>
              <polygon points={d} fill={fill} fillOpacity={fillOpacity} />
              {squares}
              <polygon points={d} fill="none" {...stroke} />
            </> : <polygon points={d} fill={fill} fillOpacity={fillOpacity} {...stroke} />}
            {s.label && <text x={c.x} y={c.y + 5} textAnchor="middle" className="ax-shape-label">{s.label}</text>}
          </g>
        );
      }
      case 'circle': {
        const c = S(s.center);
        const selected = !!s.id && tap?.selected === s.id;
        const region = s.id && tap ? regionProps(s.label ?? `circle ${s.id}`, selected, () => tap.onSelect(s.id!)) : {};
        return (
          <g key={i} {...region}>
            <circle cx={c.x} cy={c.y} r={s.r * scale} fill={selected ? 'var(--ax-coral-tint)' : s.color === 'plain' ? 'none' : tint(s.color, 1)} stroke={selected ? 'var(--ax-coral)' : series(s.color, 1)} strokeWidth={selected ? 3 : 2.25} />
            {s.label && <text x={c.x} y={c.y + 5} textAnchor="middle" className="ax-shape-label">{s.label}</text>}
          </g>
        );
      }
      case 'segment': {
        const a = S(s.from), b = S(s.to);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ax-ink)" strokeWidth={2} strokeLinecap="round" strokeDasharray={s.dashed ? '6 5' : undefined}
          markerEnd={s.arrows === 'end' || s.arrows === 'both' ? `url(#${mid})` : undefined} markerStart={s.arrows === 'both' ? `url(#${mid})` : undefined} />;
      }
      case 'angle': {
        const v = S(s.vertex), fromS = S(s.from), toS = S(s.to);
        const a = unit(sub(fromS, v)), b = unit(sub(toS, v));
        const shortest = Math.min(len(sub(fromS, v)), len(sub(toS, v)));
        if (s.right) {
          const k = clamp(shortest * 0.12, 11, 20);
          return <path key={i} d={`M${v.x + a.x * k} ${v.y + a.y * k}L${v.x + (a.x + b.x) * k} ${v.y + (a.y + b.y) * k}L${v.x + b.x * k} ${v.y + b.y * k}`} fill="none" stroke="var(--ax-ink)" strokeWidth={1.5} />;
        }
        // Adjacent angles at one vertex get stepped radii so each arc reads separately.
        const nth = f.shapes.slice(0, i).filter(o => o.kind === 'angle' && !o.right && o.vertex.x === s.vertex.x && o.vertex.y === s.vertex.y).length;
        const r = clamp(shortest * 0.2, 22, 52) + nth * 12;
        const sweep = a.x * b.y - a.y * b.x > 0 ? 1 : 0;
        const bis = unit({ x: a.x + b.x, y: a.y + b.y });
        const lr = r + 12 + (s.label?.length ?? 0) * 3.2;
        const p0 = `${v.x + a.x * r} ${v.y + a.y * r}`, p1 = `${v.x + b.x * r} ${v.y + b.y * r}`;
        return (
          <g key={i}>
            <path d={`M${v.x} ${v.y}L${p0}A${r} ${r} 0 0 ${sweep} ${p1}Z`} fill="var(--ax-coral)" fillOpacity={0.12} />
            <path d={`M${p0}A${r} ${r} 0 0 ${sweep} ${p1}`} fill="none" stroke="var(--ax-coral)" strokeWidth={2} />
            {s.label && <text x={v.x + bis.x * lr} y={v.y + bis.y * lr + 5} textAnchor="middle" className="ax-angle-label">{s.label}</text>}
          </g>
        );
      }
      case 'ticks': {
        const a = S(s.from), b = S(s.to), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d = unit(sub(b, a)), n = { x: -d.y, y: d.x };
        return <g key={i}>{Array.from({ length: s.count }, (_, k) => { const off = (k - (s.count - 1) / 2) * 5; const c = { x: m.x + d.x * off, y: m.y + d.y * off }; return <line key={k} x1={c.x - n.x * 7} y1={c.y - n.y * 7} x2={c.x + n.x * 7} y2={c.y + n.y * 7} stroke="var(--ax-ink)" strokeWidth={2} strokeLinecap="round" />; })}</g>;
      }
      case 'dimension': {
        const a = S(s.from), b = S(s.to), d = unit(sub(b, a));
        let n = { x: -d.y, y: d.x };
        const m0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if ((m0.x - centroid.x) * n.x + (m0.y - centroid.y) * n.y < 0) n = { x: -n.x, y: -n.y };
        const off = 18, A = { x: a.x + n.x * off, y: a.y + n.y * off }, B = { x: b.x + n.x * off, y: b.y + n.y * off };
        const m = { x: (A.x + B.x) / 2 + n.x * 14, y: (A.y + B.y) / 2 + n.y * 14 };
        const pillW = s.label.length * 7.6 + 16;
        return (
          <g key={i} className="ax-dimension">
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} />
            <line x1={A.x - n.x * 5} y1={A.y - n.y * 5} x2={A.x + n.x * 5} y2={A.y + n.y * 5} />
            <line x1={B.x - n.x * 5} y1={B.y - n.y * 5} x2={B.x + n.x * 5} y2={B.y + n.y * 5} />
            <rect x={m.x - pillW / 2} y={m.y - 11} width={pillW} height={22} rx={11} className="ax-pill" />
            <text x={m.x} y={m.y + 5} textAnchor="middle" className="ax-dimension-label">{s.label}</text>
          </g>
        );
      }
      case 'label': { const p = S(s.at); return <text key={i} x={p.x} y={p.y + 5} textAnchor="middle" className="ax-free-label">{s.text}</text>; }
      case 'point': {
        const p = S(s.at);
        const dx = p.x < centroid.x ? -9 : 9, dy = p.y < centroid.y ? -9 : 17;
        return <g key={i}><circle cx={p.x} cy={p.y} r={4} fill="var(--ax-ink)" />{s.label && <text x={p.x + dx} y={p.y + dy} textAnchor={dx < 0 ? 'end' : 'start'} className="ax-vertex-label">{s.label}</text>}</g>;
      }
    }
  });
  return (
    <div ref={ref} className="ax-chart">
      <A11ySvg title="Geometry diagram" desc={f.alt} interactive={!!tap} width={W} height={H}>
        <defs><marker id={mid} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ax-ink)" /></marker></defs>
        {paper}
        {shapes}
      </A11ySvg>
      {f.notToScale && <p className="ax-chart-note">Not drawn to scale</p>}
    </div>
  );
}
