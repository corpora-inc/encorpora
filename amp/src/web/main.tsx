import "./consent-entry";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./style.css";
import "./theme.css";
import "./premium-controls.css";
import "./app-shell.css";
import "./ui/tokens.css";
createRoot(document.getElementById("root")!).render(
  <Providers>
    <RouterProvider router={router} />
  </Providers>,
);
