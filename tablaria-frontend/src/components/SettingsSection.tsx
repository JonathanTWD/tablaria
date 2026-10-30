import type { ReactNode } from "react";

/** A titled block of a settings-like page: title on the left, content on the right. */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-border py-8 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={id} className="font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
