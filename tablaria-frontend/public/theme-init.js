// Applies the saved theme before first paint to avoid a light flash (see ThemeProvider).
// A separate file rather than an inline script, so the Content-Security-Policy can
// allow scripts from this origin only.
try {
  var stored = localStorage.getItem("tablaria-theme");
  var dark =
    stored === "dark" ||
    (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
} catch (error) {}

// A prerendered page (ADR-050) holds one path's content. Served for another path
// (index.html is also the fallback of every app route), that content is hidden
// before the first paint and main.tsx renders the app from scratch.
var prerendered = document.documentElement.getAttribute("data-prerendered");
var path = location.pathname.replace(/\/+$/, "") || "/";
if (prerendered !== null && prerendered !== path) {
  document.documentElement.setAttribute("data-shell", "");
}
