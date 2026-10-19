import "./consent-entry";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { Providers } from "./app/providers";
import { router } from "./app/router";
import "./app/styles";
import { trackSessionStart } from "./lib/analytics";
// After consent-entry has removed any private fragment from the URL.
trackSessionStart();
createRoot(document.getElementById("root")!).render(
  <Providers>
    <RouterProvider router={router} />
  </Providers>,
);
