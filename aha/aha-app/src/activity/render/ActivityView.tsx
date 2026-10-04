import React, { useMemo, useState } from 'react';
import { Lightbulb, Sparkles, Check } from 'lucide-react';
import type { ActivitySpec, Figure } from '../spec';
import { plotSnap, regionIds } from '../spec';
import type { GradeOutcome, LearnerResponse } from '../grade';
import { seededRandom } from '../expr';
import { DisplayMath, RichText } from './RichText';
import { FigureView } from './Figure';
import type { FigureInteraction } from './figures/common';
import { ChoiceInput, ExpressionInput, FractionInput, NumericInput, OrderingInput, PlotControls, RegionChips } from './inputs';

export interface ActivityViewProps {
  spec: ActivitySpec;
  /** Called with a complete response. The caller grades (gradeActivity) and records evidence. */
  onSubmit: (response: LearnerResponse) => void;
  /** Supply after grading to show feedback and the worked explanation. */
  result?: GradeOutcome;
  /** Notified each time the learner reveals another hint (for assisted-evidence recording). */
  onHint?: (hintsShown: number) => void;
  disabled?: boolean;
  /** 'light' matches today's light-only studio shell; 'auto' follows the OS; 'dark' forces dark. */
  theme?: 'light' | 'dark' | 'auto';
  /** Start revealed (gallery/tests). */
  initialHintsShown?: number;
  initialResponse?: LearnerResponse;
}

/** Deterministic display order so a re-render or restore never reshuffles under the learner. */
export function displayOrder(length: number, seed: string, shuffle: boolean, avoidIdentity = false): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (!shuffle) return order;
  const rand = seededRandom(seed);
  for (let i = length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
  if (avoidIdentity && order.every((v, i) => v === i) && length > 1) order.push(order.shift()!);
  return order;
}

function regionLabels(figure: Figure): { id: string; label: string }[] {
  const ids = regionIds(figure);
  const named = (id: string, label: string | undefined, i: number) => ({ id, label: label ?? `Part ${i + 1}` });
  switch (figure.type) {
    case 'bar_chart': return figure.bars.filter(b => b.id).map((b, i) => named(b.id!, b.label, i));
    case 'pie_chart': return figure.slices.filter(s => s.id).map((s, i) => named(s.id!, s.label, i));
    case 'picture': return figure.groups.filter(g => g.id).map((g, i) => named(g.id!, g.label, i));
    case 'coordinate_plane': return (figure.points ?? []).filter(p => p.id).map((p, i) => named(p.id!, p.label, i));
    case 'geometry': {
      // Neutral names for unlabeled shapes: naming the shape kind could give the answer away.
      const shapes = figure.shapes.flatMap(s => (s.kind === 'polygon' || s.kind === 'circle') && s.id ? [s] : []);
      const colorName = (c: string | undefined, kind: string, i: number) => {
        const tone = c && c !== 'plain' ? c : (['teal', 'coral', 'blue', 'gold'] as const)[kind === 'circle' ? 1 : 0];
        return `${tone[0]!.toUpperCase()}${tone.slice(1)} shape`;
      };
      const names = shapes.map((s, i) => s.label ?? colorName(s.color, s.kind, i));
      return shapes.map((s, i) => ({ id: s.id!, label: names.filter(n => n === names[i]).length > 1 ? `${names[i]} ${i + 1}` : names[i]! }));
    }
    default: return ids.map((id, i) => named(id, undefined, i));
  }
}

const initialDraft = (spec: ActivitySpec, initial?: LearnerResponse) => {
  const r = initial;
  return {
    text: r?.type === 'numeric' || r?.type === 'expression' ? r.value : '',
    fraction: r?.type === 'fraction' ? { whole: r.whole ?? '', numerator: r.numerator, denominator: r.denominator } : { whole: '', numerator: '', denominator: '' },
    choices: r?.type === 'multiple_choice' ? [r.choice] : r?.type === 'multi_select' ? r.choices : [],
    order: r?.type === 'ordering' ? r.order : spec.response.type === 'ordering' ? displayOrder(spec.response.items.length, spec.id, true, true) : [],
    point: r?.type === 'plot_point' ? { x: r.x, y: r.y } : undefined,
    region: r?.type === 'tap_region' ? r.region : undefined,
  };
};

export function ActivityView({ spec, onSubmit, result, onHint, disabled, theme = 'light', initialHintsShown = 0, initialResponse }: ActivityViewProps) {
  const r = spec.response;
  const [draft, setDraft] = useState(() => initialDraft(spec, initialResponse));
  const [hintsShown, setHintsShown] = useState(Math.min(initialHintsShown, spec.hints?.length ?? 0));
  const [showExplanation, setShowExplanation] = useState(false);
  const figures = useMemo(() => new Map((spec.figures ?? []).map(f => [f.id, f])), [spec]);
  // One graded submission per displayed activity (matches the evidence ledger); unreadable input may retry.
  const graded = !!result && !result.invalid;
  const locked = disabled || graded;
  const choiceOrder = useMemo(() => (r.type === 'multiple_choice' || r.type === 'multi_select') ? displayOrder(r.options.length, spec.id, r.shuffle ?? true) : [], [r, spec.id]);

  const response: LearnerResponse | null = (() => {
    switch (r.type) {
      case 'numeric': return draft.text.trim() ? { type: 'numeric', value: draft.text } : null;
      case 'expression': return draft.text.trim() ? { type: 'expression', value: draft.text } : null;
      case 'fraction': return draft.fraction.numerator && draft.fraction.denominator ? { type: 'fraction', numerator: draft.fraction.numerator, denominator: draft.fraction.denominator, ...(draft.fraction.whole ? { whole: draft.fraction.whole } : {}) } : null;
      case 'multiple_choice': return draft.choices.length === 1 ? { type: 'multiple_choice', choice: draft.choices[0]! } : null;
      case 'multi_select': return draft.choices.length ? { type: 'multi_select', choices: draft.choices } : null;
      case 'ordering': return { type: 'ordering', order: draft.order };
      case 'plot_point': return draft.point ? { type: 'plot_point', ...draft.point } : null;
      case 'tap_region': return draft.region ? { type: 'tap_region', region: draft.region } : null;
    }
  })();
  const submit = () => { if (response && !locked) onSubmit(response); };

  const interactionFor = (figure: Figure): FigureInteraction | undefined => {
    if (r.type === 'tap_region' && r.figureId === figure.id) return { kind: 'tap', selected: draft.region, onSelect: id => !locked && setDraft(d => ({ ...d, region: id })) };
    if (r.type === 'plot_point' && r.figureId === figure.id) return { kind: 'plot', point: draft.point, snap: figure.type === 'coordinate_plane' ? plotSnap(r, figure) : { x: 1, y: 1 }, onPlot: p => !locked && setDraft(d => ({ ...d, point: p })) };
    return undefined;
  };

  let input: React.ReactNode = null;
  switch (r.type) {
    case 'numeric': input = <NumericInput response={r} value={draft.text} disabled={locked} onEnter={submit} onChange={text => setDraft(d => ({ ...d, text }))} />; break;
    case 'expression': input = <ExpressionInput response={r} value={draft.text} disabled={locked} onEnter={submit} onChange={text => setDraft(d => ({ ...d, text }))} />; break;
    case 'fraction': input = <FractionInput response={r} value={draft.fraction} disabled={locked} onChange={fraction => setDraft(d => ({ ...d, fraction }))} />; break;
    case 'multiple_choice': case 'multi_select': input = <ChoiceInput response={r} order={choiceOrder} value={draft.choices} disabled={locked} onChange={choices => setDraft(d => ({ ...d, choices }))} />; break;
    case 'ordering': input = <OrderingInput response={r} order={draft.order} disabled={locked} onChange={order => setDraft(d => ({ ...d, order }))} />; break;
    case 'plot_point': {
      const f = figures.get(r.figureId);
      if (f?.type === 'coordinate_plane') input = <PlotControls point={draft.point} snap={plotSnap(r, f)} bounds={{ x: [f.x.min, f.x.max], y: [f.y.min, f.y.max] }} disabled={locked} onChange={point => setDraft(d => ({ ...d, point }))} />;
      break;
    }
    case 'tap_region': {
      const f = figures.get(r.figureId);
      if (f) input = <RegionChips regions={regionLabels(f)} selected={draft.region} disabled={locked} onSelect={region => setDraft(d => ({ ...d, region }))} />;
      break;
    }
  }

  const hints = spec.hints ?? [];
  return (
    <article className="aha-activity" data-theme={theme === 'auto' ? undefined : theme} data-theme-auto={theme === 'auto' ? '' : undefined} aria-labelledby={`${spec.id}-title`}>
      <header className="ax-head">
        <span className="ax-level" aria-label={`Challenge level ${spec.difficulty} of 10`}>
          {Array.from({ length: 5 }, (_, i) => <span key={i} className={i < Math.ceil(spec.difficulty / 2) ? 'is-on' : ''} />)}
        </span>
        <h2 id={`${spec.id}-title`} className={spec.title ? '' : 'ax-visually-hidden'}>{spec.title ?? 'Activity'}</h2>
      </header>
      <form className="ax-body" onSubmit={e => { e.preventDefault(); submit(); }}>
        <div className="ax-prompt">
          {spec.prompt.map((block, i) => {
            if (block.type === 'text') return <RichText key={i} as="p" text={block.text} className="ax-paragraph" />;
            if (block.type === 'math') return <DisplayMath key={i} tex={block.tex} />;
            const figure = figures.get(block.figureId);
            return figure ? <FigureView key={i} figure={figure} interaction={interactionFor(figure)} /> : null;
          })}
        </div>
        <div className="ax-response">{input}</div>
        {hintsShown > 0 && (
          <div className="ax-hints" aria-live="polite">
            {hints.slice(0, hintsShown).map((h, i) => <div key={i} className="ax-hint"><Lightbulb size={18} aria-hidden="true" /><RichText text={h} /></div>)}
          </div>
        )}
        {result && (
          <div className={`ax-feedback ${result.invalid ? 'is-info' : result.correct ? 'is-correct' : 'is-retry'}`} role="status">
            {result.correct ? <Check size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}
            <div>
              <strong>{result.invalid ? 'Let’s try that again' : result.correct ? 'Yes — that’s it.' : 'Not quite yet.'}</strong>
              <p>{result.invalid ?? (result.correct ? 'Nice thinking. Here is one way to see it.' : 'Mistakes are how we find the idea. Take a look at how it works.')}</p>
            </div>
          </div>
        )}
        {result && !result.invalid && (
          <div className="ax-explanation-wrap">
            {(showExplanation || result.correct) ? <RichText as="div" text={spec.explanation} className="ax-explanation" />
              : <button type="button" className="ax-text-button" onClick={() => setShowExplanation(true)}>See how it works</button>}
          </div>
        )}
        <div className="ax-actions">
          {!graded && <button type="submit" className="ax-primary" disabled={!response || locked}>Check my answer</button>}
          {hintsShown < hints.length && !graded && (
            <button type="button" className="ax-text-button" onClick={() => { const n = hintsShown + 1; setHintsShown(n); onHint?.(n); }}>
              <Lightbulb size={16} aria-hidden="true" /> {hintsShown ? 'Another hint' : 'A little hint'}
            </button>
          )}
        </div>
      </form>
    </article>
  );
}
