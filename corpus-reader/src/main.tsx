import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// URL.parse polyfill for Android WebView compatibility
if (typeof URL !== 'undefined' && !URL.parse) {
  (URL as any).parse = function(urlString: string, base?: string) {
    try {
      return new URL(urlString, base);
    } catch (error) {
      return null;
    }
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
