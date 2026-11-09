import type { MathBook } from "../src/publishing/schema";

/** Model proofs use the production reader cascade and its viewport-sized
 * shell. A bare structural stylesheet leaves the contained stage at zero
 * height and omits the theme used by screen diagrams. */
export function readerProofPage(book: MathBook): string {
  const serialized = JSON.stringify(book).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><head>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
</head><body><div id="root"></div><script type="module">
import '/src/web/app/styles.ts';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BookReader} from '/src/web/BookReader.tsx';
import {AppLogo} from '/src/web/ui/AppLogo.tsx';
import frame from '/src/web/app/AppShell.module.css';
import bar from '/src/web/ui/AppBar.module.css';
const book=${serialized};
createRoot(document.getElementById('root')).render(
  React.createElement('div', {className:frame.frame, 'data-app-frame':'plain'},
    React.createElement('header', {className:bar.bar, 'data-app-bar':'plain'},
      React.createElement('div', {className:bar.logoCell},
        React.createElement(AppLogo, {'aria-label':'Open AMP menu'})
      )
    ),
    React.createElement('div', {className:frame.content},
      React.createElement('div', {className:'shell app-shell reading-shell'},
        React.createElement(BookReader, {
          book,
          initialFrame:Number(new URLSearchParams(location.search).get('frame')||0),
          onClose(){}, onPosition(){}, async download(){}
        })
      )
    )
  )
);
</script></body></html>`;
}
