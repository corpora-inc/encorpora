import type { ReactNode } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import type { Element as HastElement, Root } from 'hast';
import { fromDom } from 'hast-util-from-dom';
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { renderTex, renderTexInto } from '../text';

/**
 * KaTeX positions every fraction bar, numerator, exponent and strut with inline styles
 * (`top:-2.65em`, `height:0.84em`). The app's CSP is `style-src 'self' 'unsafe-inline'`, but Tauri
 * adds a nonce to style-src for the inline <style> in index.html, and once a nonce is present browsers
 * ignore 'unsafe-inline': every style attribute parsed from markup (innerHTML, a <template>, even
 * DOMParser) is dropped and each fraction collapses into one tiny glyph below the baseline.
 *
 * So math never travels as markup in the WebView. KaTeX builds its DOM with CSSOM writes (allowed by
 * CSP), that DOM becomes React elements, and React applies `style` through the CSSOM as well. Without
 * a DOM (unit tests) the same output is parsed from KaTeX's markup instead. Input is gated by
 * `renderTex`/`renderTexInto` (command denylist, trust:false) on both paths.
 */
const cache = new Map<string, ReactNode>();

function toHast(tex: string, displayMode: boolean): Root {
  if (typeof document === 'undefined') return fromHtmlIsomorphic(renderTex(tex, displayMode), { fragment: true });
  const host = document.createElement('span');
  renderTexInto(host, tex, displayMode);
  const span = fromDom(host) as HastElement;
  return { type: 'root', children: span.children as Root['children'] };
}

/** Math that stacks (fractions, columns) and needs leading above and below its line. */
export const isStacked = (tex: string) => /\\(?:[dt]?frac|binom|over|begin)(?![A-Za-z])/.test(tex);

export function texToReact(tex: string, displayMode = false): ReactNode {
  const key = `${displayMode ? 'D' : 'T'}${tex}`;
  let node = cache.get(key);
  if (node === undefined) {
    node = toJsxRuntime(toHast(tex, displayMode), { Fragment, jsx, jsxs });
    if (cache.size > 500) cache.clear();
    cache.set(key, node);
  }
  return node;
}
