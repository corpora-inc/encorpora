import React from 'react';
import { splitRichText } from '../text';
import { isStacked, texToReact } from './Tex';

/** Keep a number with its unit ("6 m", "30 %") on one line. */
const UNIT_SPACE = /(\d) (?=(?:mm|cm|m|km|in|ft|yd|mi|g|kg|lb|oz|mL|L|sq|°|%|¢|cubes|units)\b|[°%¢])/g;
/** A hyphen before a number at the start of a word is a minus sign ("−7"); ranges like "3-4" are left alone. */
const MINUS = /(^|[\s(])-(?=\d)/g;
const tidy = (text: string) => text.replace(UNIT_SPACE, '$1\u00a0').replace(MINUS, '$1\u2212');
/** Short math stays on one line: "12 × 3 − 18" never breaks after the minus. Measured on what is drawn,
 * not on the TeX source, so `\times` or `\boxed{\phantom{00}}` do not count as many characters. */
const drawnLength = (tex: string) => tex.replace(/\\[A-Za-z]+/g, 'x').replace(/[\s{}^_]/g, '').length;

/**
 * Plain text + KaTeX math. Text segments are React text nodes (never HTML). Math HTML comes
 * only from KaTeX with trust:false and the validator's command denylist.
 */
export function RichText({ text, as: Tag = 'span', className }: { text: string; as?: 'span' | 'p' | 'div'; className?: string }) {
  let segments;
  try { segments = splitRichText(text); } catch { segments = [{ kind: 'text' as const, text }]; }
  return (
    <Tag className={className}>
      {segments.map((s, i) => s.kind === 'text'
        ? <React.Fragment key={i}>{tidy(s.text)}</React.Fragment>
        : <span key={i} className={`ax-math${drawnLength(s.tex) <= 24 ? ' is-short' : ''}${isStacked(s.tex) ? ' is-stacked' : ''}`}>{texToReact(s.tex)}</span>)}
    </Tag>
  );
}

export function DisplayMath({ tex }: { tex: string }) {
  return <div className="ax-display-math">{texToReact(tex, true)}</div>;
}
