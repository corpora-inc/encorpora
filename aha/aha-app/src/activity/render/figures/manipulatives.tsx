import React from 'react';
import type { FigureOf } from '../../spec';
import { MONEY_KINDS, pictureGroups } from '../../spec';
import { resolveIcon } from '../icons';
import { A11ySvg, clamp, fmt, series, tint, useMeasuredWidth, type TapInteraction } from './common';
import { seededRandom } from '../../expr';

// ---------- number line ----------
export function NumberLineFigure({ figure: f }: { figure: FigureOf<'number_line'> }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 760);
  const m = 26;
  const X = (v: number) => m + ((v - f.min) / (f.max - f.min)) * (W - 2 * m);
  const n = Math.round((f.max - f.min) / f.step);
  const ticks = Array.from({ length: n + 1 }, (_, i) => +(f.min + i * f.step).toPrecision(12));
  const spacing = (W - 2 * m) / Math.max(1, n);
  const fractionLabels = !!f.denominator;
  const minGap = fractionLabels ? 30 : Math.max(...ticks.map(t => fmt(t).length)) * 8 + 10;
  const every = f.labelEvery ?? Math.max(1, Math.ceil(minGap / spacing));
  const jumpH = f.jumps?.length ? 56 : 0;
  const lineY = 34 + jumpH + ((f.marks ?? []).some(mk => mk.label) ? 18 : 0);
  const H = lineY + (fractionLabels ? 58 : 44);
  const frac = (v: number) => {
    const d = f.denominator!, num = Math.round(v * d);
    if (Math.abs(num / d - v) > 1e-9) return { whole: fmt(v) };
    if (num % d === 0) return { whole: fmt(num / d) };
    return { num: String(num).replace('-', '−'), den: String(d) };
  };
  return (
    <div ref={ref} className="ax-chart">
      <A11ySvg title="Number line" desc={f.alt} width={W} height={H}>
        {(f.ranges ?? []).map((r, i) => {
          const x0 = r.extends === 'left' ? 6 : X(r.from), x1 = r.extends === 'right' ? W - 6 : X(r.to);
          return (
            <g key={i}>
              <line x1={x0} x2={x1} y1={lineY} y2={lineY} stroke="var(--ax-teal)" strokeWidth={7} strokeLinecap="round" opacity={0.85} />
              {r.extends !== 'left' && <circle cx={X(r.from)} cy={lineY} r={7} fill={r.includeFrom ? 'var(--ax-teal)' : 'var(--ax-card)'} stroke="var(--ax-teal)" strokeWidth={3} />}
              {r.extends !== 'right' && <circle cx={X(r.to)} cy={lineY} r={7} fill={r.includeTo ? 'var(--ax-teal)' : 'var(--ax-card)'} stroke="var(--ax-teal)" strokeWidth={3} />}
            </g>
          );
        })}
        <path d={`M8 ${lineY}H${W - 8}M16 ${lineY - 6}L8 ${lineY}L16 ${lineY + 6}M${W - 16} ${lineY - 6}L${W - 8} ${lineY}L${W - 16} ${lineY + 6}`} className="ax-numberline" />
        {ticks.map((t, i) => {
          const major = i % every === 0;
          const lab = fractionLabels ? frac(t) : { whole: fmt(t) };
          return (
            <g key={i}>
              <line x1={X(t)} x2={X(t)} y1={lineY - (major ? 9 : 6)} y2={lineY + (major ? 9 : 6)} className="ax-axis" />
              {major && !f.hideLabels && ('whole' in lab && lab.whole !== undefined
                ? <text x={X(t)} y={lineY + 28} textAnchor="middle" className="ax-tick-lg">{lab.whole}</text>
                : <g className="ax-frac-label"><text x={X(t)} y={lineY + 26} textAnchor="middle">{lab.num}</text><line x1={X(t) - 8} x2={X(t) + 8} y1={lineY + 31} y2={lineY + 31} /><text x={X(t)} y={lineY + 46} textAnchor="middle">{lab.den}</text></g>)}
            </g>
          );
        })}
        {(f.jumps ?? []).map((j, i) => {
          const x0 = X(j.from), x1 = X(j.to), h = clamp(Math.abs(x1 - x0) * 0.45, 18, jumpH - 8);
          const dir = x1 > x0 ? 1 : -1;
          return (
            <g key={i} className="ax-jump">
              <path d={`M${x0} ${lineY - 4}C${x0} ${lineY - h}, ${x1} ${lineY - h}, ${x1} ${lineY - 6}`} />
              <path d={`M${x1 - dir * 6} ${lineY - 13}L${x1} ${lineY - 5}L${x1 + dir * 3} ${lineY - 14}`} className="ax-jump-head" />
              {j.label && <text x={(x0 + x1) / 2} y={lineY - h * 0.75 - 8} textAnchor="middle" className="ax-jump-label">{j.label}</text>}
            </g>
          );
        })}
        {(f.marks ?? []).map((mk, i) => (
          <g key={i}>
            <circle cx={X(mk.value)} cy={lineY} r={7.5} fill={mk.open ? 'var(--ax-card)' : 'var(--ax-coral)'} stroke={mk.open ? 'var(--ax-coral)' : 'var(--ax-card)'} strokeWidth={mk.open ? 3 : 2} />
            {mk.label && <text x={X(mk.value)} y={lineY - 16} textAnchor="middle" className="ax-mark-label">{mk.label}</text>}
          </g>
        ))}
      </A11ySvg>
    </div>
  );
}

// ---------- fraction model ----------
export function FractionModelFigure({ figure: f }: { figure: FigureOf<'fraction_model'> }) {
  const wholes = f.wholes ?? 1;
  const fill = series(f.color ?? 'teal'), soft = tint(f.color ?? 'teal');
  const isShaded = (w: number, i: number) => w * f.parts + i < f.shaded;
  if (f.model === 'circle') {
    const r = 70, size = 160;
    return (
      <div className="ax-fraction-row">
        {Array.from({ length: wholes }, (_, w) => (
          <A11ySvg key={w} title={w === 0 ? 'Fraction circle' : `Fraction circle ${w + 1}`} desc={w === 0 ? f.alt : ''} width={size} height={size} className="ax-scale-svg">
            {f.parts === 1 ? <circle cx={80} cy={80} r={r} fill={isShaded(w, 0) ? fill : 'var(--ax-card)'} stroke={fill} strokeWidth={2.5} /> :
              Array.from({ length: f.parts }, (_, i) => {
                const a0 = -Math.PI / 2 + (i / f.parts) * 2 * Math.PI, a1 = -Math.PI / 2 + ((i + 1) / f.parts) * 2 * Math.PI;
                const p = (a: number) => `${80 + r * Math.cos(a)} ${80 + r * Math.sin(a)}`;
                return <path key={i} d={`M80 80L${p(a0)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}Z`} fill={isShaded(w, i) ? fill : 'var(--ax-card)'} stroke={isShaded(w, i) ? 'var(--ax-card)' : fill} strokeWidth={2} strokeLinejoin="round" />;
              })}
            {f.parts > 1 && <circle cx={80} cy={80} r={r} fill="none" stroke={fill} strokeWidth={2.5} />}
          </A11ySvg>
        ))}
      </div>
    );
  }
  if (f.model === 'area') {
    const rows = f.rows ?? [...Array(f.parts).keys()].map(k => k + 1).filter(k => f.parts % k === 0 && k * k <= f.parts).at(-1)!;
    const cols = f.parts / rows, cell = clamp(Math.floor(240 / Math.max(rows, cols)), 18, 54);
    return (
      <div className="ax-fraction-row">
        {Array.from({ length: wholes }, (_, w) => (
          <A11ySvg key={w} title="Area model" desc={w === 0 ? f.alt : ''} width={cols * cell + 6} height={rows * cell + 6} className="ax-scale-svg">
            {Array.from({ length: f.parts }, (_, i) => <rect key={i} x={3 + (i % cols) * cell} y={3 + Math.floor(i / cols) * cell} width={cell} height={cell} fill={isShaded(w, i) ? fill : 'var(--ax-card)'} stroke={isShaded(w, i) ? 'var(--ax-card)' : fill} strokeWidth={1.5} />)}
            <rect x={3} y={3} width={cols * cell} height={rows * cell} fill="none" stroke={fill} strokeWidth={3} rx={2} />
          </A11ySvg>
        ))}
      </div>
    );
  }
  const bw = 360, bh = 64;
  return (
    <div className="ax-fraction-stack">
      {Array.from({ length: wholes }, (_, w) => (
        <A11ySvg key={w} title="Fraction bar" desc={w === 0 ? f.alt : ''} width={bw + 6} height={bh + 6} className="ax-scale-svg">
          <rect x={3} y={3} width={bw} height={bh} rx={8} fill="var(--ax-card)" />
          {Array.from({ length: f.parts }, (_, i) => <rect key={i} x={3 + (i * bw) / f.parts} y={3} width={bw / f.parts} height={bh} fill={isShaded(w, i) ? fill : 'transparent'} />)}
          {Array.from({ length: f.parts - 1 }, (_, i) => <line key={i} x1={3 + ((i + 1) * bw) / f.parts} x2={3 + ((i + 1) * bw) / f.parts} y1={3} y2={3 + bh} stroke={isShaded(w, i) && isShaded(w, i + 1) ? soft : fill} strokeWidth={2} />)}
          <rect x={3} y={3} width={bw} height={bh} rx={8} fill="none" stroke={fill} strokeWidth={2.5} />
        </A11ySvg>
      ))}
    </div>
  );
}

// ---------- array grid ----------
export function ArrayGridFigure({ figure: f }: { figure: FigureOf<'array_grid'> }) {
  const cell = clamp(Math.floor(300 / Math.max(f.rows, f.cols)), 20, 44);
  const lab = f.showDimensions ? 26 : 4;
  const w = f.cols * cell + lab + 6, h = f.rows * cell + lab + 6;
  const color = f.color;
  if (f.style === 'icons' && f.icon) {
    const [Icon, tone] = resolveIcon(f.icon);
    const c = color ?? tone;
    return (
      <div className="ax-icon-grid" role="img" aria-label={f.alt} style={{ gridTemplateColumns: `repeat(${f.cols}, ${cell}px)` }}>
        {Array.from({ length: f.rows * f.cols }, (_, i) => <Icon key={i} size={cell - 8} color={series(c)} fill={tint(c)} strokeWidth={1.75} aria-hidden="true" />)}
      </div>
    );
  }
  return (
    <A11ySvg title="Array" desc={f.alt} width={w} height={h} className="ax-scale-svg">
      {f.showDimensions && <>
        <text x={lab + (f.cols * cell) / 2} y={16} textAnchor="middle" className="ax-dim-text">{f.cols}</text>
        <text x={12} y={lab + (f.rows * cell) / 2 + 5} textAnchor="middle" className="ax-dim-text">{f.rows}</text>
      </>}
      {Array.from({ length: f.rows * f.cols }, (_, i) => {
        const r = Math.floor(i / f.cols), c = i % f.cols, x = lab + c * cell, y = lab + r * cell;
        if (f.style === 'squares') {
          const on = i < (f.shaded ?? 0);
          return <rect key={i} x={x + 1} y={y + 1} width={cell - 2} height={cell - 2} rx={3} fill={on ? series(color ?? 'teal') : tint(color ?? 'teal')} stroke={series(color ?? 'teal')} strokeOpacity={on ? 0 : 0.35} />;
        }
        return <circle key={i} cx={x + cell / 2} cy={y + cell / 2} r={cell * 0.32} fill={series(color ?? (r % 2 ? 'teal' : 'coral'))} />;
      })}
    </A11ySvg>
  );
}

// ---------- base-ten blocks ----------
export function PlaceValueFigure({ figure: f }: { figure: FigureOf<'place_value_blocks'> }) {
  const u = 7; // one unit cube, px
  const groups: { name: string; count: number; draw: (i: number) => React.ReactNode; w: number; h: number; perRow: number; gap: number }[] = [];
  const cube = (x: number, y: number, s: number, key: React.Key) => (
    <g key={key}>
      <path d={`M${x} ${y + s * 0.3}L${x + s * 0.3} ${y}H${x + s * 1.3}L${x + s} ${y + s * 0.3}Z`} fill="var(--ax-gold-tint)" stroke="var(--ax-gold-ink)" strokeWidth={1.2} />
      <path d={`M${x + s} ${y + s * 0.3}L${x + s * 1.3} ${y}V${y + s}L${x + s} ${y + s * 1.3}Z`} fill="var(--ax-gold-deep)" stroke="var(--ax-gold-ink)" strokeWidth={1.2} />
      <rect x={x} y={y + s * 0.3} width={s} height={s} fill="var(--ax-gold)" stroke="var(--ax-gold-ink)" strokeWidth={1.2} />
    </g>
  );
  if (f.thousands) groups.push({ name: 'thousands', count: f.thousands, w: 10 * u * 1.3 + 2, h: 10 * u * 1.3 + 2, perRow: 3, gap: 10, draw: () => cube(1, 1, 10 * u, 0) });
  groups.push({ name: 'hundreds', count: f.hundreds, w: 10 * u, h: 10 * u, perRow: 5, gap: 6, draw: () => (
    <g><rect x={0} y={0} width={10 * u} height={10 * u} fill="var(--ax-blue)" stroke="var(--ax-blue)" strokeWidth={1.5} rx={1.5} />
      {Array.from({ length: 9 }, (_, i) => <g key={i}><line x1={(i + 1) * u} x2={(i + 1) * u} y1={0} y2={10 * u} className="ax-block-line" /><line y1={(i + 1) * u} y2={(i + 1) * u} x1={0} x2={10 * u} className="ax-block-line" /></g>)}</g>) });
  groups.push({ name: 'tens', count: f.tens, w: u, h: 10 * u, perRow: 10, gap: 5, draw: () => (
    <g><rect x={0} y={0} width={u} height={10 * u} fill="var(--ax-teal)" stroke="var(--ax-teal)" strokeWidth={1.5} rx={1.5} />
      {Array.from({ length: 9 }, (_, i) => <line key={i} y1={(i + 1) * u} y2={(i + 1) * u} x1={0} x2={u} className="ax-block-line" />)}</g>) });
  groups.push({ name: 'ones', count: f.ones, w: u, h: u, perRow: 5, gap: 4, draw: () => <rect x={0} y={0} width={u} height={u} fill="var(--ax-coral)" stroke="var(--ax-coral)" strokeWidth={1.5} rx={1} /> });
  const scale = 2;
  return (
    <div className="ax-blocks" role="img" aria-label={f.alt}>
      {groups.filter(g => g.count > 0).map(g => {
        const rows = Math.max(1, Math.ceil(g.count / g.perRow)), cols = Math.max(1, Math.min(g.count, g.perRow));
        const w = (cols * (g.w + g.gap) - g.gap + 4) * scale, h = (rows * (g.h + g.gap) - g.gap + 4) * scale;
        return (
          <div key={g.name} className="ax-block-group">
            <svg width={w} height={h} viewBox={`-2 -2 ${w / scale} ${h / scale}`} aria-hidden="true">
              {Array.from({ length: g.count }, (_, i) => <g key={i} transform={`translate(${(i % g.perRow) * (g.w + g.gap)} ${Math.floor(i / g.perRow) * (g.h + g.gap)})`}>{g.draw(i)}</g>)}
            </svg>
            {f.showLabels && <span>{g.count} {g.count === 1 ? g.name.replace(/s$/, '') : g.name}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ---------- clock ----------
export function ClockFigure({ figure: f }: { figure: FigureOf<'clock'> }) {
  const c = 110, R = 96;
  const minuteAngle = (f.minute / 60) * 2 * Math.PI - Math.PI / 2;
  const hourAngle = (((f.hour % 12) + f.minute / 60) / 12) * 2 * Math.PI - Math.PI / 2;
  const pt = (a: number, r: number) => ({ x: c + r * Math.cos(a), y: c + r * Math.sin(a) });
  return (
    <div className="ax-clock">
      <A11ySvg title="Clock" desc={f.alt} width={220} height={220} className="ax-scale-svg">
        <circle cx={c} cy={c} r={R + 6} fill="var(--ax-card)" stroke="var(--ax-ink)" strokeWidth={4} />
        {Array.from({ length: 60 }, (_, i) => { const a = (i / 60) * 2 * Math.PI, p0 = pt(a, R - (i % 5 ? 4 : 9)), p1 = pt(a, R); return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="var(--ax-ink)" strokeWidth={i % 5 ? 1 : 2.5} strokeOpacity={i % 5 ? 0.45 : 1} />; })}
        {Array.from({ length: 12 }, (_, i) => { const p = pt(((i + 1) / 12) * 2 * Math.PI - Math.PI / 2, R - 24); return <text key={i} x={p.x} y={p.y + 7} textAnchor="middle" className="ax-clock-num">{i + 1}</text>; })}
        {f.showMinuteNumbers && Array.from({ length: 12 }, (_, i) => { const p = pt(((i + 1) / 12) * 2 * Math.PI - Math.PI / 2, R + 17); return <text key={i} x={p.x} y={p.y + 4} textAnchor="middle" className="ax-clock-min">{((i + 1) * 5) % 60 === 0 ? '00' : (i + 1) * 5}</text>; })}
        <line x1={c} y1={c} x2={pt(hourAngle, R * 0.42).x} y2={pt(hourAngle, R * 0.42).y} stroke="var(--ax-ink)" strokeWidth={7} strokeLinecap="round" />
        <line x1={c} y1={c} x2={pt(minuteAngle, R * 0.64).x} y2={pt(minuteAngle, R * 0.64).y} stroke="var(--ax-coral)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={c} cy={c} r={6} fill="var(--ax-coral)" stroke="var(--ax-card)" strokeWidth={2} />
      </A11ySvg>
      {f.showDigital && <div className="ax-digital" aria-hidden="true">{f.hour}:{String(f.minute).padStart(2, '0')}</div>}
    </div>
  );
}

// ---------- money (stylized; not currency reproductions) ----------
const COIN: Record<string, { label: string; r: number; tone: 'copper' | 'silver' | 'brass' }> = {
  penny: { label: '1¢', r: 25, tone: 'copper' }, nickel: { label: '5¢', r: 28, tone: 'silver' }, dime: { label: '10¢', r: 23, tone: 'silver' },
  quarter: { label: '25¢', r: 31, tone: 'silver' }, half_dollar: { label: '50¢', r: 35, tone: 'silver' }, dollar_coin: { label: '$1', r: 33, tone: 'brass' },
};
export function MoneyFigure({ figure: f }: { figure: FigureOf<'money'> }) {
  return (
    <div className="ax-money" role="img" aria-label={f.alt}>
      {f.items.map((it, i) => (
        <div key={i} className="ax-money-group">
          {Array.from({ length: it.count }, (_, k) => {
            if (it.kind.startsWith('bill_')) {
              const value = MONEY_KINDS[it.kind] / 100;
              return (
                <svg key={k} width={132} height={62} viewBox="0 0 132 62" className="ax-bill" aria-hidden="true">
                  <rect x={1} y={1} width={130} height={60} rx={6} className="ax-bill-body" />
                  <rect x={7} y={7} width={118} height={48} rx={4} className="ax-bill-inner" />
                  <circle cx={66} cy={31} r={17} className="ax-bill-seal" />
                  <text x={66} y={37} textAnchor="middle" className="ax-bill-center">{value}</text>
                  <text x={16} y={23} className="ax-bill-corner">${value}</text>
                  <text x={116} y={49} textAnchor="end" className="ax-bill-corner">${value}</text>
                </svg>
              );
            }
            const coin = COIN[it.kind]!;
            const s = coin.r * 2 + 4;
            return (
              <svg key={k} width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={`ax-coin ax-coin-${coin.tone}`} aria-hidden="true">
                <circle cx={s / 2} cy={s / 2} r={coin.r} className="ax-coin-rim" />
                <circle cx={s / 2} cy={s / 2} r={coin.r - 4} className="ax-coin-face" />
                <text x={s / 2} y={s / 2 + 5} textAnchor="middle" className="ax-coin-label">{coin.label}</text>
              </svg>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------- ruler ----------
export function RulerFigure({ figure: f }: { figure: FigureOf<'ruler'> }) {
  const [ref, measured] = useMeasuredWidth<HTMLDivElement>();
  const W = clamp(measured, 260, 760);
  const m = 22, pu = (W - m - 48) / f.length;
  const objY = 18, bodyY = f.object ? 62 : 14, H = bodyY + 62;
  const X = (v: number) => m + v * pu;
  const sub = f.subdivisions;
  const tickLen = (k: number) => k % sub === 0 ? 26 : sub % 2 === 0 && k % (sub / 2) === 0 ? 18 : sub === 8 && k % 2 === 0 ? 13 : 9;
  return (
    <div ref={ref} className="ax-chart">
      <A11ySvg title="Ruler" desc={f.alt} width={W} height={H}>
        {f.object && (
          <g>
            <rect x={X(f.object.from)} y={objY} width={(f.object.to - f.object.from) * pu} height={24} rx={12} fill={series(f.object.color ?? 'coral')} />
            <rect x={X(f.object.from) + 8} y={objY + 6} width={Math.max(0, (f.object.to - f.object.from) * pu - 16)} height={5} rx={2.5} fill="var(--ax-card)" opacity={0.35} />
            {f.object.label && <text x={X((f.object.from + f.object.to) / 2)} y={objY - 5} textAnchor="middle" className="ax-mark-label">{f.object.label}</text>}
            <line x1={X(f.object.from)} x2={X(f.object.from)} y1={objY + 24} y2={bodyY} className="ax-guide" />
            <line x1={X(f.object.to)} x2={X(f.object.to)} y1={objY + 24} y2={bodyY} className="ax-guide" />
          </g>
        )}
        <rect x={m - 12} y={bodyY} width={f.length * pu + 48} height={56} rx={6} className="ax-ruler-body" />
        {Array.from({ length: f.length * sub + 1 }, (_, k) => <line key={k} x1={X(k / sub)} x2={X(k / sub)} y1={bodyY} y2={bodyY + tickLen(k)} className="ax-ruler-tick" />)}
        {Array.from({ length: f.length + 1 }, (_, k) => <text key={k} x={X(k)} y={bodyY + 44} textAnchor="middle" className="ax-ruler-num">{k}</text>)}
        <text x={X(f.length) + 21} y={bodyY + 44} textAnchor="middle" className="ax-ruler-unit">{f.unit}</text>
      </A11ySvg>
    </div>
  );
}

// ---------- picture (composable pictograph scene) ----------
export function PictureFigure({ figure: f, tap }: { figure: FigureOf<'picture'>; tap?: TapInteraction }) {
  const groups = pictureGroups(f);
  const total = groups.reduce((n, g) => n + g.count, 0);
  const size = total > 60 ? 24 : total > 30 ? 28 : 34;
  return (
    <div className={`ax-picture ax-picture-${f.layout ?? 'row'}`} role={tap ? 'group' : 'img'} aria-label={f.alt}>
      {groups.map((g, gi) => {
        const [Icon, tone] = resolveIcon(g.icon);
        const c = g.color ?? tone;
        const crossed = g.crossedOut ?? 0;
        const icon = (k: number) => (
          <span key={k} className={`ax-pic-icon${k >= g.count - crossed ? ' is-crossed' : ''}`} style={{ width: size, height: size }}>
            <Icon size={size - 4} color={series(c)} fill={tint(c)} strokeWidth={1.75} aria-hidden="true" />
          </span>
        );
        const arrangement = g.arrangement ?? (g.count > 10 ? 'grid' : 'row');
        let body: React.ReactNode;
        if (arrangement === 'ten_frame') {
          const frames = Math.ceil(g.count / 10);
          body = <div className="ax-ten-frames">{Array.from({ length: frames }, (_, fi) => (
            <div key={fi} className="ax-ten-frame" style={{ gridTemplateColumns: `repeat(5, ${size + 6}px)` }}>
              {Array.from({ length: 10 }, (_, k) => <span key={k} className="ax-ten-cell" style={{ width: size + 6, height: size + 6 }}>{fi * 10 + k < g.count ? icon(fi * 10 + k) : null}</span>)}
            </div>))}</div>;
        } else if (arrangement === 'scattered') {
          const rand = seededRandom(`${f.id}:${gi}`);
          const cols = Math.ceil(Math.sqrt(g.count * 1.6)), rows = Math.ceil(g.count / cols);
          const cell = size + 10;
          body = <div className="ax-scatter" style={{ width: cols * cell, height: rows * cell }}>
            {Array.from({ length: g.count }, (_, k) => <span key={k} style={{ position: 'absolute', left: (k % cols) * cell + rand() * 8, top: Math.floor(k / cols) * cell + rand() * 8, transform: `rotate(${Math.round(rand() * 30 - 15)}deg)` }}>{icon(k)}</span>)}
          </div>;
        } else if (arrangement === 'row') {
          body = <div className="ax-pic-grid ax-pic-row">{Array.from({ length: g.count }, (_, k) => icon(k))}</div>;
        } else {
          const perRow = arrangement === 'grid' ? (g.count % 5 === 0 || g.count > 12 ? 5 : Math.ceil(Math.sqrt(g.count))) : g.count;
          body = <div className="ax-pic-grid" style={{ gridTemplateColumns: `repeat(${Math.min(perRow, g.count)}, ${size}px)` }}>{Array.from({ length: g.count }, (_, k) => icon(k))}</div>;
        }
        const selected = !!g.id && tap?.selected === g.id;
        const content = <>{body}{g.label && <span className="ax-pic-label">{g.label}</span>}</>;
        if (g.id && tap) {
          return <button key={gi} type="button" className={`ax-pic-group is-tappable${selected ? ' is-selected' : ''}`} aria-pressed={selected} aria-label={g.label ?? `group ${gi + 1}`} onClick={() => tap.onSelect(g.id!)}>{content}</button>;
        }
        return <div key={gi} className="ax-pic-group">{content}</div>;
      })}
      {f.key && <p className="ax-pic-key">{f.key}</p>}
    </div>
  );
}
