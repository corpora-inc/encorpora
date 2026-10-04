import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { diagnostics, installGlobalHandlers, logEvent } from './diagnostics/log';
installGlobalHandlers(diagnostics, window);
logEvent('info', 'app', 'Started');
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
