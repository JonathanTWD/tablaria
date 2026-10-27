import type { ReactNode } from "react";

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="mb-8 space-y-3">
      <title>{`${title} | WiseData`}</title>
      <h1 className="text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="leading-7 text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
