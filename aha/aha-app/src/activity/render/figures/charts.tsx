import React from 'react';
import type { FigureOf } from '../../spec';
import { RichText } from '../RichText';
import { A11ySvg, clamp, fmt, niceAxis, regionProps, series, useMeasuredWidth, wrapLabel, type TapInteraction } from './common';

const TICK = 'ax-tick';

function roundedBar(x: number, y: number, w: number, h: number, horizontal: boolean) {
  const r = Math.min(4, (horizontal ? h : w) / 2, horizontal ? w : h);
  if (h <= 0 || w <= 0) return '';
  if (horizontal) return `M${x} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x}Z`;
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

export function BarChartFigure({ figure: f, tap }: { figure: FigureOf<'bar_chart'>; tap?: TapInteraction }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 760);
  const horizontal = f.orientation === 'horizontal';
  const top = Math.max(...f.bars.map(b => b.value));
  const axis = niceAxis(0, f.yMax ?? (top || 1), W < 420 ? 4 : 5, f.yStep);
  const yMax = f.yMax ?? axis.max;
  const ticks = axis.ticks.filter(t => t <= yMax + 1e-9);
  const n = f.bars.length;
  const tickLabelWidth = Math.max(...ticks.map(t => fmt(t).length)) * 7.5 + 10;
  if (horizontal) {
    const labelW = clamp(Math.max(...f.bars.map(b => b.label.length)) * 7.4 + 14, 48, W * 0.36);
    const m = { l: labelW, r: 24, t: 10, b: f.yLabel ? 50 : 32 };
    const band = clamp(260 / n, 30, 52);
    const H = m.t + m.b + band * n;
    const pw = W - m.l - m.r;
    const x = (v: number) => m.l + (v / yMax) * pw;
    const thick = Math.min(26, band * 0.62);
    return (
      <div ref={ref} className="ax-chart">
        <A11ySvg title={f.title ?? 'Bar graph'} desc={f.alt} interactive={!!tap} width={W} height={H}>
          {ticks.map(t => <g key={t}><line x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} className="ax-grid" /><text x={x(t)} y={H - m.b + 18} textAnchor="middle" className={TICK}>{fmt(t)}</text></g>)}
          {f.bars.map((b, i) => {
            const cy = m.t + band * i + band / 2;
            const selected = !!b.id && tap?.selected === b.id;
            const region = b.id && tap ? regionProps(b.label, selected, () => tap.onSelect(b.id!)) : {};
            return (
              <g key={i} {...region}>
                {b.id && tap && <rect x={0} y={cy - band / 2} width={W} height={band} className="ax-hit" />}
                <text x={m.l - 10} y={cy + 4} textAnchor="end" className="ax-cat">{wrapLabel(b.label, 16)[0]}</text>
                <path d={roundedBar(m.l, cy - thick / 2, x(b.value) - m.l, thick, true)} fill={selected ? 'var(--ax-coral)' : series(undefined, 0)} />
                {f.showValues && <text x={x(b.value) + 6} y={cy + 4} className="ax-value">{fmt(b.value)}</text>}
              </g>
            );
          })}
          <line x1={m.l} x2={m.l} y1={m.t} y2={H - m.b} className="ax-axis" />
          {f.yLabel && <text x={m.l + pw / 2} y={H - 8} textAnchor="middle" className="ax-axis-label">{f.yLabel}</text>}
        </A11ySvg>
        {f.xLabel && <p className="ax-chart-note">{f.xLabel}</p>}
      </div>
    );
  }
  const H = clamp(W * 0.6, 230, 340);
  const band0 = (W - tickLabelWidth - 20) / n;
  const lines = Math.max(...f.bars.map(b => wrapLabel(b.label, Math.max(4, Math.floor(band0 / 7.2))).length));
  const m = { l: tickLabelWidth + (f.yLabel ? 22 : 4), r: 12, t: f.showValues ? 24 : 12, b: 14 + lines * 16 + (f.xLabel ? 26 : 6) };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const band = pw / n;
  const thick = Math.min(band * 0.58, W < 420 ? 40 : 56);
  const y = (v: number) => m.t + ph - (v / yMax) * ph;
  return (
    <div ref={ref} className="ax-chart">
      <A11ySvg title={f.title ?? 'Bar graph'} desc={f.alt} interactive={!!tap} width={W} height={H}>
        {ticks.map(t => <g key={t}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'ax-axis' : 'ax-grid'} /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" className={TICK}>{fmt(t)}</text></g>)}
        {f.bars.map((b, i) => {
          const cx = m.l + band * i + band / 2;
          const selected = !!b.id && tap?.selected === b.id;
          const region = b.id && tap ? regionProps(b.label, selected, () => tap.onSelect(b.id!)) : {};
          const labelLines = wrapLabel(b.label, Math.max(4, Math.floor(band / 7.2)));
          return (
            <g key={i} {...region}>
              {b.id && tap && <rect x={cx - band / 2} y={m.t} width={band} height={H - m.t} className="ax-hit" />}
              <path d={roundedBar(cx - thick / 2, y(b.value), thick, y(0) - y(b.value), false)} fill={selected ? 'var(--ax-coral)' : series(undefined, 0)} />
              {f.showValues && <text x={cx} y={y(b.value) - 7} textAnchor="middle" className="ax-value">{fmt(b.value)}</text>}
              <text x={cx} y={H - m.b + 18} textAnchor="middle" className="ax-cat">
                {labelLines.map((l, j) => <tspan key={j} x={cx} dy={j ? 15 : 0}>{l}</tspan>)}
              </text>
            </g>
          );
        })}
        {f.yLabel && <text transform={`translate(13 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ax-axis-label">{f.yLabel}</text>}
        {f.xLabel && <text x={m.l + pw / 2} y={H - 6} textAnchor="middle" className="ax-axis-label">{f.xLabel}</text>}
      </A11ySvg>
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string; dash?: boolean }[] }) {
  return (
    <ul className="ax-legend" aria-hidden="true">
      {items.map(it => <li key={it.name}><span className={`ax-swatch${it.dash ? ' is-line' : ''}`} style={{ background: it.color }} />{it.name}</li>)}
    </ul>
  );
}

function XYFrame({ W, H, m, xa, ya, xLabel, yLabel, xTickLabels, children }: {
  W: number; H: number; m: { l: number; r: number; t: number; b: number };
  xa: ReturnType<typeof niceAxis>; ya: ReturnType<typeof niceAxis>; xLabel?: string; yLabel?: string;
  xTickLabels?: { x: number; label: string }[]; children: React.ReactNode;
}) {
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const x = (v: number) => m.l + ((v - xa.min) / (xa.max - xa.min)) * pw;
  const y = (v: number) => m.t + ph - ((v - ya.min) / (ya.max - ya.min)) * ph;
  const xLabels = xTickLabels?.length ? xTickLabels.map(t => ({ v: t.x, text: t.label })) : xa.ticks.map(v => ({ v, text: fmt(v) }));
  // Thin labels only when they would collide (measured by estimated text width).
  const widest = Math.max(...xLabels.map(t => t.text.length)) * 6.6 + 8;
  const gap = xLabels.length > 1 ? Math.min(...xLabels.slice(1).map((t, i) => Math.abs(x(t.v) - x(xLabels[i]!.v)))) : pw;
  const every = Math.max(1, Math.ceil(widest / Math.max(1, gap)));
  return (
    <>
      {ya.ticks.map(t => <g key={`y${t}`}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="ax-grid" /><text x={m.l - 8} y={y(t) + 4} textAnchor="end" className={TICK}>{fmt(t)}</text></g>)}
      <line x1={m.l} x2={W - m.r} y1={y(ya.min)} y2={y(ya.min)} className="ax-axis" />
      <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + ph} className="ax-axis" />
      {xLabels.map((t, i) => i % every ? null : <g key={`x${i}`}><line x1={x(t.v)} x2={x(t.v)} y1={m.t + ph} y2={m.t + ph + 5} className="ax-axis" /><text x={x(t.v)} y={m.t + ph + 19} textAnchor="middle" className={TICK}>{t.text}</text></g>)}
      {xLabel && <text x={m.l + pw / 2} y={H - 6} textAnchor="middle" className="ax-axis-label">{xLabel}</text>}
      {yLabel && <text transform={`translate(13 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ax-axis-label">{yLabel}</text>}
      {typeof children === 'function' ? null : children}
    </>
  );
}

function xyLayout(W: number, xa: ReturnType<typeof niceAxis>, ya: ReturnType<typeof niceAxis>, xLabel?: string, yLabel?: string) {
  const H = clamp(W * 0.62, 240, 380);
  const tickW = Math.max(...ya.ticks.map(t => fmt(t).length)) * 7.5 + 12;
  const m = { l: tickW + (yLabel ? 22 : 4), r: 18, t: 14, b: xLabel ? 50 : 30 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const x = (v: number) => m.l + ((v - xa.min) / (xa.max - xa.min)) * pw;
  const y = (v: number) => m.t + ph - ((v - ya.min) / (ya.max - ya.min)) * ph;
  return { H, m, x, y, pw, ph };
}

const axisFrom = (spec: { min: number; max: number; step?: number } | undefined, values: number[], W: number, zero = false) =>
  spec ? niceAxis(spec.min, spec.max, 5, spec.step) : niceAxis(Math.min(zero ? 0 : Infinity, ...values), Math.max(...values), W < 420 ? 4 : 6);

export function LineChartFigure({ figure: f }: { figure: FigureOf<'line_chart'> }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 760);
  const pts = f.series.flatMap(s => s.points);
  const xa = axisFrom(f.x, pts.map(p => p.x), W), ya = axisFrom(f.y, pts.map(p => p.y), W, true);
  const L = xyLayout(W, xa, ya, f.xLabel, f.yLabel);
  return (
    <div ref={ref} className="ax-chart">
      {f.series.length > 1 && <Legend items={f.series.map((s, i) => ({ name: s.name, color: series(undefined, i), dash: true }))} />}
      <A11ySvg title={f.title ?? 'Line graph'} desc={f.alt} width={W} height={L.H}>
        <XYFrame W={W} H={L.H} m={L.m} xa={xa} ya={ya} xLabel={f.xLabel} yLabel={f.yLabel} xTickLabels={f.xTickLabels}>
          {f.series.map((s, i) => (
            <g key={s.name}>
              <path d={s.points.map((p, j) => `${j ? 'L' : 'M'}${L.x(p.x)} ${L.y(p.y)}`).join('')} fill="none" stroke={series(undefined, i)} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, j) => <circle key={j} cx={L.x(p.x)} cy={L.y(p.y)} r={4.5} fill={series(undefined, i)} className="ax-ring" />)}
            </g>
          ))}
        </XYFrame>
      </A11ySvg>
    </div>
  );
}

export function ScatterPlotFigure({ figure: f }: { figure: FigureOf<'scatter_plot'> }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 760);
  const xa = axisFrom(f.x, f.points.map(p => p.x), W), ya = axisFrom(f.y, f.points.map(p => p.y), W);
  const L = xyLayout(W, xa, ya, f.xLabel, f.yLabel);
  const t = f.trendLine;
  let trend: React.ReactNode = null;
  if (t) {
    // Clip the trend line to the plot rectangle.
    const ys = (x: number) => t.slope * x + t.intercept;
    let x0 = xa.min, x1 = xa.max;
    if (t.slope !== 0) {
      const xsAt = [(ya.min - t.intercept) / t.slope, (ya.max - t.intercept) / t.slope].sort((a, b) => a - b);
      x0 = Math.max(x0, xsAt[0]!); x1 = Math.min(x1, xsAt[1]!);
    }
    if (x1 > x0) trend = <line x1={L.x(x0)} y1={L.y(ys(x0))} x2={L.x(x1)} y2={L.y(ys(x1))} stroke="var(--ax-coral)" strokeWidth={2} strokeDasharray="7 5" strokeLinecap="round" />;
  }
  return (
    <div ref={ref} className="ax-chart">
      <A11ySvg title={f.title ?? 'Scatter plot'} desc={f.alt} width={W} height={L.H}>
        <XYFrame W={W} H={L.H} m={L.m} xa={xa} ya={ya} xLabel={f.xLabel} yLabel={f.yLabel}>
          {trend}
          {f.points.map((p, i) => <circle key={i} cx={L.x(p.x)} cy={L.y(p.y)} r={5} fill="var(--ax-teal)" fillOpacity={0.85} className="ax-ring" />)}
        </XYFrame>
      </A11ySvg>
    </div>
  );
}

const PIE_FILLS = ['teal', 'coral', 'blue', 'gold'].flatMap(c => [`var(--ax-${c})`]).concat(['teal', 'coral', 'blue', 'gold'].map(c => `var(--ax-${c}-soft)`));
export function PieChartFigure({ figure: f, tap }: { figure: FigureOf<'pie_chart'>; tap?: TapInteraction }) {
  const total = f.slices.reduce((s, x) => s + x.value, 0);
  const size = 240, r = 104, c = size / 2;
  let angle = -Math.PI / 2;
  const show = f.show ?? 'labels';
  const pct = (v: number) => `${+(100 * v / total).toFixed(1)}%`;
  return (
    <div className="ax-pie">
      <A11ySvg title={f.title ?? 'Circle graph'} desc={f.alt} interactive={!!tap} width={size} height={size} className="ax-pie-svg">
        {f.slices.map((s, i) => {
          const a0 = angle, a1 = angle + (s.value / total) * Math.PI * 2; angle = a1;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const p = (a: number, rr = r) => `${c + rr * Math.cos(a)} ${c + rr * Math.sin(a)}`;
          const d = f.slices.length === 1 || a1 - a0 >= Math.PI * 2 - 1e-6 ? `M${c - r} ${c}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0` : `M${c} ${c}L${p(a0)}A${r} ${r} 0 ${large} 1 ${p(a1)}Z`;
          const mid = (a0 + a1) / 2, inner = a1 - a0 > 0.5;
          const selected = !!s.id && tap?.selected === s.id;
          const region = s.id && tap ? regionProps(s.label, selected, () => tap.onSelect(s.id!)) : {};
          const text = show === 'percents' ? pct(s.value) : show === 'values' ? fmt(s.value) : '';
          return (
            <g key={i} {...region}>
              <path d={d} fill={PIE_FILLS[i]} className={`ax-slice${selected ? ' is-selected' : ''}`} />
              {text && inner && <text x={c + r * 0.64 * Math.cos(mid)} y={c + r * 0.64 * Math.sin(mid) + 5} textAnchor="middle" className={`ax-slice-text${i >= 4 || i === 3 ? ' on-light' : ''}`}>{text}</text>}
            </g>
          );
        })}
      </A11ySvg>
      <ul className="ax-pie-legend">
        {f.slices.map((s, i) => (
          <li key={i}><span className="ax-swatch" style={{ background: PIE_FILLS[i] }} /><span>{s.label}</span>{show !== 'labels' && <strong>{show === 'percents' ? pct(s.value) : fmt(s.value)}</strong>}</li>
        ))}
      </ul>
    </div>
  );
}

const numericCell = (s: string) => /^[-−]?\$?[\d,.]+%?$/.test(s.trim());
export function DataTableFigure({ figure: f }: { figure: FigureOf<'data_table'> }) {
  const numericCols = f.columns.map((_, j) => f.rows.every(r => numericCell(r[j] ?? '') || (r[j] ?? '').trim() === '?'));
  return (
    <div className="ax-table-wrap" role="region" aria-label={f.title ?? 'Table'} tabIndex={0}>
      <table className="ax-table">
        <caption className="ax-visually-hidden">{f.alt}</caption>
        <thead><tr>{f.columns.map((c, j) => <th key={j} scope="col" className={numericCols[j] ? 'is-num' : ''}><RichText text={c} /></th>)}</tr></thead>
        <tbody>{f.rows.map((r, i) => <tr key={i}>{r.map((cell, j) => j === 0
          ? <th key={j} scope="row" className={numericCols[j] ? 'is-num' : ''}><RichText text={cell} /></th>
          : <td key={j} className={`${numericCols[j] ? 'is-num' : ''}${cell.trim() === '?' ? ' is-missing' : ''}`}><RichText text={cell} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
