/** schema.org data for the public pages, read by search engines and AI assistants (ADR-050). */

const CONTEXT = "https://schema.org";
const NAME = "Tablaria";

/** The page's public address. */
export function absoluteUrl(path: string): string {
  return `${__SITE_URL__}${path}`;
}

export function webSite() {
  return { "@context": CONTEXT, "@type": "WebSite", name: NAME, url: absoluteUrl("/"), inLanguage: "es" };
}

export function softwareApplication(description: string) {
  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: NAME,
    url: absoluteUrl("/"),
    description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "es",
    image: absoluteUrl("/og-image.png"),
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  };
}

export function faqPage(items: { question: string; answer: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/** A help guide, with the sections it covers. */
export function techArticle({
  title,
  description,
  path,
  sections,
}: {
  title: string;
  description: string;
  path: string;
  sections: string[];
}) {
  return {
    "@context": CONTEXT,
    "@type": "TechArticle",
    headline: title,
    description,
    url: absoluteUrl(path),
    inLanguage: "es",
    about: sections,
    isPartOf: { "@type": "WebSite", name: NAME, url: absoluteUrl("/") },
  };
}

/** Where a page sits: each step is a name and a path. */
export function breadcrumbs(steps: { name: string; path: string }[]) {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: steps.map(({ name, path }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: absoluteUrl(path),
    })),
  };
}
