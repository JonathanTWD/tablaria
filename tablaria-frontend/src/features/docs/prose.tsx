import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/** Typography for article bodies: they are plain semantic HTML. */
const PROSE_CLASS = [
  "text-[1.0625rem] leading-8 text-foreground/90",
  "[&_p]:mt-4 [&_p:first-child]:mt-0",
  "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:mt-1.5 [&_li]:pl-1 [&_li::marker]:text-muted-foreground",
  "[&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:decoration-2",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-foreground",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
].join(" ");

export function Prose({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(PROSE_CLASS, className)}>{children}</div>;
}

/** A label of the interface, written as the user sees it. */
export function Ui({ children }: { children: ReactNode }) {
  return <strong>{children}</strong>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[0.85em] font-medium text-foreground">
      {children}
    </kbd>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-5 flex gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-base leading-7">
      <Info aria-hidden="true" className="mt-1.5 size-4 shrink-0 text-primary" />
      <div>{children}</div>
    </aside>
  );
}

/** A link to another article, or to one of its sections. */
export function DocLink({ to, section, children }: { to: string; section?: string; children: ReactNode }) {
  return <Link to={`/ayuda/${to}${section ? `#${section}` : ""}`}>{children}</Link>;
}

export function DocTable({ caption, head, rows }: { caption: string; head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-base leading-6">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/50 text-sm">
          <tr>
            {head.map((cell, index) => (
              <th key={index} scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border align-top">
              {row.map((cell, column) =>
                column === 0 ? (
                  <th key={column} scope="row" className="px-4 py-2.5 font-medium">
                    {cell}
                  </th>
                ) : (
                  <td key={column} className="px-4 py-2.5 text-foreground/85">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
