import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/features/theme/ThemeProvider";

interface RenderOptions {
  /** Initial URL. */
  route?: string;
  /** Route pattern the UI is mounted at, for components that read params. */
  path?: string;
}

/** The current URL, rendered so tests can assert on it. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Renders with the app's providers, a fresh query cache and an in-memory router. */
export function renderWithProviders(
  ui: ReactNode,
  { route = "/", path = "*" }: RenderOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

type Handler = (url: URL, init: RequestInit) => unknown;

/**
 * Replaces `fetch` with JSON responses from `handler`. Returning a number
 * answers with that status and an empty error body.
 */
export function mockApi(handler: Handler) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const result = handler(url, init);
    if (typeof result === "number") {
      return new Response(JSON.stringify({ statusCode: result, error: "", message: "" }), {
        status: result,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
