import React from 'react';
import { renderTex, splitRichText } from '../text';

/** Keep a number with its unit ("6 m", "30 %") on one line. */
const UNIT_SPACE = /(\d) (?=(?:mm|cm|m|km|in|ft|yd|mi|g|kg|lb|oz|mL|L|sq|°|%|¢|cubes|units)\b|[°%¢])/g;
const tidy = (text: string) => text.replace(UNIT_SPACE, '$1\u00a0');

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
        : <span key={i} className={s.tex.length <= 24 ? 'ax-math is-short' : 'ax-math'} dangerouslySetInnerHTML={{ __html: renderTex(s.tex) }} />)}
    </Tag>
  );
}

export function DisplayMath({ tex }: { tex: string }) {
  return <div className="ax-display-math" dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />;
}
