// Applies the saved theme before first paint to avoid a light flash (see ThemeProvider).
// A separate file rather than an inline script, so the Content-Security-Policy can
// allow scripts from this origin only.
try {
  var stored = localStorage.getItem("wisedata-theme");
  var dark =
    stored === "dark" ||
    (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (dark) document.documentElement.classList.add("dark");
} catch (error) {}
