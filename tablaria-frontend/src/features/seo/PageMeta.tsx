import { absoluteUrl } from "./structured-data";

/**
 * What search engines and link previews read about a public page: its title,
 * description, canonical address and, optionally, structured data (ADR-050).
 * React places these tags in <head>, both in the browser and when the page is
 * prerendered at build time.
 */
export function PageMeta({
  title,
  description,
  path,
  structuredData,
}: {
  title: string;
  description: string;
  /** The page's path, e.g. "/ayuda/calendario". */
  path: string;
  /** schema.org objects, written as JSON-LD. */
  structuredData?: object[];
}) {
  const url = absoluteUrl(path);
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {structuredData?.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Our own data; "<" is escaped so no value can close the script element.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
