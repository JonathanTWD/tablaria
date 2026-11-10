import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import "./i18n";
import App from "./App.tsx";
import { Providers } from "./app/Providers.tsx";

const app = (
  <StrictMode>
    <BrowserRouter>
      <Providers>
        <App />
      </Providers>
    </BrowserRouter>
  </StrictMode>
);
const container = document.getElementById("root")!;
const html = document.documentElement;

// A public page prerendered for this path takes over its HTML (ADR-050); any
// other page, or one served for another path (see theme-init.js), starts empty.
if (html.dataset.prerendered !== undefined && !html.hasAttribute("data-shell")) {
  hydrateRoot(container, app);
} else {
  container.replaceChildren();
  // The canonical link of the page this HTML was prerendered for doesn't belong here.
  if (html.hasAttribute("data-shell")) {
    document.querySelector('link[rel="canonical"]')?.remove();
  }
  html.removeAttribute("data-shell");
  createRoot(container).render(app);
}
