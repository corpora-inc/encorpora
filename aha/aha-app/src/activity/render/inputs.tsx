import React, { useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Plus } from 'lucide-react';
import type { ResponseOf } from '../spec';
import type { LearnerResponse } from '../grade';
import { ExprError, parseExpr, type Expr } from '../expr';
import { renderTex } from '../text';
import { RichText } from './RichText';
import { fmt } from './figures/common';


export function NumericInput({ response: r, value, onChange, disabled, onEnter }: { response: ResponseOf<'numeric'>; value: string; onChange: (v: string) => void; disabled?: boolean; onEnter?: () => void }) {
  const id = useId();
  return (
    <div className="ax-field">
      <label htmlFor={id}>{r.label ? <RichText text={r.label} /> : 'Your answer'}</label>
      <div className="ax-number-wrap">
        <input id={id} type="text" inputMode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={40}
          value={value} disabled={disabled} placeholder="Type a number" onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }} />
        {r.unit && <span className="ax-unit" aria-hidden="true">{r.unit}</span>}
      </div>
      {r.unit && <span className="ax-visually-hidden">Unit: {r.unit}</span>}
    </div>
  );
}

export function FractionInput({ response: r, value, onChange, disabled }: { response: ResponseOf<'fraction'>; value: { whole: string; numerator: string; denominator: string }; onChange: (v: { whole: string; numerator: string; denominator: string }) => void; disabled?: boolean }) {
  const id = useId();
  const field = (key: 'whole' | 'numerator' | 'denominator', label: string) => (
    <input aria-label={label} type="text" inputMode="numeric" pattern="-?[0-9]*" autoComplete="off" maxLength={7} disabled={disabled}
      className={`ax-frac-${key}`} value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value.replace(/[^\d−-]/g, '') })} />
  );
  return (
    <fieldset className="ax-field ax-fraction-field">
      <legend id={id}>{r.label ? <RichText text={r.label} /> : 'Your answer as a fraction'}</legend>
      <div className="ax-fraction-input">
        {r.mixed && field('whole', 'Whole number (leave empty if none)')}
        <div className="ax-frac-stack">
          {field('numerator', 'Numerator (top number)')}
          <span className="ax-frac-bar" aria-hidden="true" />
          {field('denominator', 'Denominator (bottom number)')}
        </div>
      </div>
    </fieldset>
  );
}

function texOf(e: Expr, parent = 0): string {
  const wrap = (s: string, prec: number) => prec < parent ? `\\left(${s}\\right)` : s;
  switch (e.t) {
    case 'num': return Math.abs(e.v - Math.PI) < 1e-12 ? '\\pi' : fmt(e.v).replace('−', '-');
    case 'var': return e.name;
    case 'neg': return wrap(`-${texOf(e.a, 3)}`, 2);
    case 'call': return e.fn === 'sqrt' ? `\\sqrt{${texOf(e.args[0]!)}}` : e.fn === 'abs' ? `\\left|${texOf(e.args[0]!)}\\right|` : `\\operatorname{${e.fn}}\\left(${e.args.map(a => texOf(a)).join(',')}\\right)`;
    case 'bin':
      if (e.op === '/') return `\\frac{${texOf(e.a)}}{${texOf(e.b)}}`;
      if (e.op === '^') return `{${texOf(e.a, 4)}}^{${texOf(e.b)}}`;
      if (e.op === '*') {
        const implicit = (e.b.t === 'var' || e.b.t === 'call' || (e.b.t === 'bin' && e.b.op === '^' && e.b.a.t === 'var')) && e.a.t !== 'var' || (e.a.t === 'var' && e.b.t === 'var');
        return wrap(`${texOf(e.a, 2)}${implicit ? '' : ' \\cdot '}${texOf(e.b, 2.5)}`, 2);
      }
      return wrap(`${texOf(e.a, 1)} ${e.op} ${texOf(e.b, 1.5)}`, 1);
  }
}

export function ExpressionInput({ response: r, value, onChange, disabled, onEnter }: { response: ResponseOf<'expression'>; value: string; onChange: (v: string) => void; disabled?: boolean; onEnter?: () => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  let preview: string | null = null, problem: string | null = null;
  if (value.trim()) {
    try { preview = renderTex(texOf(parseExpr(value, r.variables))); }
    catch (e) { problem = e instanceof ExprError ? e.message : 'Keep going…'; }
  }
  const insert = (text: string) => {
    const el = input.current;
    const start = el?.selectionStart ?? value.length, end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next.slice(0, 120));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  };
  return (
    <div className="ax-field">
      <label htmlFor={id}>{r.label ? <RichText text={r.label} /> : 'Your expression'}</label>
      <input id={id} ref={input} className="ax-expression" type="text" inputMode="text" autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false}
        maxLength={120} value={value} disabled={disabled} placeholder={`Use ${r.variables.join(', ')}`} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }} aria-describedby={`${id}-preview`} />
      <div className="ax-keys" role="group" aria-label="Math symbols">
        {[...r.variables, '^', '(', ')', '/', '×'].map(k => <button key={k} type="button" disabled={disabled} onClick={() => insert(k === '×' ? '*' : k)} aria-label={k === '^' ? 'power' : k === '/' ? 'divide' : k === '×' ? 'times' : k}>{k}</button>)}
      </div>
      <div id={`${id}-preview`} className={`ax-preview${problem ? ' is-pending' : ''}`} aria-live="polite">
        {preview ? <><span className="ax-preview-label">Reads as</span><span className="ax-math" dangerouslySetInnerHTML={{ __html: preview }} /></> : problem ? <span>{problem}</span> : null}
      </div>
    </div>
  );
}

export function ChoiceInput({ response: r, order, value, onChange, disabled }: { response: ResponseOf<'multiple_choice'> | ResponseOf<'multi_select'>; order: number[]; value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  const name = useId();
  const multi = r.type === 'multi_select';
  return (
    <fieldset className="ax-field ax-choices" role={multi ? 'group' : 'radiogroup'}>
      <legend>{multi ? 'Choose all that apply' : 'Choose one'}</legend>
      <div className="ax-choice-grid">
        {order.map((original, shown) => {
          const checked = value.includes(original);
          return (
            <label key={original} className={`ax-choice${checked ? ' is-checked' : ''}`}>
              <input type={multi ? 'checkbox' : 'radio'} name={name} checked={checked} disabled={disabled}
                onChange={() => onChange(multi ? (checked ? value.filter(v => v !== original) : [...value, original]) : [original])} />
              <span className="ax-choice-badge" aria-hidden="true">{multi ? (checked ? '✓' : '') : String.fromCharCode(65 + shown)}</span>
              <RichText text={r.options[original]!.text} className="ax-choice-text" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OrderingInput({ response: r, order, onChange, disabled }: { response: ResponseOf<'ordering'>; order: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  const [announcement, setAnnouncement] = useState('');
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
    setAnnouncement(`Moved to position ${target + 1} of ${order.length}.`);
  };
  return (
    <fieldset className="ax-field ax-ordering">
      <legend>Put these in order</legend>
      {r.firstLabel && <div className="ax-order-end">{r.firstLabel}</div>}
      <ol>
        {order.map((item, i) => (
          <li key={item} className="ax-order-item">
            <span className="ax-order-pos" aria-hidden="true">{i + 1}</span>
            <RichText text={r.items[item]!} className="ax-order-text" />
            <span className="ax-order-buttons">
              <button type="button" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move up from position ${i + 1}`}><ArrowUp size={18} aria-hidden="true" /></button>
              <button type="button" disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move down from position ${i + 1}`}><ArrowDown size={18} aria-hidden="true" /></button>
            </span>
          </li>
        ))}
      </ol>
      {r.lastLabel && <div className="ax-order-end">{r.lastLabel}</div>}
      <span className="ax-visually-hidden" aria-live="polite">{announcement}</span>
    </fieldset>
  );
}

export function PlotControls({ point, snap, bounds, onChange, disabled }: { point?: { x: number; y: number }; snap: number; bounds: { x: [number, number]; y: [number, number] }; onChange: (p: { x: number; y: number }) => void; disabled?: boolean }) {
  const p = point ?? { x: Math.min(Math.max(0, bounds.x[0]), bounds.x[1]), y: Math.min(Math.max(0, bounds.y[0]), bounds.y[1]) };
  const step = (axis: 'x' | 'y', d: number) => {
    const [lo, hi] = bounds[axis];
    onChange({ ...p, [axis]: +Math.min(hi, Math.max(lo, p[axis] + d * snap)).toPrecision(10) });
  };
  const stepper = (axis: 'x' | 'y') => (
    <div className="ax-stepper" role="group" aria-label={`${axis} coordinate`}>
      <button type="button" disabled={disabled} onClick={() => step(axis, -1)} aria-label={`Decrease ${axis}`}><Minus size={18} aria-hidden="true" /></button>
      <output aria-live="polite"><span>{axis}</span>{point ? fmt(p[axis]) : '–'}</output>
      <button type="button" disabled={disabled} onClick={() => step(axis, 1)} aria-label={`Increase ${axis}`}><Plus size={18} aria-hidden="true" /></button>
    </div>
  );
  return (
    <div className="ax-field ax-plot-controls">
      <span className="ax-field-label">{point ? <>Your point <strong>({fmt(p.x)}, {fmt(p.y)})</strong></> : 'Tap the grid to place your point'}</span>
      <div className="ax-steppers">{stepper('x')}{stepper('y')}</div>
    </div>
  );
}

export function RegionChips({ regions, selected, onSelect, disabled }: { regions: { id: string; label: string }[]; selected?: string; onSelect: (id: string) => void; disabled?: boolean }) {
  return (
    <fieldset className="ax-field ax-region-chips">
      <legend>Tap the picture, or choose here</legend>
      <div>
        {regions.map(r => <button key={r.id} type="button" disabled={disabled} aria-pressed={selected === r.id} className={selected === r.id ? 'is-selected' : ''} onClick={() => onSelect(r.id)}>{r.label}</button>)}
      </div>
    </fieldset>
  );
}
