import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageMeta } from "./PageMeta";
import { faqPage } from "./structured-data";

describe("PageMeta", () => {
  it("gives the page its own title, description and canonical address", () => {
    render(<PageMeta title="Fórmulas | Tablaria" description="Calcula columnas." path="/ayuda/formulas" />);
    expect(document.title).toBe("Fórmulas | Tablaria");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Calcula columnas.");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toMatch(/\/ayuda\/formulas$/);
  });

  it("writes structured data that no text can break out of", () => {
    const { container } = render(
      <PageMeta
        title="Inicio"
        description="Tablaria"
        path="/"
        structuredData={[faqPage([{ question: "¿Y esto?", answer: "</script><script>alert(1)</script>" }])]}
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).not.toContain("</script>");
    expect(JSON.parse(script?.textContent ?? "")).toMatchObject({
      "@type": "FAQPage",
      mainEntity: [{ acceptedAnswer: { text: "</script><script>alert(1)</script>" } }],
    });
  });
});
