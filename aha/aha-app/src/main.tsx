import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { diagnostics, installGlobalHandlers, logEvent } from './diagnostics/log';
import { syncSystemBars } from './ui/systemBars';
installGlobalHandlers(diagnostics, window);
logEvent('info', 'app', 'Started');
syncSystemBars(window, (e) => logEvent('error', 'app', `Status-bar sync failed: ${String(e)}`));
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
