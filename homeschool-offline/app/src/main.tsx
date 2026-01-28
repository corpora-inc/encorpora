import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Force iOS to recalculate viewport height on initial load
setTimeout(() => window.dispatchEvent(new Event('resize')), 0);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
